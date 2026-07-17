# Newsrooms

A publisher hub inside Mu. `/newsroom` is a landing page: an org switcher across
the top selects which approved publisher to focus, and the focused org gets a
magazine-style space that blends its editorial posts, its reporters' posts, and
(later) external sources - RSS, podcasts, YouTube - into one surface, with the
native Bluesky social layer (boosts, replies) woven through it. Each org is also
deep-linkable at `/newsroom/:didOrHandle`.

## Data model

One dataset: the **publisher registry (shared, operator-owned)** - a local list
in `publishers.ts` mapping each publisher to its account, reporters, categories,
and content sources. This is config, not user state, so it does not live in the
PDS.

There is deliberately no per-user newsroom state: with every registered
newsroom equally visible everywhere, a newsroom-level follow or subscription
would have no observable effect. If per-user state is ever added, it should
have exactly one job - e.g. pinning the publisher into the reader's `/news`
feed - live on the shared `social.mu.newsFeedPrefs` record rather than a new
collection, and gate record creation on explicit consent like the news feed
setup does.

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

`NewsroomScreen.tsx` (route `Newsroom`, paths `/newsroom` and
`/newsroom/:didOrHandle`) renders, top to bottom:

0. Org switcher (`components/NewsroomSwitcher.tsx`) - a rail of the registered
   publishers (real avatars). The URL is the single source of truth for the
   focused org; selecting one updates the route param via
   `navigation.setParams` (no remount) and re-themes the page in its accent. A
   menu behind the newsroom icon in the screen header offers the same switch
   from anywhere on the page (the rail scrolls away with the feed) and resets
   the scroll position.
1. Masthead - the publisher's live profile (avatar, name, verification badge,
   bio), category chips (display-only for now), and a regular account follow
   button tinted in the publisher accent while unfollowed.
2. Front page (`components/NewsroomFrontPage.tsx`) - latest RSS articles, a hero
   plus a list, from `useRssArticlesQuery`, with the lead story's in-network
   discussion (`ArticleDiscussion`) woven in.
3. "The conversation" - a `PostFeed` over `newsroom|<dids>`, merging the publisher
   account and its reporters via the news feed's round-robin `NewsFeedAPI`
   (`src/lib/api/feed/news.ts`). This is where the reporters surface.

The right rail (`components/NewsroomRightRail.tsx`) opens with the focused org's
reporters as followable profile cards (the merged feed blends their posts in;
the rail is where they surface as people), then the cross-network context: a
"Your News" link to the custom news feed (`/news`) and the live sports widget
(`features/liveSports`). It renders in the shell's right column on wide screens
(`RightNav` branches on the route) and inline above the conversation when that
column is hidden; it resolves the focused org from the navigation state.

## RSS

`rss/` holds the adapter: `config.ts` (proxy URL), `parse.ts` (a dependency-free
RSS 2.0 / Atom parser, since the app ships no XML library and native has no
DOMParser), and `types.ts`. Feeds are fetched client-side through a CORS proxy on
web (`services/rss/`); native fetches directly. A publisher with no reachable
feed simply renders no front page - the page still works as the conversation.

## Layout

- `publishers.ts` - registry, `NewsroomPublisher` / `NewsroomSource` types, and
  lookup / default / feed-did / rss-url helpers
- `queries.ts` - `useRssArticlesQuery`, `useArticleDiscussionQuery`, `useOgImageQuery`
- `NewsroomScreen.tsx` - composes switcher + masthead + front page + conversation
- `components/` - org switcher, masthead, front page, article discussion, right rail
- `rss/` - the RSS/Atom adapter

## Roadmap

- A real entry point into `/newsroom` (left nav item); today the hub is reached
  by URL, the news feed's cross-links, and publisher profiles.
- Working category filter chips (filter both articles and the conversation).
- Production RSS edge proxy (see `services/rss/README.md`).
- Later, behind real demand: more `NewsroomSource` adapters (podcast, YouTube),
  an aggregate dashboard across newsrooms.

## Article anchoring

Each article maps to a Bluesky thread by link match: `useArticleDiscussionQuery`
searches posts for the article URL and, when one of them is the publisher's own
post, treats it as the article's canonical thread (`anchor`). The discussion
block pins it first and its "Join the conversation" link lands in that thread,
"Share this story" becomes a quote of it (so shares grow one conversation
instead of scattering), and secondary articles show their post counts. The
match depends on the publisher actually posting its articles; an explicit
article<->thread pairing (e.g. a record the publisher writes) can replace the
heuristic later without changing the UI.

## Open questions

- Where the "Approved publisher" gate is enforced once publishers self-curate
  (being in the registry is the gate today; a Mu-side allowlist or atproto
  attestation later).
