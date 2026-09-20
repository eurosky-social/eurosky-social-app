# Newsrooms

A publisher hub inside Mu. `/newsroom` is a landing page: an org switcher across
the top selects the cross-publisher explore spread (`/newsroom/explore`) or an
approved publisher to focus, and the focused org gets a
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
column is hidden - where the rail adapts to the scroll: the reporters list
collapses to a preview of the first few, fading out under a gradient with a
"Show all" toggle, and the "Your News" callout tightens to a single tappable
row. It resolves the focused org from the navigation state.

## Explore

`explore/` is the hub's cross-publisher surface, reached from the rail's first
tab and from the header menu. It answers a different question from a focused
newsroom page - not "what is this outlet running" but "what is being covered,
and by whom".

- Every registered publisher's feed is read at once
  (`useAllPublisherArticlesQuery`), sharing cache entries with each newsroom's
  own front page. On web that is one proxied fetch per publisher, so the page
  is heavier than a single newsroom; feeds that fail simply contribute nothing.
- Articles are grouped into **stories** (`explore/cluster.ts`): when several
  outlets run the same event, their articles collapse into one entry with the
  others as coverage. Matching is a headline-overlap heuristic, deliberately
  conservative, and can be replaced by an explicit signal (a shared Atmosphere
  thread, or a story id a publisher writes) without changing the UI.
- Stories are filed under **sections** (`explore/sections.ts`) read from the
  article's own RSS categories, then its URL path, then the publisher's
  registry categories. Nothing is inferred from the headline, and unmatched
  articles land in "More stories" rather than being guessed at.
- The lead is the story the most newsrooms are running (ties by recency), and
  it is the only story whose Atmosphere pull is looked up - one search, rather
  than one per article on the page.

The page opens straight on the news, laid out as a broadsheet rather than a
grid of cards: the rail, a department filter bar, then a lead band (the day's story, and beside it every other
newsroom's version of it followed by what else is developing) then bands of departments - three columns wide, alternating with a
single department run across the full width. Rules divide the bands and their
columns; nothing is boxed. Choosing a department (a chip, or a department's own
name) narrows the page to that section, which keeps the same shape: its own lead
band, then its stories as a grid of pictures and a closing pair of headline
columns. Every headline carries its newsroom above it and its time below, and a story covered elsewhere carries a "Full coverage" row that
expands into each other outlet's own headline.

### Entry from the news feed

The news feed (`/news`) carries the spread's entry point above its posts
(`components/ExploreEntryFrame.tsx`, rendered as the feed's list header): the
day's biggest cross-newsroom stories, then a row into `/newsroom/explore`. It
reads the same clustered stories the spread does, so the feed warms that page's
cache - and pays the same one-fetch-per-publisher cost. It renders nothing until
the feeds land, so it never holds the feed up.

### Layout

The spread is the one hub surface that is not a branded org space, so it runs
from the center column's left edge to the window's right edge: `DesktopRightNav`
renders nothing on this route, `Layout.Screen` is asked to skip its
center-column edges (`noCenterBorders`), and `explore/components/ExploreColumn.tsx`
sizes the page against the window, draws its left seam with the shell, and lays
the header out across it. Below the right-nav breakpoint - and on native - the
spread is just the center column and every band stacks into one column.

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
  by URL, the news feed's cross-links, publisher profiles, and the link chip on
  posts (below).
- Working category filter chips (filter both articles and the conversation).
- Production RSS edge proxy (see `services/rss/README.md`).
- Later, behind real demand: more `NewsroomSource` adapters (podcast, YouTube),
  an aggregate dashboard across newsrooms.

## Discovery from posts

Newsrooms surface from ordinary posts across the app: when any post's external
link embed points at a registered publisher's site (matched against the
registry's `domains`, subdomains included), the embed grows a small accent-tinted
chip (`components/NewsroomLinkChip.tsx`) linking to that org's newsroom. The
chip renders inside the embed's `ContentHider`, so moderated links hide it too.

## Article anchoring

Each article maps to a Bluesky thread by link match: `useArticleDiscussionQuery`
searches posts for the article URL and, when one of them is the publisher's own
post, treats it as the article's canonical thread (`anchor`). The discussion
block pins the anchor first - the publisher's post always wins the top slot -
and ranks the rest by their Atmosphere interactions (likes, reposts, replies,
quotes). The anchor also drives the social plumbing: "Join the conversation"
opens the composer as a reply into that thread, "Open the thread" beside it
links into the thread itself, and "Share this story" becomes a quote of it, so
all three grow one conversation instead of scattering. Every
navigation into the discussion - the block's header, and the post counts on
secondary articles - lands on a URL search showing all posts that feature the
article. The front page's featured story follows the same signal:
`useArticleDiscussionsQuery` totals each article's interactions,
decayed with a 24h half-life so fresher news can take the hero slot, and ties
fall back to newest. The
match depends on the publisher actually posting its articles; an explicit
article<->thread pairing (e.g. a record the publisher writes) can replace the
heuristic later without changing the UI.

## Open questions

- Where the "Approved publisher" gate is enforced once publishers self-curate
  (being in the registry is the gate today; a Mu-side allowlist or atproto
  attestation later).
