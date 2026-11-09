import {type MessageDescriptor} from '@lingui/core'
import {msg} from '@lingui/core/macro'

import {humanizeRecordName} from './services'

/**
 * Plain-language names for well-known record types. Anything missing here
 * falls back to {@link humanizeRecordName}.
 */
const RECORD_LABELS: Record<string, MessageDescriptor> = {
  'app.bsky.feed.like': msg`Likes`,
  'app.bsky.feed.post': msg({message: 'Posts', context: 'noun'}),
  'app.bsky.feed.repost': msg({message: 'Reposts', context: 'noun'}),
  'app.bsky.feed.generator': msg`Custom feeds`,
  'app.bsky.feed.threadgate': msg`Reply settings`,
  'app.bsky.feed.postgate': msg`Quote settings`,
  'app.bsky.graph.follow': msg({message: 'Follows', context: 'noun'}),
  'app.bsky.graph.block': msg({message: 'Blocks', context: 'noun'}),
  'app.bsky.graph.list': msg`Lists`,
  'app.bsky.graph.listitem': msg`List members`,
  'app.bsky.graph.listblock': msg`Blocked lists`,
  'app.bsky.graph.starterpack': msg`Starter packs`,
  'app.bsky.graph.verification': msg`Verifications`,
  'app.bsky.actor.profile': msg`Profile`,
  'app.bsky.actor.status': msg`Live status`,
  'app.bsky.labeler.service': msg`Labeler`,
  'app.bsky.notification.declaration': msg`Notification settings`,
  'chat.bsky.actor.declaration': msg`Chat settings`,
  'social.mu.newsFeedPrefs': msg`News feed settings`,
  'social.mu.deco.settings': msg`Decoration settings`,
}

export function getRecordLabel(
  nsid: string,
  translate: (descriptor: MessageDescriptor) => string,
): string {
  const descriptor = RECORD_LABELS[nsid]
  return descriptor ? translate(descriptor) : humanizeRecordName(nsid)
}
