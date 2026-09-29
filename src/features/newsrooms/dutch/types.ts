/**
 * The Dutch labeler's consumer API, as much of it as the newsroom hub reads.
 *
 * Mirrors the service's OpenAPI document rather than the whole of it: the
 * fields below are the ones the explore spread renders or ranks by. Fields the
 * service sends that nothing here reads are deliberately absent, so adding a
 * read is a visible change.
 *
 * The service models the news itself - it clusters articles into stories,
 * assigns each a theme, and matches Bluesky posts to them - so these types are
 * the shape of an answer, not of raw feed data. See ./README.md for how that
 * lands on the page.
 */

/** A section of the news, curated in the pipeline. Every story has exactly one. */
export interface DutchTheme {
  slug: string
  name: string
  nameNl: string
  description: string | null
  counts: {
    stories: number
    recurring: number
    posts: number
    articles: number
  }
}

/**
 * A label value: the language (`dutch`) or a province (`nl-utrecht`). A story
 * is in a category when an article or post of it carries that label.
 */
export interface DutchCategory {
  val: string
  name: string
  description: string | null
  kind: 'language' | 'province'
  counts: {
    articles: number
    posts: number
    stories: number
  }
}

/** One article of a story. `uri` is the article URL, and its label subject. */
export interface DutchArticle {
  uri: string
  title: string | null
  summary: string | null
  imageUrl: string | null
  publishedAt: string
  outlet: string | null
  siteUrl: string | null
  /** The outlet's province slug, when it is a regional broadcaster. */
  province: string | null
  labels: string[]
  /** Centered cosine to the story centroid. */
  similarity: number
}

/**
 * A Bluesky post the pipeline matched to a story by embedding similarity. This
 * is the story's discussion, and it arrives with the story - no per-article
 * search of our own.
 */
export interface DutchPost {
  uri: string
  did: string
  handle: string | null
  text: string
  createdAt: string
  labels: string[]
  similarity: number
}

/**
 * A cluster of the last week's articles. `story` is one event; `recurring` is a
 * kind of event reported all week, which reads as a standing department rather
 * than as news.
 */
export interface DutchStory {
  id: number
  /** The cluster's top terms, joined. Not a headline - see `headline`. */
  name: string
  terms: string[]
  /** Title of the article closest to the centroid. */
  headline: string | null
  kind: 'story' | 'recurring'
  /** Slug of the theme it belongs to; null when no theme was near enough. */
  theme: string | null
  counts: {
    posts: number
    articles: number
    outlets: number
  }
  /** Province label value -> articles and posts of the story carrying it. */
  provinces: Record<string, number>
  firstSeen: string | null
  lastSeen: string | null
  /** Null when the story's articles have aged out of the archive. */
  lead: DutchArticle | null
  /** The other articles, most similar first. */
  articles: DutchArticle[]
  /** The discussion, most similar first. */
  posts: DutchPost[]
}

export interface DutchStoriesResponse {
  /** Null when nothing has been modeled yet; `stories` is then empty. */
  model: {id: number; fittedAt: string; active: boolean} | null
  total: number
  limit: number
  offset: number
  stories: DutchStory[]
}

export interface DutchThemesResponse {
  themes: DutchTheme[]
}

export interface DutchCategoriesResponse {
  categories: DutchCategory[]
}

/** Sort orders `/api/stories` accepts. */
export type DutchStorySort = 'discussed' | 'latest' | 'coverage' | 'size'
