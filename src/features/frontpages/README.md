# Frontpages

A publisher hub inside Mu. `/frontpage` is a landing page: an org switcher across
the top selects the cross-publisher explore spread (`/news/explore`) or an
approved publisher to focus, and the focused org gets a
magazine-style space that blends its editorial posts, its reporters' posts, and
(later) external sources - RSS, podcasts, YouTube - into one surface, with the
native Bluesky social layer (boosts, replies) woven through it. Each org is also
deep-linkable at `/frontpage/:didOrHandle`.

## Data model

The frontpages are the **news aggregator's outlets** (`/api/outlets`): every
outlet it reads has a frontpage, and nothing else does (`frontpages.ts`,
`useFrontpages`). A frontpage is addressed by the outlet's slug,
`/frontpage/<slug>`; its account's DID or handle resolve to it too. Without the
aggregator configured, or signed out, there are no frontpages: no pages, link
chips or profile shortcuts.

- **Masthead** - the outlet's live Bluesky profile where it has an account,
  otherwise its name and site. The topic chips are the themes it has the most
  current stories in.
- **Articles** - its latest articles from the aggregator
  (`/api/outlets/{slug}/articles`), each opening onto the story it is in.
- **Reporters** - the accounts the aggregator files under the outlet
  (`sources.accounts`, set with `PUT /api/outlets/{slug}/accounts`), any added
  by hand in `publishers.ts`, and, for an outlet that is a Bluesky trusted
  verifier, the journalists it has verified (its `app.bsky.graph.verification`
  records, read from its own repo).
- **Conversation** - its account's posts and a bounded few of its reporters';
  an outlet with neither has none.

`publishers.ts` holds no list of frontpages any more: only brand extras the
aggregator does not (accent, reporters), matched by DID, and the RSS feeds the
explore page falls back to without the aggregator.

There is deliberately no per-user frontpage state; the reader's interests (see
`newsFeed/`) already say which outlets they follow.

## The idea

The page answers "why come here instead of the home feed or the publisher's own
site": it puts the outlet's **real published journalism** and the **in-network
discussion around it** in one place.

- Editorial spine = the publisher's actual RSS/Atom feed. The outlet already
  curates its own front page; we render it rather than inventing a curation
  surface. Articles link out to the real pieces.
- Social layer = the publisher's and its reporters' Bluesky posts, the native
  conversation that the home feed and the outlet's own site don't have together.

Everything on the page is real data. There are no fabricated widgets.

## Page structure

`FrontpageScreen.tsx` (route `Frontpage`, paths `/frontpage` and
`/frontpage/:didOrHandle`) renders, top to bottom:

0. Org switcher (`legacy/FrontpageSwitcher.tsx`) - a rail of the registered
   publishers (real avatars). The URL is the single source of truth for the
   focused org; selecting one updates the route param via
   `navigation.setParams` (no remount) and re-themes the page in its accent. A
   menu behind the frontpage icon in the screen header offers the same switch
   from anywhere on the page (the rail scrolls away with the feed) and resets
   the scroll position.
1. Masthead - the publisher's live profile (avatar, name, verification badge,
   bio), category chips (display-only for now), and a regular account follow
   button tinted in the publisher accent while unfollowed.
2. Articles (`components/FrontpageArticles.tsx`) - latest RSS articles, a hero
   plus a list, from `useRssArticlesQuery`, with the lead story's in-network
   discussion (`ArticleDiscussion`) woven in.
3. "The conversation" - a `PostFeed` over `frontpage|<dids>`, merging the publisher
   account and its reporters via the news feed's round-robin `NewsFeedAPI`
   (`src/lib/api/feed/news.ts`). This is where the reporters surface.

The right rail (`components/FrontpageRightRail.tsx`) opens with the focused org's
reporters as followable profile cards (the merged feed blends their posts in;
the rail is where they surface as people), then the cross-network context: a
"Your News" link to the custom news feed (`/news`) and the live sports widget
(`features/liveSports`). It renders in the shell's right column on wide screens
(`RightNav` branches on the route) and inline above the conversation when that
column is hidden - where the rail adapts to the scroll: the reporters list
collapses to a preview of the first few, fading out under a gradient with a
"Show all" toggle, and the "Your News" callout tightens to a single tappable
row. It resolves the focused org from the navigation state.

## Layout

- `frontpages.ts` - the frontpages (the aggregator's outlets), lookups, paths
  and reporters
- `FrontpageScreen.tsx` - composes masthead + articles + conversation
- `components/` - masthead, articles, link chip, right rail
- `directory/` - the outlet directory (`/outlets`)
- `useProfileFrontpagePath.ts` - the profile header's frontpage shortcut
- `legacy/` - the original newsroom pages, served with news v2 off

The publisher registry, RSS adapter and article queries are shared with the
news section and live in `../news/`.

## Roadmap

- A real entry point into `/frontpage` (left nav item); today the hub is reached
  by URL, the news feed's cross-links, publisher profiles, and the link chip on
  posts (below).
- Working category filter chips (filter both articles and the conversation).
- Production RSS edge proxy (see `services/rss/README.md`).
- Later, behind real demand: more `PublisherSource` adapters (podcast, YouTube),
  an aggregate dashboard across frontpages.

## Discovery from posts

Frontpages surface from ordinary posts across the app: when any post's external
link embed points at a registered publisher's site (matched against the
registry's `domains`, subdomains included), the embed grows a small accent-tinted
chip (`components/FrontpageLinkChip.tsx`) linking to that org's frontpage. The
chip renders inside the embed's `ContentHider`, so moderated links hide it too.

## Open questions

- Where the "Approved publisher" gate is enforced once publishers self-curate
  (being in the registry is the gate today; a Mu-side allowlist or atproto
  attestation later).
