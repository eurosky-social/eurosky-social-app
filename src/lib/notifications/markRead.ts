/**
 * Reason of the silent push the courier sends when an account's notifications
 * were read on another device (the AppView's `updateSeen`).
 */
export const MARK_READ_REASON = 'mark-read-generic'

/**
 * Identifiers of the shown notifications that a "mark read" for
 * `recipientDid` clears: that account's notifications, but not its chat
 * notifications, which reading notifications does not read. Keep in step with
 * `isClearedByMarkRead` in the native background notification handlers.
 */
export function readNotificationIds(
  presented: {
    identifier: string
    payload: {reason?: unknown; recipientDid?: unknown} | null | undefined
  }[],
  recipientDid: string,
): string[] {
  return presented
    .filter(
      ({payload}) =>
        payload?.recipientDid === recipientDid &&
        typeof payload.reason === 'string' &&
        payload.reason !== MARK_READ_REASON &&
        !payload.reason.startsWith('chat-'),
    )
    .map(({identifier}) => identifier)
}
