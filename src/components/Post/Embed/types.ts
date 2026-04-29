import {type StyleProp, type ViewStyle} from 'react-native'
import {
  type AppBskyFeedDefs,
  type AppBskyFeedPost,
  type ModerationDecision,
} from '@atproto/api'

export enum PostEmbedViewContext {
  ThreadHighlighted = 'ThreadHighlighted',
  Feed = 'Feed',
  FeedEmbedRecordWithMedia = 'FeedEmbedRecordWithMedia',
  ChatMessage = 'ChatMessage',
}

export type CommonProps = {
  moderation?: ModerationDecision
  onOpen?: () => void
  style?: StyleProp<ViewStyle>
  viewContext?: PostEmbedViewContext
  isWithinQuote?: boolean
  allowNestedQuotes?: boolean
  /**
   * Raw record-side embed; carries fields that AppView strips when serving
   * the embed view (e.g. standard.site extras on external embeds).
   */
  rawEmbed?: AppBskyFeedPost.Record['embed']
}

export type EmbedProps = CommonProps & {
  embed?: AppBskyFeedDefs.PostView['embed']
}
