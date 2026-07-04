# Curated Pages

A publisher hub inside Mu. `/newsroom` is a landing page: an org switcher across
the top selects which approved publisher to focus, and the focused org gets a
magazine-style space that blends its editorial posts, its reporters' posts, and
(later) external sources - RSS, podcasts, YouTube - into one surface, with the
native Bluesky social layer (boosts, replies) woven through it. Each org is also
deep-linkable at `/newsroom/:didOrHandle`. Readers opt in to publishers they follow.

## Data model

Two datasets, split exactly like the news feed:

- **Publisher registry (shared, operator-owned)** - a local list in
  `publishers.ts` mapping each publisher to its account, reporters, categories,
  and content sources. This is config, not user state, so it does not live in
  the PDS.
- **Reader selections (per-user, synced)** - which publishers the reader
  subscribes to, stored as an atproto record in the user's PDS: collection
  `social.mu.curatedPagesPrefs`, rkey `self`. See `state/prefs.ts`.

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

`CuratedPageScreen.tsx` (route `CuratedPage`, paths `/newsroom` and
`/newsroom/:didOrHandle`) renders, top to bottom:

0. Org switcher (`components/CuratedOrgSwitcher.tsx`) - a fixed rail of the
   registered publishers (real avatars) plus a "+" directory menu. The focused
   org is local state for instant switching; selecting one re-themes the page in
   its accent and syncs the URL via `navigation.setParams` without remounting.
1. Masthead - name, tagline, approved badge, Follow, category chips, accent-tinted.
2. Front page (`components/CuratedFrontPage.tsx`) - latest RSS articles, a hero
   plus a list, from `useRssArticlesQuery`, with the lead story's in-network
   discussion (`ArticleDiscussion`) woven in.
3. "The conversation" - a `PostFeed` over `curated|<dids>`, merging the publisher
   account and its reporters via the news feed's round-robin `NewsFeedAPI`
   (`src/lib/api/feed/news.ts`). This is where the reporters surface.

The right rail (`components/CuratedRightRail.tsx`) is the cross-network context,
deliberately distinct from the focused org: a "Your News" link to the custom
news feed (`/news`) and the live sports widget (`features/liveSports`). It
renders in the shell's right column on wide screens (`RightNav` branches on the
route) and inline above the conversation when that column is hidden.

## RSS

`rss/` holds the adapter: `config.ts` (proxy URL), `parse.ts` (a dependency-free
RSS 2.0 / Atom parser, since the app ships no XML library and native has no
DOMParser), and `types.ts`. Feeds are fetched client-side through a CORS proxy on
web (`services/rss/`); native fetches directly. A publisher with no reachable
feed simply renders no front page - the page still works as the conversation.

## Layout

- `publishers.ts` - registry, `CuratedPublisher` / `CuratedSource` types, and
  lookup / default / feed-did / rss-url helpers
- `state/prefs.ts` - prefs record schema + read/write/toggle hooks
- `queries.ts` - `useRssArticlesQuery`, `useArticleDiscussionQuery`, `useOgImageQuery`
- `CuratedPageScreen.tsx` - composes switcher + masthead + front page + conversation
- `components/` - org switcher, masthead, front page, article discussion, right rail
- `rss/` - the RSS/Atom adapter

## Roadmap

- A real entry point into `/newsroom` (left nav item); today the hub is reached
  only by URL. The org switcher and directory menu already exist.
- Working category filter chips (filter both articles and the conversation).
- Anchor each RSS article to a Bluesky discussion thread so the conversation
  attaches to specific pieces, not just the publisher's latest posts. This is
  the core differentiator and the next thing worth proving.
- Production RSS edge proxy (see `services/rss/README.md`).
- Later, behind real demand: more `CuratedSource` adapters (podcast, YouTube),
  an aggregate dashboard across subscriptions.

## Open questions

- Where the "Approved publisher" gate is enforced once publishers self-curate
  (registry flag today; a Mu-side allowlist or atproto attestation later).
- How a publisher's RSS articles map to Bluesky threads for discussion - by the
  publisher posting each article (link match), or an explicit pairing.
