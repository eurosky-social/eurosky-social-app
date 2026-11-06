import {
  mergeModUIResults,
  moderateViewExternal,
  type ModerationOpts,
} from '@bsky/sdk/moderation'

import {type PostArticle} from './articles'

/** Use the same post, media and external-card decisions in the preview and editor. */
export function articleModeration(
  article: PostArticle,
  opts?: ModerationOpts,
  context: 'contentList' | 'contentView' = 'contentList',
) {
  const external =
    article.external && opts
      ? moderateViewExternal(article.external, opts)
      : undefined
  return mergeModUIResults(
    article.item.moderation.ui(context),
    article.item.moderation.ui('contentMedia'),
    external?.ui('contentView'),
    external?.ui('contentMedia'),
  )
}
