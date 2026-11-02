import {isInvalidHandle} from '#/lib/strings/handles'
import {getNewsroomPublisherByDid} from '#/features/frontpages/legacy/publishers'
import {useDutchOutletQuery} from '#/features/news/dutch/queries'
import {NEWS_V2_ENABLED} from '#/features/newsFeed/config'
import {frontpagePath} from './frontpages'
import {findPublicationPreview} from './preview'

/**
 * With the news hub, every account has a frontpage. An aggregator outlet's
 * is addressed by its slug, looked up by the account's DID alone rather than
 * in the whole list; any other account's by its handle (or DID, without a
 * valid one). The handle address stands in while the lookup runs, so the
 * shortcut never waits on the aggregator.
 */
function useAggregatorFrontpagePath(profile: {
  did: string
  handle: string
}): string | undefined {
  const preview = findPublicationPreview(profile.did)
  const {outlet} = useDutchOutletQuery({ref: preview ? undefined : profile.did})
  const frontpage = preview ??
    outlet ?? {
      slug: isInvalidHandle(profile.handle) ? profile.did : profile.handle,
    }
  return frontpagePath(frontpage)
}

/** Without it, a frontpage is one of the publishers registered in the app. */
function useRegisteredFrontpagePath({did}: {did: string}): string | undefined {
  const preview = findPublicationPreview(did)
  return preview
    ? frontpagePath(preview)
    : getNewsroomPublisherByDid(did)
      ? `/frontpage/${did}`
      : undefined
}

/**
 * The path of the frontpage an account runs, if it runs one: every account
 * with the news hub, registered publishers without it. Picked once per
 * build, so a build without the news hub never asks the aggregator.
 */
export const useProfileFrontpagePath = NEWS_V2_ENABLED
  ? useAggregatorFrontpagePath
  : useRegisteredFrontpagePath
