# News

The news section and the article data shared with the outlets' frontpages
(`../frontpages/`). The section lives at `/news/explore`; the original news
feed it grew out of is `../newsFeed/` (`/news`).

- `explore/` - the news page: stories clustered across outlets, by section
- `article/` - an article page, with every outlet's coverage of its story
- `dutch/` - the news aggregator's API (see its README)
- `rss/` - the RSS/Atom adapter, the source without the aggregator
- `publishers.ts` - the publisher registry: brand extras and fallback feeds
- `queries.ts` - RSS articles, article discussion, OG images, site icons
- `components/ArticleDiscussion.tsx` - an article's in-network discussion

## Explore

`explore/` is the news page (`/news/explore`), reached from the left
nav's news item. It answers a different question from a frontpage - not "what is this outlet running" but "what is being covered,
and by whom".

- Every registered publisher's feed is read at once
  (`useAllPublisherArticlesQuery`), sharing cache entries with each outlet's
  frontpage. On web that is one proxied fetch per publisher, so the page
  is heavier than a single frontpage; feeds that fail simply contribute nothing.
- Articles are grouped into **stories** (`explore/cluster.ts`): when several
  outlets run the same event, their articles collapse into one entry with the
  others as coverage. Matching is a headline-overlap heuristic, deliberately
  conservative, and can be replaced by an explicit signal (a shared Atmosphere
  thread, or a story id a publisher writes) without changing the UI.
- Stories are filed under **sections** (`explore/sections.ts`) read from the
  article's own RSS categories, then its URL path, then the publisher's
  registry categories. Nothing is inferred from the headline, and unmatched
  articles land in "More stories" rather than being guessed at.
- The lead is the story the most outlets are running (ties by recency), and
  it is the only story whose Atmosphere pull is looked up - one search, rather
  than one per article on the page.

The page opens straight on the news, laid out as a broadsheet rather than a
grid of cards: a filter bar - the location picker (see "Locations") followed
by the department chips - then a lead band (the day's story, and beside it every other
outlet's version of it followed by what else is developing) then bands of departments - three columns wide, alternating with a
single department run across the full width. Rules divide the bands and their
columns; nothing is boxed. Choosing a department (a chip, or a department's own
name) narrows the page to that section, which keeps the same shape: its own lead
band, then its stories as a grid of pictures and a closing pair of headline
columns. Every headline carries its outlet above it and its time below, and a story covered elsewhere carries a "Full coverage" row that
expands into each other outlet's own headline.

### Boosting from the news settings

The header's Settings button opens `/news/settings`, the news feed's own setup
(topics, regions, then the accounts they select), so both surfaces share the one
set of news prefs (`newsFeed/state/prefs.ts`). The page reads it to reorder stories, never
to hide them (`explore/boost.ts`): each kind of interest a story matches - its
section is one of the reader's topics, it is placed in a picked province (or
is Dutch at all, with the Netherlands picked), or one of its outlets is a selected account (by DID, or by the
account's handle as the outlet's domain) - moves it a fixed number of places up.
Topics map onto both the labeler's themes and the RSS sections; a topic or
region with no counterpart on a story boosts nothing.

### Languages

The app's content languages filter every story on the page, whatever the
location, and the labeler applies them: every read sends them all as `lang=`
with `articles=matching` (`dutch/view.ts`), so it returns only threads with an
article in one, shows only those articles, and names a lead in one of them
(`leadIn`). The article page reads its story's thread in the same view, which
the story carries to it (`storyView`). RSS articles carry no language, so the
RSS spread is not filtered.

### Locations

The location picker and the settings' regions are one list: `NEWS_REGIONS` in
`features/newsFeed/sources.ts`, which carries the Dutch provinces as well as the
countries (a province's id is the labeler's label value, e.g. `nl-utrecht`,
and its `parent` is `netherlands`). The picker offers the world first, then the
regions picked in the settings (`explore/locations.ts`, `pickerRegions`); with
none picked, it offers everything it can show.

A region is only offered where the page can show it on its own
(`sourceForRegion`): the world reads the labeler's `all` scope (RSS without
the labeler), the Netherlands its `dutch` scope, and a province that scope
filtered by the server to the province, and another country the `all` scope
narrowed to the threads its outlets covered (`country=`, ranked by `here`).
Europe has no such filter, so it boosts stories without being a place to go. Without the
labeler only the world is left, and the picker is hidden.

### Entry from the news feed

The news feed (`/news`) carries the spread's entry point above its posts
(`components/ExploreEntryFrame.tsx`, rendered as the feed's list header): the
day's biggest cross-outlet stories, then a row into `/news/explore`. It
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
feed simply renders no articles on its frontpage - the page still works as the conversation.

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
article. A frontpage's featured story follows the same signal:
`useArticleDiscussionsQuery` totals each article's interactions,
decayed with a 24h half-life so fresher news can take the hero slot, and ties
fall back to newest. The
match depends on the publisher actually posting its articles; an explicit
article<->thread pairing (e.g. a record the publisher writes) can replace the
heuristic later without changing the UI.

