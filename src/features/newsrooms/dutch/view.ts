/**
 * How the reader's preferences show a thread: which of its articles, and which
 * first. The same on the list and on the article page, so a story keeps the
 * coverage it was picked for.
 */
export type DutchThreadView = {
  /**
   * ISO language codes, in the reader's order: only articles in them, and a
   * lead in the first that has one.
   */
  languages?: string[]
  /** ISO country codes: only articles from outlets based in them. */
  countries?: string[]
  /** Outlet slugs: only their articles. */
  outlets?: string[]
  /** Outlet slugs: their articles first. */
  boost?: string[]
}

/** A view as the service's query parameters; unset ones are left out. */
export type DutchThreadViewParams = {
  /** Comma-separated ISO codes, in the reader's order. */
  lang?: string
  /** Comma-separated ISO codes, sorted. */
  country?: string
  /** Comma-separated outlet slugs, sorted. */
  outlet?: string
  /** Comma-separated outlet slugs, sorted. */
  boost?: string
  /*
   * Always `matching`: the page shows only the articles the reader asked for,
   * while the counts still describe the whole thread.
   */
  articles: 'matching'
}

export function dutchThreadViewParams(
  view: DutchThreadView,
): DutchThreadViewParams {
  return {
    /* Order kept: the service leads with the first language that has one. */
    lang: view.languages?.length
      ? [...new Set(view.languages)].join(',')
      : undefined,
    /* Sorted so the same set is one cache entry whatever order it was saved in. */
    country: joinSorted(view.countries),
    outlet: joinSorted(view.outlets),
    boost: joinSorted(view.boost),
    articles: 'matching',
  }
}

/**
 * A view as a string, for a story to carry to the article page (and a link to
 * it to keep): the service's query parameters. Undefined for a view that asks
 * for nothing.
 */
export function encodeDutchThreadView(
  view: DutchThreadView,
): string | undefined {
  const {articles: _articles, ...params} = dutchThreadViewParams(view)
  const encoded = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')
  return encoded || undefined
}

/**
 * The parameters of a view from `encodeDutchThreadView`, known ones only.
 * Parsed by hand: React Native's `URLSearchParams` cannot read a query.
 */
export function decodeDutchThreadView(
  view: string | undefined,
): DutchThreadViewParams {
  const values = new Map(
    (view ?? '')
      .split('&')
      .map(pair => pair.split('='))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)]),
  )
  return {
    lang: values.get('lang'),
    country: values.get('country'),
    outlet: values.get('outlet'),
    boost: values.get('boost'),
    articles: 'matching',
  }
}

function joinSorted(values: string[] | undefined): string | undefined {
  return values?.length ? [...values].sort().join(',') : undefined
}
