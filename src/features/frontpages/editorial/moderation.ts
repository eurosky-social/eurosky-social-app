import {
  mergeModUIResults,
  moderateViewExternal,
  type ModerationOpts,
} from '@bsky/sdk/moderation'

import {type EditorialArticle} from './articles'

/** Use the same post, media and external-card decisions in the preview and editor. */
export function articleModeration(
  article: EditorialArticle,
  opts?: ModerationOpts,
) {
  const external =
    article.external && opts
      ? moderateViewExternal(article.external, opts)
      : undefined
  return mergeModUIResults(
    article.item.moderation.ui('contentList'),
    article.item.moderation.ui('contentMedia'),
    external?.ui('contentView'),
    external?.ui('contentMedia'),
  )
}
