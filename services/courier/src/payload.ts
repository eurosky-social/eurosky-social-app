import {type Notification} from './gen/courier_pb.js'

export type Copy = {title: string; message: string}

/**
 * The text a device shows. Age-restricted accounts get the generic copy, so
 * names and post snippets from other accounts never reach a lock screen.
 */
export function displayCopy(
  notification: Notification,
  ageRestricted: boolean,
  generic: Copy,
): Copy {
  if (ageRestricted || (!notification.title && !notification.message)) {
    return generic
  }
  return {title: notification.title, message: notification.message}
}

/**
 * The APNs body. The app reads `reason`, `uri`, `subject` and `recipientDid`
 * next to `aps` (src/lib/hooks/useNotificationHandler.ts), and its
 * notification service extension needs `mutable-content` to run and count
 * the badge.
 */
export function apnsPayload(
  notification: Notification,
  copy: Copy,
): Record<string, unknown> {
  const aps: Record<string, unknown> = {
    alert: {title: copy.title, body: copy.message},
    'mutable-content': 1,
    sound: 'default',
  }
  if (notification.threadId) aps['thread-id'] = notification.threadId
  return {...notification.additional, aps}
}

/**
 * The FCM data message. Android shows `title` and `message` itself, picks the
 * notification channel from `reason`, and hands the JSON in `body` to the app
 * as the notification's data (expo-notifications' data-only format).
 */
export function fcmData(
  notification: Notification,
  copy: Copy,
): Record<string, string> {
  const additional = notification.additional ?? {}
  const data: Record<string, string> = {
    title: copy.title,
    message: copy.message,
    body: JSON.stringify(additional),
  }
  if (typeof additional.reason === 'string') data.reason = additional.reason
  return data
}

/**
 * The AppView's fields plus the recipient. Client-controlled pushes (the
 * "mark read" sync) carry only a reason, but the app needs to know which
 * account they are for.
 */
function silentFields(notification: Notification): Record<string, unknown> {
  return {recipientDid: notification.recipientDid, ...notification.additional}
}

/**
 * A background push: no alert, sound or badge, so iOS wakes the app instead
 * of showing anything, and the app decides what to do.
 */
export function apnsSilentPayload(
  notification: Notification,
): Record<string, unknown> {
  return {...silentFields(notification), aps: {'content-available': 1}}
}

/**
 * A data message without `title` or `message`, which the Android app never
 * shows.
 */
export function fcmSilentData(
  notification: Notification,
): Record<string, string> {
  const fields = silentFields(notification)
  const data: Record<string, string> = {
    recipientDid: notification.recipientDid,
    body: JSON.stringify(fields),
  }
  if (typeof fields.reason === 'string') data.reason = fields.reason
  return data
}
