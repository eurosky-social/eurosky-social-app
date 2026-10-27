package expo.modules.backgroundnotificationhandler

import com.google.firebase.messaging.RemoteMessage

interface BackgroundNotificationHandlerInterface {
  fun showMessage(remoteMessage: RemoteMessage)

  /**
   * Dismisses the shown notifications that [BackgroundNotificationHandler.isClearedByMarkRead]
   * matches for this account.
   */
  fun dismissReadNotifications(recipientDid: String)
}
