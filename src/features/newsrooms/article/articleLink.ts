import {type ExploreArticle, type ExploreStory} from '../explore/cluster'
import {type RssItem} from '../rss/types'

/**
 * A link target for the focused article view, built from a story's article.
 *
 * The card knows the article's headline, image and outlet already, so they ride
 * along as params and the focused view renders instantly rather than refetching
 * what was just on screen. The real article URL travels as `url`, which is what
 * the view reads the discussion from and what "View" opens.
 *
 * The story travels by reference (source and id), so the view can list the
 * other newsrooms' coverage of it, and a shared or reloaded link still can.
 */
export function articleViewLink(
  article: ExploreArticle,
  story?: Pick<ExploreStory, 'id' | 'source'>,
) {
  return articleViewLinkFor(
    article.item,
    {
      did: article.publisher.did,
      name: article.publisher.name,
      slug: article.publisher.slug,
    },
    story,
  )
}

/**
 * A focused-view link for a bare article and the outlet that ran it, for the
 * places that hold an `RssItem` without an `ExploreArticle` around it (the
 * publisher rail's "more from" list).
 */
export function articleViewLinkFor(
  item: RssItem,
  outlet: {did?: string; name?: string; slug?: string},
  story?: Pick<ExploreStory, 'id' | 'source'>,
) {
  const params = {
    url: item.link,
    title: item.title || undefined,
    image: item.imageUrl,
    description: item.description,
    publishedAt: item.publishedAt,
    outletName: outlet.name,
    outletDid: outlet.did,
    outletSlug: outlet.slug,
    storyId: story?.id,
    storySource: story?.source,
  }
  return {
    screen: 'NewsroomArticle' as const,
    /*
     * Unset values are left out: on web the params become the address, where
     * one would read back as the string "undefined".
     */
    params: Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined),
    ) as typeof params,
  }
}
