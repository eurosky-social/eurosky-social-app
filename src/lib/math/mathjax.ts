/**
 * TeX -> SVG typesetting for native, through MathJax's pure-JS pipeline
 * (the LiteDOM adaptor needs no browser). Web renders with KaTeX instead
 * (`#/components/RichTextMath/Math.web.tsx`); on iOS/Android nothing can draw
 * KaTeX's HTML inside a `<Text>`, but an SVG can be placed inline with
 * react-native-svg. The SVG carries every glyph as a path, so no fonts ship
 * with the app - only the typesetter, which is in the bundle but not
 * evaluated until the first post with math.
 */
export type TypesetResult = {
  /** Standalone `<svg>` markup; glyphs use `currentColor`. */
  svg: string
  /** Box metrics in ex, MathJax's unit. Convert with `exToPx`. */
  widthEx: number
  heightEx: number
  /**
   * How far the box's bottom sits below the text baseline, in ex (negative
   * when it dips under, e.g. for a fraction or a subscript).
   */
  verticalAlignEx: number
}

type Engine = {
  convert: (tex: string, display: boolean) => string
}

/*
 * MathJax lays out in ex but the LiteDOM cannot measure fonts, so it assumes
 * its default `exFactor` of 0.5em. Converting back with the same factor keeps
 * our pixel boxes consistent with the layout it produced.
 */
const EX_PER_EM = 0.5

/** Pixel size of `ex` ex units of text set at `fontSize` px. */
export function exToPx(ex: number, fontSize: number): number {
  return ex * EX_PER_EM * fontSize
}

let enginePromise: Promise<Engine> | null = null

async function createEngine(): Promise<Engine> {
  const [
    {mathjax},
    {TeX},
    {SVG},
    {liteAdaptor},
    {RegisterHTMLHandler},
    {AllPackages},
  ] = await Promise.all([
    import('mathjax-full/js/mathjax'),
    import('mathjax-full/js/input/tex'),
    import('mathjax-full/js/output/svg'),
    import('mathjax-full/js/adaptors/liteAdaptor'),
    import('mathjax-full/js/handlers/html'),
    import('mathjax-full/js/input/tex/AllPackages'),
  ])
  const adaptor = liteAdaptor()
  RegisterHTMLHandler(adaptor)
  const doc = mathjax.document('', {
    // AllPackages includes `noundefined` and `noerrors`, so unknown macros
    // and malformed input render as red text instead of throwing.
    InputJax: new TeX({packages: AllPackages}),
    // 'none' inlines every glyph path rather than referencing shared <defs>,
    // which keeps the markup within what react-native-svg handles reliably.
    OutputJax: new SVG({fontCache: 'none'}),
  })
  return {
    convert(tex, display) {
      return adaptor.outerHTML(doc.convert(tex, {display}))
    },
  }
}

function parseEx(value: string | undefined): number {
  const m = value?.match(/(-?\d*\.?\d+)ex/)
  return m ? parseFloat(m[1]) : 0
}

/**
 * Pulls the `<svg>` out of MathJax's `<mjx-container>` wrapper and reads its
 * metrics. The root `style` attribute (where MathJax puts vertical-align) is
 * dropped: react-native-svg does not understand it and the value is returned
 * separately.
 */
export function parseSvg(markup: string): TypesetResult | null {
  const svg = markup.match(/<svg[\s\S]*?<\/svg>/)?.[0]
  if (!svg) return null
  const open = svg.match(/^<svg[^>]*>/)?.[0] ?? ''
  const widthEx = parseEx(open.match(/\swidth="([^"]+)"/)?.[1])
  const heightEx = parseEx(open.match(/\sheight="([^"]+)"/)?.[1])
  const verticalAlignEx = parseEx(open.match(/vertical-align:\s*([^;"]+)/)?.[1])
  const cleanOpen = open.replace(/\sstyle="[^"]*"/, '')
  return {
    svg: cleanOpen + svg.slice(open.length),
    widthEx,
    heightEx,
    verticalAlignEx,
  }
}

const CACHE_MAX = 200
const cache = new Map<string, TypesetResult>()

function cacheKey(tex: string, display: boolean) {
  return `${display ? 'D' : 'I'}:${tex}`
}

/** Synchronous cache lookup, so already-seen math renders on first paint. */
export function getCachedTypeset(
  tex: string,
  display: boolean,
): TypesetResult | null {
  return cache.get(cacheKey(tex, display)) ?? null
}

/**
 * Typesets `tex`, loading the engine on first use. Resolves to null if the
 * engine fails outright (callers then keep showing the TeX source); ordinary
 * TeX errors still resolve, rendered by MathJax as red error text.
 */
export async function typeset(
  tex: string,
  display: boolean,
): Promise<TypesetResult | null> {
  const key = cacheKey(tex, display)
  const hit = cache.get(key)
  if (hit) return hit
  enginePromise ??= createEngine()
  const engine = await enginePromise
  let result: TypesetResult | null
  try {
    result = parseSvg(engine.convert(tex, display))
  } catch {
    result = null
  }
  if (result) {
    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    cache.set(key, result)
  }
  return result
}
