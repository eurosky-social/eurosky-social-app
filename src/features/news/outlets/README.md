# Featured outlets

The outlets the news hub puts forward: a band of cards on the news page
(`/news/explore`) and the hub's **Outlets** tab (`/news/outlets`), a card per
outlet with its latest articles. The tabs themselves (`../hub/NewsHubTabs.tsx`)
are links between the two pages, not a pager.

## Where they come from

1. **The configured list**, `EXPO_PUBLIC_FEATURED_OUTLETS`: the news
   aggregator's slugs or the outlets' DIDs, in order, separated by commas or
   whitespace. Each is looked up as one outlet (`/api/outlets/{ref}`,
   `useDutchOutletsByRefQuery`); one the aggregator does not know is skipped.
2. **The publisher's newsrooms**, `EXPO_PUBLIC_PUBLISHER_API_URL`: the
   publisher's public `/api/newsrooms`, which lists the newsrooms an operator
   listed for the app. They fill in after the configured outlets, without
   repeating one (matched by slug or DID).

The news page shows `FEATURED_ON_NEWS_PAGE` (3) and only asks the publisher
when the configured list comes up short of that. The Outlets tab shows every
configured outlet and every listed newsroom.

`mergeFeaturedOutlets` (`featured.ts`) is the whole rule, and is what the tests
cover.

## Articles and links

A card's articles come from where its outlet was named: the aggregator's
`/api/outlets/{slug}/articles` for a configured outlet, the publisher's
`/api/newsrooms/{slug}/articles` (the feeds the newsroom shows on its page)
for a newsroom. Each opens the article page.

Every card leads to `/frontpage/{slug}`. The publisher's newsrooms are mirrored
into the aggregator under the same slug, so a newsroom's frontpage resolves
there like any other outlet's.

## Files

- `config.ts` - the two variables, and how many outlets and articles to show
- `newsrooms.ts` - the publisher's API: newsrooms and their articles
- `featured.ts` - the merge, `useFeaturedOutlets`, `useFeaturedOutletArticles`
- `components/FeaturedOutletsBand.tsx` - the news page's band
- `components/FeaturedOutletCard.tsx` - one card in it
- `components/OutletArticlesCard.tsx` - one outlet on the Outlets tab
- `index.tsx` - the Outlets tab, three cards across on a wide screen

Tests: `pnpm test --runInBand src/features/news/outlets`.
