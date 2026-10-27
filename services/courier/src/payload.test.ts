import assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import {apnsPayload, displayCopy, fcmData} from './payload.ts'
import {bridgeNotification} from './testing.ts'

const generic = {title: 'mu', message: 'You have a new notification'}

describe('displayCopy', () => {
  it('uses the AppView text', () => {
    assert.deepEqual(displayCopy(bridgeNotification(), false, generic), {
      title: 'Alice',
      message: 'replied: nice photo',
    })
  })

  it('hides names and snippets from age-restricted accounts', () => {
    assert.deepEqual(displayCopy(bridgeNotification(), true, generic), generic)
  })

  it('falls back to the generic text when the AppView sent none', () => {
    const notification = bridgeNotification({title: '', message: ''})
    assert.deepEqual(displayCopy(notification, false, generic), generic)
  })
})

describe('apnsPayload', () => {
  it('matches what the iOS app and its notification extension read', () => {
    const notification = bridgeNotification()
    const payload = apnsPayload(notification, {title: 'Alice', message: 'hi'})
    assert.deepEqual(payload, {
      aps: {
        alert: {title: 'Alice', body: 'hi'},
        'mutable-content': 1,
        sound: 'default',
      },
      reason: 'reply',
      uri: 'at://did:plc:alice/app.bsky.feed.post/3reply',
      cid: 'bafyreply',
      subject: 'at://did:plc:recipient/app.bsky.feed.post/3post',
      recipientDid: 'did:plc:recipient',
      actorDid: 'did:plc:alice',
    })
  })

  it('groups by thread id when the AppView sets one', () => {
    const payload = apnsPayload(bridgeNotification({threadId: 'convo-1'}), {
      title: 't',
      message: 'm',
    })
    assert.equal(
      (payload.aps as Record<string, unknown>)['thread-id'],
      'convo-1',
    )
  })

  it('never lets the AppView data replace aps', () => {
    const notification = bridgeNotification({
      additional: {reason: 'like', aps: {alert: 'spoofed'}},
    })
    const payload = apnsPayload(notification, {title: 't', message: 'm'})
    assert.deepEqual((payload.aps as Record<string, unknown>).alert, {
      title: 't',
      body: 'm',
    })
  })

  it('keeps a missing subject as null, as the bridge sends it for follows', () => {
    const notification = bridgeNotification({
      additional: {reason: 'follow', uri: 'at://x', subject: null},
    })
    assert.equal(apnsPayload(notification, generic).subject, null)
  })
})

describe('fcmData', () => {
  it('is the data-only shape mu reads on Android', () => {
    const notification = bridgeNotification()
    const data = fcmData(notification, {title: 'Alice', message: 'hi'})
    assert.equal(data.title, 'Alice')
    assert.equal(data.message, 'hi')
    // The background handler picks the notification channel from this.
    assert.equal(data.reason, 'reply')
    // expo-notifications parses `body` into the notification's data.
    assert.deepEqual(JSON.parse(data.body!), notification.additional)
  })

  it('only holds strings', () => {
    const data = fcmData(bridgeNotification(), generic)
    for (const value of Object.values(data)) {
      assert.equal(typeof value, 'string')
    }
  })
})
