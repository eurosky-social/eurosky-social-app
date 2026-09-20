import {type ExploreArticle} from '../explore/cluster'
import {type RssItem} from '../rss/types'

/**
 * A link target for the focused article view, built from a story's article.
 *
 * The card knows the article's headline, image and outlet already, so they ride
 * along as params and the focused view renders instantly rather than refetching
 * what was just on screen. The real article URL travels as `url`, which is what
 * the view reads the discussion from and what "View" opens.
 */
export function articleViewLink(article: ExploreArticle) {
  return articleViewLinkFor(article.item, {
    did: article.publisher.did,
    name: article.publisher.name,
  })
}

/**
 * A focused-view link for a bare article and the outlet that ran it, for the
 * places that hold an `RssItem` without an `ExploreArticle` around it (the
 * publisher rail's "more from" list).
 */
export function articleViewLinkFor(
  item: RssItem,
  outlet: {did?: string; name?: string},
) {
  return {
    screen: 'NewsroomArticle' as const,
    params: {
      url: item.link,
      title: item.title || undefined,
      image: item.imageUrl,
      description: item.description,
      publishedAt: item.publishedAt,
      outletName: outlet.name,
      outletDid: outlet.did,
    },
  }
}
