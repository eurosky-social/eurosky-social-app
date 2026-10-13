# News Feed

A curated news experience: the user picks topics and regions, optionally opts
out of specific sources, and gets a feed of posts from an approved set of
accounts matching those facets.

## Data model

Two datasets, deliberately stored differently:

- **User selections (Dataset 1)** - per-user, synced. Stored as a published
  atproto record in the user's PDS: collection `social.mu.newsFeedPrefs`,
  rkey `self`. See `state/prefs.ts`.
- **Source registry (Dataset 2)** - shared, operator-curated config mapping
  accounts to topic / region / language tags. Local list in `sources.ts`. This
  is not a user preference, so it does not live in the PDS.

Topics are the news aggregator's themes (`/api/themes`), by slug, everywhere:
the topic step lists them, the registry tags accounts with them, and the news
page's sections are them. The app keeps no topic list of its own; `ALL_TOPICS`
is every topic. Records written before carry the old topic ids, which
`topicsAsThemes` reads as themes (`sports` as `sport`, `general` dropped).

Topic matching is account-level (a source is tagged with the themes it covers;
an account tagged with none is general news, shown for every topic only).
`languages` narrows the accounts to those publishing in one of them, and on the
news page keeps only the stories with an article in one of them, led by that
article. The feed still also applies the app's content language preference
(`languagePrefs.contentLanguages`) at feed-assembly time.

## Flow

1. Topic / region picker -> chooses `topics` and `regions` into a draft. Nothing
   is written yet.
2. Source review -> `selectSources(selection, {applyExclusions: false})` lists
   the matching accounts so the user can toggle individual ones into
   `excludedDids`. Finishing requires an explicit consent toggle, which then
   publishes the full draft as the prefs record.
3. Feed -> `selectSources(selection)` resolves the source set; a FeedAPI pulls
   each source's author feed and round-robins across them so every source gets
   equal representation, filtered by the user's content languages.

## Interests (news page)

The news page reads the news aggregator, so its settings (`/news/settings`,
`components/interests/`) are interests rather than topics and accounts: each a
slice of the news by countries, the aggregator's themes, and the outlets of
those countries, every one of them in until unticked. They are set in a
three-step wizard, which the settings open on while there are none, and
stored as `interests` in the same record.

On the page a dropdown ahead of the topic chips picks one interest, the first
by default. When it covers the Netherlands, a second dropdown narrows it to a
province; that choice is not saved. The page's languages are the app's content
languages (`languagePrefs.contentLanguages`), which the settings link to
rather than keeping a list of their own; the record's `languages` is the news
feed's.

`newsrooms/explore/interests.ts` turns an interest into reads of
`/api/threads`. The API takes several countries and outlets per read but one
theme and one province, so an interest is one read per theme (and province),
and the page merges them rank by rank. The outlet step reads, from
`/api/outlets`, how many current stories each outlet has on each theme, and
leads with the outlets that cover the interest's topics. Without the
aggregator configured, the settings fall back to the news feed's setup below.

## Layout

- `sources.ts` - registry + taxonomy + `selectSources`. The regions include
  the Dutch provinces, which select the same accounts as the Netherlands; the
  news page's location picker offers the regions picked here
- `state/prefs.ts` - prefs record schema + read/write hooks
- `NewsFeedScreen.tsx` - shows the setup, then the feed; an unconfigured feed
  drops straight into setup
- `NewsSettingsScreen.tsx` - the same setup at `/news/settings` (route
  `NewsSettings`), opened from the news page's header; it returns there on save
- `components/` - `NewsFeedSetup` (step 1 topics/regions -> step 2 sources ->
  save, shared by both screens), `SetupHeader` (step indicator), `SetupTopics`
  (chip picker),
  `SetupSources` (opt-out list + consent), `SetupFooter` (bottom action bar),
  `NewsFeedTab` (header + feed)

The feed itself renders through the standard `PostFeed` via a `newsfeed|<dids>`
`FeedDescriptor`; the aggregation lives in `src/lib/api/feed/news.ts`
(`NewsFeedAPI`), wired into the factory in `state/queries/post-feed.ts`. The
screen is reachable at `/news` (route `NewsFeed`) from the desktop left nav and
the mobile drawer.

## Not yet done

- The news feed is its own screen/route, not a tab inside the home swipe-pager.
