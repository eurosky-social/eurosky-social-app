import {describe, expect, it} from '@jest/globals'

import {
  MARK_READ_REASON,
  readNotificationIds,
} from '#/lib/notifications/markRead'

const ALICE = 'did:plc:alice'
const BOB = 'did:plc:bob'

function shown(identifier: string, reason: string, recipientDid: string) {
  return {identifier, payload: {reason, recipientDid}}
}

describe('readNotificationIds', () => {
  it('clears the notifications of the account that read them', () => {
    expect(
      readNotificationIds(
        [
          shown('like', 'like', ALICE),
          shown('reply', 'reply', ALICE),
          shown('follow', 'follow', ALICE),
        ],
        ALICE,
      ),
    ).toEqual(['like', 'reply', 'follow'])
  })

  it('leaves other accounts on the same device alone', () => {
    expect(
      readNotificationIds(
        [shown('alice', 'like', ALICE), shown('bob', 'like', BOB)],
        ALICE,
      ),
    ).toEqual(['alice'])
  })

  it('leaves chat notifications alone', () => {
    expect(
      readNotificationIds(
        [
          shown('message', 'chat-message', ALICE),
          shown('added', 'chat-added-to-group', ALICE),
          shown('mention', 'mention', ALICE),
        ],
        ALICE,
      ),
    ).toEqual(['mention'])
  })

  it('ignores notifications without a payload it understands', () => {
    expect(
      readNotificationIds(
        [
          {identifier: 'local', payload: null},
          {identifier: 'other', payload: {recipientDid: ALICE}},
          shown('sync', MARK_READ_REASON, ALICE),
        ],
        ALICE,
      ),
    ).toEqual([])
  })
})
