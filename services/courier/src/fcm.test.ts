import assert from 'node:assert/strict'
import {generateKeyPairSync, verify} from 'node:crypto'
import http from 'node:http'
import {type AddressInfo} from 'node:net'
import {after, before, beforeEach, describe, it} from 'node:test'

import {FcmClient, type FcmRequest} from './fcm.ts'
import {ANDROID_TOKEN} from './testing.ts'

type Reply = {status: number; body?: unknown}

/**
 * A stand-in for Google's OAuth token endpoint and the FCM v1 send endpoint.
 */
function fakeGoogle() {
  const state = {
    tokenRequests: [] as URLSearchParams[],
    sends: [] as {authorization?: string; body: any}[],
    tokenReplies: [] as Reply[],
    sendReplies: [] as Reply[],
    issued: 0,
  }
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString()
      let reply: Reply
      if (req.url === '/token') {
        state.tokenRequests.push(new URLSearchParams(raw))
        state.issued++
        reply = state.tokenReplies.shift() ?? {
          status: 200,
          body: {access_token: `access-${state.issued}`, expires_in: 3599},
        }
      } else if (req.url === '/v1/projects/mu-test/messages:send') {
        state.sends.push({
          authorization: req.headers.authorization,
          body: JSON.parse(raw),
        })
        reply = state.sendReplies.shift() ?? {
          status: 200,
          body: {name: 'projects/mu-test/messages/1'},
        }
      } else {
        reply = {status: 404}
      }
      res.writeHead(reply.status, {'content-type': 'application/json'})
      res.end(reply.body === undefined ? '' : JSON.stringify(reply.body))
    })
  })
  return {server, state}
}

function fcmError(status: number, grpcStatus: string, errorCode?: string) {
  return {
    status,
    body: {
      error: {
        code: status,
        message: 'Requested entity was not found.',
        status: grpcStatus,
        details: errorCode
          ? [
              {
                '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError',
                errorCode,
              },
            ]
          : [],
      },
    },
  }
}

function request(overrides: Partial<FcmRequest> = {}): FcmRequest {
  return {
    token: ANDROID_TOKEN,
    data: {title: 't', message: 'm', reason: 'like', body: '{}'},
    priority: 'HIGH',
    ttlSeconds: 3600,
    ...overrides,
  }
}

describe('FcmClient', () => {
  const {publicKey, privateKey} = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  })
  const google = fakeGoogle()
  let origin = ''
  let client: FcmClient

  before(async () => {
    await new Promise<void>(resolve =>
      google.server.listen(0, '127.0.0.1', resolve),
    )
    origin = `http://127.0.0.1:${(google.server.address() as AddressInfo).port}`
  })

  beforeEach(() => {
    google.state.tokenRequests.length = 0
    google.state.sends.length = 0
    google.state.tokenReplies.length = 0
    google.state.sendReplies.length = 0
    google.state.issued = 0
    client = new FcmClient({
      projectId: 'mu-test',
      clientEmail: 'courier@mu-test.iam.gserviceaccount.com',
      privateKey: privateKey.export({type: 'pkcs8', format: 'pem'}).toString(),
      tokenUri: `${origin}/token`,
      origin,
    })
  })

  after(async () => {
    await new Promise(resolve => google.server.close(resolve))
  })

  it('sends a high-priority data message with a service-account token', async () => {
    assert.deepEqual(await client.send(request()), {ok: true})

    const [tokenRequest] = google.state.tokenRequests
    assert.ok(tokenRequest)
    assert.equal(
      tokenRequest.get('grant_type'),
      'urn:ietf:params:oauth:grant-type:jwt-bearer',
    )
    const [header, claims, signature] = tokenRequest
      .get('assertion')!
      .split('.')
    assert.ok(
      verify(
        'sha256',
        Buffer.from(`${header}.${claims}`),
        publicKey,
        Buffer.from(signature!, 'base64url'),
      ),
    )
    const decoded = JSON.parse(Buffer.from(claims!, 'base64url').toString())
    assert.equal(decoded.iss, 'courier@mu-test.iam.gserviceaccount.com')
    assert.equal(decoded.aud, `${origin}/token`)
    assert.equal(
      decoded.scope,
      'https://www.googleapis.com/auth/firebase.messaging',
    )

    const [send] = google.state.sends
    assert.equal(send?.authorization, 'Bearer access-1')
    assert.deepEqual(send?.body, {
      message: {
        token: ANDROID_TOKEN,
        data: request().data,
        android: {priority: 'HIGH', ttl: '3600s'},
      },
    })
  })

  it('sends a silent message at normal priority with its collapse key', async () => {
    await client.send(
      request({
        data: {reason: 'mark-read-generic', body: '{}'},
        priority: 'NORMAL',
        collapseKey: 'mark-read-generic',
      }),
    )
    assert.deepEqual(google.state.sends[0]?.body.message.android, {
      priority: 'NORMAL',
      ttl: '3600s',
      collapse_key: 'mark-read-generic',
    })
  })

  it('reuses the access token across sends', async () => {
    await Promise.all([client.send(request()), client.send(request())])
    await client.send(request())
    assert.equal(google.state.tokenRequests.length, 1)
    assert.equal(google.state.sends.length, 3)
  })

  it('fetches a new access token once when Google rejects the old one', async () => {
    google.state.sendReplies.push({status: 401, body: {error: {code: 401}}})
    assert.deepEqual(await client.send(request()), {ok: true})
    assert.equal(google.state.tokenRequests.length, 2)
    assert.equal(google.state.sends[1]?.authorization, 'Bearer access-2')
  })

  it('reports an unregistered token as dead', async () => {
    google.state.sendReplies.push(fcmError(404, 'NOT_FOUND', 'UNREGISTERED'))
    assert.deepEqual(await client.send(request()), {
      ok: false,
      invalidToken: true,
      retryable: false,
      reason: 'UNREGISTERED',
    })
  })

  it('reports a token from another Firebase project as dead', async () => {
    google.state.sendReplies.push(
      fcmError(403, 'PERMISSION_DENIED', 'SENDER_ID_MISMATCH'),
    )
    const result = await client.send(request())
    assert.equal(!result.ok && result.invalidToken, true)
  })

  it('marks quota and outages as worth retrying', async () => {
    google.state.sendReplies.push(
      fcmError(429, 'RESOURCE_EXHAUSTED', 'QUOTA_EXCEEDED'),
    )
    google.state.sendReplies.push(fcmError(503, 'UNAVAILABLE', 'UNAVAILABLE'))
    const quota = await client.send(request())
    const down = await client.send(request())
    assert.equal(!quota.ok && quota.retryable, true)
    assert.equal(!down.ok && down.retryable, true)
  })

  it('marks a failed access-token request as worth retrying', async () => {
    google.state.tokenReplies.push({status: 500, body: {error: 'internal'}})
    const result = await client.send(request())
    assert.equal(!result.ok && result.retryable, true)
    assert.equal(google.state.sends.length, 0)
  })

  it('refuses a malformed token without calling Google', async () => {
    const result = await client.send(request({token: 'not a token'}))
    assert.equal(!result.ok && result.invalidToken, true)
    assert.equal(google.state.tokenRequests.length, 0)
  })
})
