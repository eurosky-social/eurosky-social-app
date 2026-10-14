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

/**
 * An outlet as the threads API names it: by slug, with its Bluesky account and
 * country where the service knows them.
 */
export interface DutchOutlet {
  slug: string
  did: string | null
  name: string | null
  /** ISO 3166-1 alpha-2, lower case (`gb` for the UK). */
  country: string | null
}

/** One article of a thread. `uri` is the article URL, and its label subject. */
export interface DutchArticle {
  uri: string
  title: string | null
  summary: string | null
  imageUrl: string | null
  publishedAt: string
  outlet: DutchOutlet | null
  siteUrl: string | null
  /** The outlet's province slug, when it is a regional broadcaster. */
  province: string | null
  /** ISO 639-1, the article's own or its feed's. */
  lang: string | null
  labels: string[]
  /** From an outlet the read boosted. Only sent when it boosted some. */
  boosted?: boolean
}

/** One day's burst of a thread: its lead article and a few more. */
export interface DutchEvent {
  key: string
  day: string
  lead: DutchArticle | null
  articles: DutchArticle[]
}

/**
 * A thread: the events of one subject linked across days, which is what the
 * service serves as the stories of the news view. `story` is one subject;
 * `recurring` is a kind of event reported all along, which reads as a standing
 * department rather than as news.
 */
export interface DutchThread {
  id: number
  /** Stable across fits, unlike `id`: what a link should carry. */
  key: string
  scope: string
  kind: 'story' | 'recurring'
  /** Title of the lead article. */
  headline: string | null
  /** Slug of the theme it belongs to; null when no theme was near enough. */
  theme: string | null
  counts: {
    events: number
    posts: number
    articles: number
    outlets: number
  }
  /** Province label value -> articles and posts of the thread carrying it. */
  provinces: Record<string, number>
  /** The countries of the outlets that covered it. */
  countries: string[]
  /** The languages of its articles. */
  languages: string[]
  firstSeen: string | null
  lastSeen: string | null
  /** Null when the thread's articles have aged out of the archive. */
  lead: DutchArticle | null
  /**
   * With `lang` asked for: the thread's lead article in one of those
   * languages, a boosted outlet's first, null when it has none. Absent
   * otherwise.
   */
  leadIn?: DutchArticle | null
  /** Most recent first, each with a few of its articles. */
  events: DutchEvent[]
  /**
   * A boosted outlet's article leads one of its events. Only sent when the
   * read boosted some outlets.
   */
  boosted?: boolean
}

/** The service's active fit of a scope. */
export type DutchModel = {id: number; fittedAt: string; active: boolean}

export interface DutchThreadsResponse {
  /** Null when nothing has been fitted yet; `threads` is then empty. */
  model: DutchModel | null
  total: number
  limit: number
  offset: number
  threads: DutchThread[]
}

/** `/api/threads/{key}`: one thread with every event in full. */
export interface DutchThreadResponse {
  /** The fit the thread belongs to, which need not be the active one. */
  model: DutchModel | null
  thread: DutchThread
}

export interface DutchThemesResponse {
  themes: DutchTheme[]
}

export interface DutchCategoriesResponse {
  categories: DutchCategory[]
}

/**
 * Sort orders of `/api/threads` the page uses. `burst` is the service's own
 * ranking of the news; `here` ranks by the outlets in the `country` asked for.
 */
export type DutchThreadSort = 'burst' | 'latest' | 'coverage' | 'here'

/**
 * An outlet as `/api/outlets` lists it: who publishes, with the domains its
 * articles come from. `slug` is what the news settings store and what
 * `/api/threads?outlet=` filters by.
 */
export interface DutchOutletListing {
  slug: string
  did: string | null
  name: string
  /** ISO 3166-1 alpha-2, lower case. */
  country: string | null
  /** ISO 639-1. */
  language: string | null
  /** Free text: public broadcaster, national daily, regional, specialist... */
  kind: string | null
  domains: string[]
  /** How many of its articles the service holds. */
  articles: number
  /**
   * What it covers: theme slug -> the current stories it ran an article in.
   * Themes it covered none of are absent. Unset from a service older than the
   * field, which says nothing either way.
   */
  themes?: Record<string, number>
  sources?: {
    /**
     * Bluesky accounts that are the outlet's: its own and the tracked repos
     * the service files under it - its desks and journalists.
     */
    accounts: string[]
  }
}

export interface DutchOutletsResponse {
  outlets: DutchOutletListing[]
}

/** One of an outlet's own articles, with the story it is in, if any yet. */
export interface DutchOutletArticle extends DutchArticle {
  /** The thread of the scope's active fit it is in; null until it is placed. */
  thread: {key: string; scope: string} | null
}

/** `/api/outlets/{ref}/articles`: a page of an outlet's articles, latest first. */
export interface DutchOutletArticlesResponse {
  hasMore: boolean
  articles: DutchOutletArticle[]
}
