package expo.modules.backgroundnotificationhandler

import android.content.Context
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONObject

class BackgroundNotificationHandler(
  private val context: Context,
  private val notifInterface: BackgroundNotificationHandlerInterface,
) {
  companion object {
    /**
     * The courier's silent push after an account's notifications were read on another device.
     */
    const val MARK_READ_REASON = "mark-read-generic"

    /**
     * Whether a "mark read" for [recipientDid] clears a shown notification with this data
     * `body`: the account's notifications, but not its chat notifications. Keep in step with
     * `readNotificationIds` in src/lib/notifications/markRead.ts.
     */
    fun isClearedByMarkRead(
      body: JSONObject?,
      recipientDid: String,
    ): Boolean {
      if (body == null || body.optString("recipientDid") != recipientDid) return false
      val reason = body.optString("reason")
      return reason.isNotEmpty() && reason != MARK_READ_REASON && !reason.startsWith("chat-")
    }
  }

  fun handleMessage(remoteMessage: RemoteMessage) {
    if (ExpoBackgroundNotificationHandlerModule.isForegrounded) {
      // We'll let expo-notifications handle the notification if the app is foregrounded
      return
    }

    if (remoteMessage.data["reason"] == MARK_READ_REASON) {
      // Silent: never shown, only clears what was read elsewhere.
      remoteMessage.data["recipientDid"]?.let { notifInterface.dismissReadNotifications(it) }
      return
    }

    if (remoteMessage.data["reason"] == "chat-message" || remoteMessage.data["reason"] == "chat-reaction") {
      mutateWithChatMessage(remoteMessage)
    } else {
      mutateWithOtherReason(remoteMessage)
    }

    notifInterface.showMessage(remoteMessage)
  }

  private fun mutateWithChatMessage(remoteMessage: RemoteMessage) {
    if (NotificationPrefs(context).getBoolean("playSoundChat")) {
      // If oreo or higher
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
        remoteMessage.data["channelId"] = "chat-messages"
      } else {
        remoteMessage.data["sound"] = "dm.mp3"
      }
    } else {
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
        remoteMessage.data["channelId"] = "chat-messages-muted"
      } else {
        remoteMessage.data["sound"] = null
      }
    }

    // TODO - Remove this once we have more backend capability
    remoteMessage.data["badge"] = null
  }

  private fun mutateWithOtherReason(remoteMessage: RemoteMessage) {
    // If oreo or higher
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
      // If one of "like", "repost", "follow", "mention", "reply", "quote", "like-via-repost", "repost-via-repost", "subscribed-post"
      // assign to it's eponymous channel. otherwise do nothing, let expo handle it
      when (remoteMessage.data["reason"]) {
        "like", "repost", "follow", "mention", "reply", "quote", "like-via-repost", "repost-via-repost", "subscribed-post" -> {
          remoteMessage.data["channelId"] = remoteMessage.data["reason"]
        }
      }
    }
  }
}
