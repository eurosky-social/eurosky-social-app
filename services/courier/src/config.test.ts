import assert from 'node:assert/strict'
import {generateKeyPairSync} from 'node:crypto'
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {after, describe, it} from 'node:test'

import {readConfig} from './config.ts'

const dir = mkdtempSync(join(tmpdir(), 'courier-config-'))
const apnsKeyFile = join(dir, 'apns.p8')
const fcmFile = join(dir, 'fcm.json')
const apnsKey = generateKeyPairSync('ec', {namedCurve: 'prime256v1'})
  .privateKey.export({type: 'pkcs8', format: 'pem'})
  .toString()
writeFileSync(apnsKeyFile, apnsKey)
writeFileSync(
  fcmFile,
  JSON.stringify({
    type: 'service_account',
    project_id: 'mu-app',
    client_email: 'courier@mu-app.iam.gserviceaccount.com',
    private_key: 'PEM',
    token_uri: 'https://oauth2.googleapis.com/token',
  }),
)

const minimal = {
  COURIER_API_KEYS: 'secret',
  COURIER_DATABASE_URL: 'postgres://courier@localhost/courier',
  COURIER_APNS_KEY_FILE: apnsKeyFile,
  COURIER_APNS_KEY_ID: 'KEY123',
  COURIER_APNS_TEAM_ID: 'TEAM456',
}

after(() => rmSync(dir, {recursive: true, force: true}))

describe('readConfig', () => {
  it('fills in defaults', () => {
    const config = readConfig(minimal)
    assert.equal(config.host, '127.0.0.1')
    assert.equal(config.port, 2587)
    assert.equal(config.httpVersion, '1.1')
    assert.deepEqual(config.apiKeys, ['secret'])
    assert.deepEqual(config.appIds, ['social.mu.app'])
    assert.equal(config.ttlSeconds, 86_400)
    assert.equal(config.apns?.origin, 'https://api.push.apple.com')
    assert.equal(config.apns?.privateKey, apnsKey)
    assert.equal(config.fcm, undefined)
  })

  it('reads the Firebase service account file', () => {
    const config = readConfig({
      ...minimal,
      COURIER_FCM_SERVICE_ACCOUNT_FILE: fcmFile,
      COURIER_APNS_ENVIRONMENT: 'sandbox',
      COURIER_API_KEYS: 'old, new',
      COURIER_HTTP_VERSION: '2',
    })
    assert.deepEqual(config.fcm, {
      projectId: 'mu-app',
      clientEmail: 'courier@mu-app.iam.gserviceaccount.com',
      privateKey: 'PEM',
      tokenUri: 'https://oauth2.googleapis.com/token',
      origin: 'https://fcm.googleapis.com',
    })
    assert.equal(config.apns?.origin, 'https://api.sandbox.push.apple.com')
    assert.deepEqual(config.apiKeys, ['old', 'new'])
    assert.equal(config.httpVersion, '2')
  })

  it('refuses to start without a key or a platform', () => {
    assert.throws(
      () => readConfig({...minimal, COURIER_API_KEYS: ' '}),
      /COURIER_API_KEYS/,
    )
    assert.throws(
      () => readConfig({...minimal, COURIER_APNS_KEY_FILE: undefined}),
      /COURIER_APNS_KEY_FILE/,
    )
    assert.throws(
      () => readConfig({...minimal, COURIER_APNS_KEY_ID: undefined}),
      /COURIER_APNS_KEY_ID/,
    )
  })

  it('refuses malformed numbers and versions', () => {
    assert.throws(
      () => readConfig({...minimal, COURIER_PORT: 'eighty'}),
      /COURIER_PORT/,
    )
    assert.throws(
      () => readConfig({...minimal, COURIER_HTTP_VERSION: '3'}),
      /COURIER_HTTP_VERSION/,
    )
  })
})
