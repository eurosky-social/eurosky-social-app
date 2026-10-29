import {type Frontpage} from './frontpages'

/** Isolated demo publication, reachable explicitly without inventing an aggregator outlet. */
const PREVIEW: Frontpage = {
  slug: 'editorial-test',
  did: 'did:plc:y57igqldvutzs7gpmmrrqbw7',
  name: 'WIRED test',
  country: null,
  domains: [],
  themes: {},
  reporterDids: [],
}

export function findPublicationPreview(
  ref: string | undefined,
): Frontpage | undefined {
  return ref === PREVIEW.did ||
    ref === PREVIEW.slug ||
    ref === 'test1234321.eurosky.social'
    ? PREVIEW
    : undefined
}
