# Dutch news (oso)

The newsroom hub backed by the Dutch labeler rather than by RSS. This is the
`oso` variant of `/newsroom/explore`: the same spread, fed by a service that has
already done the work the eurosky version does client-side.

**Status: wired, unverified.** The adapter, queries and hooks are real, and the
spread reads them wherever the API is configured. Nothing has been run against
live data yet: reads need a service-auth token whose audience is the service's
real DID, which we do not have (see "Access").

## Why this is not just another source

The eurosky spread reads raw RSS and infers structure from it. The labeler
serves that structure directly, so three of our heuristics become reads:

| eurosky explore                          | Dutch labeler                                     |
| ---------------------------------------- | ------------------------------------------------- |
| `cluster.ts` headline-overlap heuristic  | `story` clusters, BERTopic over sentence embeddings, refit every six hours |
| `sections.ts` keyword matching           | `theme`, assigned by nearest prototype embedding   |
| `useArticleDiscussionsQuery`, one search per story | `story.posts`, matched by embedding similarity and delivered with the story |
| -                                        | `category`: `dutch`, plus a label value per province |

The newsroom README already anticipated the first of these: clustering "can be
replaced by an explicit signal ... without changing the UI". This is that
signal. It also settles the cost problem that kept engagement counts on the lead
story only - `counts.posts` arrives on every story, so the spread can show
discussion volume everywhere without one search per article.

## The seam

`useExploreSource()` is the whole integration surface. It returns
`{stories, sections, isLoading}`, and every component below it renders an
`ExploreStory` without knowing where the story came from. The Dutch source takes
over wherever its API is configured; otherwise the spread reads RSS exactly as
before. Both hooks run either way, because hooks must, but the inactive one
fetches nothing - `useExploreStories({enabled})` threads that down to the
per-publisher feed queries.

Making one set of components serve both meant widening `ExploreArticle`.
It carried a full `NewsroomPublisher` - a registry entry with a `did`,
`reporterDids` and `domains` - because every eurosky publisher owns a Bluesky
account. The labeler ingests around a hundred outlets by feed alone, most with
no account at all. The components turned out to need only three of those fields,
so `ExploreArticle.publisher` is now an `ExploreOutlet` (`explore/cluster.ts`),
which `NewsroomPublisher` satisfies structurally.

What that costs, and how it is paid:

- `did` is optional, so `outletProfile()` replaces the direct
  `profiles.get(publisher.did)` lookups and keeps the absent-account check in
  one place.
- An outlet with no account has no newsroom page to open and no avatar to show,
  so `PublisherLabel` credits it in text alone rather than as a dead link.
- Outlets have no stable id in the API - they are identified by display name and
  site URL - so `outletFor` keys them on the registrable host. Two articles from
  one site must collapse to one outlet or the story's newsroom count inflates.

## Sections

`themeSections()` builds the spread's sections from `/api/themes` rather than
from a hardcoded list, because the themes are already one curated vocabulary -
there is nothing to normalize. A theme added in the pipeline shows up on the
page with no change here.

That makes the section labels data rather than `msg` descriptors, which a
build-time extractor cannot see. The API serves `name` and `nameNl`, so the
picking is a runtime choice against the active locale, not a Lingui one.

## Provinces

The axis the eurosky spread has no equivalent for. Every story carries
`provinces`, a label value to count, and `/api/stories?category=nl-utrecht`
filters to one. This maps onto the existing department chip bar as a second row
or a filter behind it, and is the most obviously "oso" thing in the design -
worth deciding on before the layout work.

## Access

Reads are authenticated. The service takes an **atproto service-auth JWT**, so
the news view is for signed-in users rather than for anyone - which is why the
API was answering with a redirect rather than with data. Exactly which DIDs it
will accept is still being settled. Note the current
deployment fronts `/api/*` with a Google oauth2-proxy (302 to `/oauth2/start`
-> `accounts.google.com`), not atproto service-auth, so the bearer token is not
honored yet - `fetchDutchApi` stops at that redirect and names it. The
`/xrpc/*` surface (labels, `_health`) is exempt and already public.

`queries.ts` mints one per call with `com.atproto.server.getServiceAuth`,
following `ageAssurance/muAgeService`: no `exp` is passed, so the PDS derives
both `iat` and `exp` from its own clock and the token cannot be invalidated by
client clock skew. Tokens are short-lived, so each request mints its own rather
than caching one. Service auth works the same on OAuth and app-password
sessions, and `useMaybePdsClient()` is null when signed out, which disables
every Dutch query.

Three things still needed from the service:

1. **Its real service DID**, for the token's `aud`
   (`EXPO_PUBLIC_DUTCH_API_SERVICE_DID`). The labels currently carry
   `did:web:dutch-labeler.invalid`, a placeholder, so it cannot be read off
   them.
2. **Whether it pins an `lxm`.** `lxm` scopes a token to one lexicon method so
   it cannot be replayed against another service; the consumer API is REST and
   has no natural NSID. `EXPO_PUBLIC_DUTCH_API_LXM` sets one if the service
   wants one, and is otherwise left unset.
3. **CORS, including the `Authorization` header.** A web build is a browser
   client, so the service needs to allow the app's origin and that header on
   `/api/*`, preflight included. Native is unaffected. If the answer is to put a
   passthrough in front instead, `services/rss/` is the pattern to mirror
   (`dev-proxy.mjs` locally, `bunny/` at the edge) - though a proxy must forward
   the token rather than strip it.

The one endpoint that needs none of this is the atproto label endpoint, which is
already public:

```
/xrpc/com.atproto.label.queryLabels?uriPatterns=*   200
```

It serves real labels (`dutch`, `nl-drenthe`, on outlet article URLs) but only
`{uri, val, cts}` - enough to know a URL is Dutch and regional, not enough to
render the news view.

Note also that requiring a session makes this source unavailable to logged-out
readers, where the RSS spread is not. Worth deciding whether `/newsroom/explore`
should fall back to RSS when signed out rather than render empty.

## Files

- `types.ts` - the API shapes the hub reads, mirroring the service's OpenAPI
- `config.ts` - base URL and whether the source is configured at all
- `adapt.ts` - pure mapping from an API story onto the page's shape
- `adapt.test.ts` - the mapping's edge cases, no network
- `queries.ts` - stories, themes and categories, following `state/queries` conventions
- `useDutchExploreStories.ts` - the stories and sections, in the spread's shape

and, outside this directory:

- `explore/useExploreSource.ts` - picks the source the page reads
- `explore/cluster.ts` - `ExploreOutlet` and `outletProfile`, shared by both

## Next

1. Get the service DID and, if it pins one, the `lxm`; set
   `EXPO_PUBLIC_DUTCH_API_SERVICE_DID` and `EXPO_PUBLIC_DUTCH_API_URL`. Until
   both are set the spread stays on RSS.
2. Confirm CORS allows the app origin and the `Authorization` header on
   `/api/*`, or put a token-forwarding passthrough in front.
3. Check the spread against real stories - particularly the outlet keying, which
   assumes one site is one newsroom.
4. Decide the signed-out story: this source needs a session, the RSS one does
   not.
5. Decide how provinces reach the chip bar: `/api/stories?category=nl-utrecht`
   filters server-side, and `useExploreSource` already takes a `category`.
6. Decide the theme label locale. The API serves `name` and `nameNl`; the page
   currently takes `name`, which is wrong for a Dutch-language build.
7. `story.posts` arrives with every story and nothing renders it yet - this is
   where the discussion the spread previously had to search for goes.
