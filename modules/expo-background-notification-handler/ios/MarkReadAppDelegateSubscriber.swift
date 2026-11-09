import ExpoModulesCore
import UserNotifications

let markReadReason = "mark-read-generic"

/*
 * Handles the courier's silent "mark read" push. When an account's
 * notifications were read on another device, this removes that account's
 * notifications from Notification Center and lowers the badge to what is
 * left. It runs natively, so it also works while the app is suspended and
 * JS is not running.
 */
public class MarkReadAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    guard userInfo["reason"] as? String == markReadReason,
      let recipientDid = userInfo["recipientDid"] as? String
    else {
      completionHandler(.noData)
      return
    }

    let center = UNUserNotificationCenter.current()
    center.getDeliveredNotifications { delivered in
      var cleared: [String] = []
      var remaining = 0
      for notification in delivered {
        let info = notification.request.content.userInfo
        if isClearedByMarkRead(info, recipientDid: recipientDid) {
          cleared.append(notification.request.identifier)
        } else if countsTowardBadge(info) {
          remaining += 1
        }
      }
      center.removeDeliveredNotifications(withIdentifiers: cleared)
      // The notification service extension counts up from this value.
      UserDefaults(suiteName: APP_GROUP)?.setValue(remaining, forKey: "badgeCount")
      center.setBadgeCount(remaining) { _ in
        completionHandler(cleared.isEmpty ? .noData : .newData)
      }
    }
  }
}

/// Keep in step with `readNotificationIds` in src/lib/notifications/markRead.ts:
/// the account's notifications, but not its chat notifications.
func isClearedByMarkRead(_ userInfo: [AnyHashable: Any], recipientDid: String) -> Bool {
  guard let reason = userInfo["reason"] as? String,
    userInfo["recipientDid"] as? String == recipientDid
  else {
    return false
  }
  return reason != markReadReason && !reason.hasPrefix("chat-")
}

/// Mirrors the notification service extension, which raises the badge for
/// every push it handles except chat messages and reactions.
private func countsTowardBadge(_ userInfo: [AnyHashable: Any]) -> Bool {
  guard let reason = userInfo["reason"] as? String else {
    return false
  }
  return reason != "chat-message" && reason != "chat-reaction"
}
