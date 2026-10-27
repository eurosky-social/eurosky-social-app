import assert from 'node:assert/strict'
import {generateKeyPairSync, type KeyObject, verify} from 'node:crypto'
import http2 from 'node:http2'
import {type AddressInfo} from 'node:net'
import {after, before, beforeEach, describe, it} from 'node:test'

import {ApnsClient, type ApnsRequest} from './apns.ts'
import {IOS_TOKEN} from './testing.ts'

type Received = {
  headers: http2.IncomingHttpHeaders
  body: Record<string, unknown>
}
type Reply = {status: number; body?: Record<string, unknown>}

/**
 * A stand-in for api.push.apple.com, speaking HTTP/2 without TLS.
 */
function fakeApple() {
  const received: Received[] = []
  const replies: Reply[] = []
  const sessions = new Set<http2.ServerHttp2Session>()
  const server = http2.createServer()
  server.on('session', session => {
    sessions.add(session)
    session.on('close', () => sessions.delete(session))
  })
  server.on('stream', (stream, headers) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', () => {
      received.push({
        headers,
        body: JSON.parse(Buffer.concat(chunks).toString()),
      })
      const reply = replies.shift() ?? {status: 200}
      stream.respond({':status': reply.status})
      stream.end(reply.body ? JSON.stringify(reply.body) : undefined)
    })
  })
  return {server, received, replies, sessions}
}

function request(overrides: Partial<ApnsRequest> = {}): ApnsRequest {
  return {
    token: IOS_TOKEN,
    topic: 'social.mu.app',
    expiration: 1_900_000_000,
    payload: {aps: {alert: {title: 't', body: 'b'}}, reason: 'like'},
    ...overrides,
  }
}

function verifyProviderToken(jwt: string, publicKey: KeyObject) {
  const [header, claims, signature] = jwt.split('.')
  assert.ok(header && claims && signature)
  assert.ok(
    verify(
      'sha256',
      Buffer.from(`${header}.${claims}`),
      {key: publicKey, dsaEncoding: 'ieee-p1363'},
      Buffer.from(signature, 'base64url'),
    ),
    'provider token signature',
  )
  return {
    header: JSON.parse(Buffer.from(header, 'base64url').toString()),
    claims: JSON.parse(Buffer.from(claims, 'base64url').toString()),
  }
}

describe('ApnsClient', () => {
  const {publicKey, privateKey} = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  })
  const apple = fakeApple()
  let client: ApnsClient

  before(async () => {
    await new Promise<void>(resolve =>
      apple.server.listen(0, '127.0.0.1', resolve),
    )
  })

  beforeEach(() => {
    apple.received.length = 0
    apple.replies.length = 0
    client?.close()
    const {port} = apple.server.address() as AddressInfo
    client = new ApnsClient({
      keyId: 'KEY123',
      teamId: 'TEAM456',
      privateKey: privateKey.export({type: 'pkcs8', format: 'pem'}).toString(),
      origin: `http://127.0.0.1:${port}`,
    })
  })

  after(async () => {
    client.close()
    await new Promise(resolve => apple.server.close(resolve))
  })

  it('sends an alert push signed with the provider token', async () => {
    const result = await client.send(request())
    assert.deepEqual(result, {ok: true})

    const [sent] = apple.received
    assert.ok(sent)
    assert.equal(sent.headers[':path'], `/3/device/${IOS_TOKEN}`)
    assert.equal(sent.headers['apns-topic'], 'social.mu.app')
    assert.equal(sent.headers['apns-push-type'], 'alert')
    assert.equal(sent.headers['apns-priority'], '10')
    assert.equal(sent.headers['apns-expiration'], '1900000000')
    assert.deepEqual(sent.body, request().payload)

    const auth = String(sent.headers.authorization)
    assert.match(auth, /^bearer /)
    const {header, claims} = verifyProviderToken(auth.slice(7), publicKey)
    assert.deepEqual(header, {alg: 'ES256', kid: 'KEY123'})
    assert.equal(claims.iss, 'TEAM456')
    assert.ok(Math.abs(claims.iat - Date.now() / 1000) < 5)
  })

  it('reuses the provider token and the connection', async () => {
    await client.send(request())
    await client.send(request())
    const [first, second] = apple.received
    assert.equal(first?.headers.authorization, second?.headers.authorization)
    assert.equal(apple.sessions.size, 1)
  })

  it('reports an unregistered token as dead, with the time Apple gives', async () => {
    apple.replies.push({
      status: 410,
      body: {reason: 'Unregistered', timestamp: 1_700_000_000_000},
    })
    assert.deepEqual(await client.send(request()), {
      ok: false,
      invalidToken: true,
      retryable: false,
      reason: 'Unregistered',
      invalidSince: new Date(1_700_000_000_000),
    })
  })

  it('reports a token from another app or environment as dead', async () => {
    apple.replies.push({status: 400, body: {reason: 'BadDeviceToken'}})
    const result = await client.send(request())
    assert.equal(result.ok, false)
    assert.equal(!result.ok && result.invalidToken, true)
  })

  it('refuses a token that is not hex without calling Apple', async () => {
    const result = await client.send(request({token: '../../evil'}))
    assert.equal(!result.ok && result.invalidToken, true)
    assert.equal(apple.received.length, 0)
  })

  it('renews an expired provider token and tries once more', async () => {
    apple.replies.push({status: 403, body: {reason: 'ExpiredProviderToken'}})
    assert.deepEqual(await client.send(request()), {ok: true})
    assert.equal(apple.received.length, 2)
  })

  it('marks rate limits and outages as worth retrying', async () => {
    apple.replies.push({status: 429, body: {reason: 'TooManyRequests'}})
    apple.replies.push({status: 503, body: {reason: 'ServiceUnavailable'}})
    const limited = await client.send(request())
    const down = await client.send(request())
    assert.equal(!limited.ok && limited.retryable, true)
    assert.equal(!down.ok && down.retryable, true)
  })

  it('treats other rejections as final', async () => {
    apple.replies.push({status: 400, body: {reason: 'PayloadTooLarge'}})
    assert.deepEqual(await client.send(request()), {
      ok: false,
      invalidToken: false,
      retryable: false,
      reason: 'PayloadTooLarge',
    })
  })

  it('reconnects after the connection drops', async () => {
    await client.send(request())
    assert.equal(apple.sessions.size, 1)
    for (const session of apple.sessions) session.destroy()
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.deepEqual(await client.send(request()), {ok: true})
  })

  it('reports an unreachable server as worth retrying', async () => {
    const offline = new ApnsClient(
      {
        keyId: 'k',
        teamId: 't',
        privateKey: privateKey
          .export({type: 'pkcs8', format: 'pem'})
          .toString(),
        origin: 'http://127.0.0.1:1',
      },
      {timeoutMs: 1_000},
    )
    const result = await offline.send(request())
    offline.close()
    assert.equal(!result.ok && result.retryable, true)
  })
})
