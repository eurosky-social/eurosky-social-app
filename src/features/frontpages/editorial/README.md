# Editorial frontpages

The account-backed publication detail layout for news v2 frontpages. It uses the
news explore geometry across the center and right columns, with a compact
masthead and ruled story columns.
Small screens stack the spread. Ordinary account profiles remain unchanged.

## Try it

- `/frontpage/editorial-test` - the test account seeded with WIRED links.
- `/frontpage/wired.com` - WIRED, resolved through the active publication registry.
- `/newsroom/:name` - the existing alias for the same publication detail page.

`../PublicationScreen.tsx` supplies the account and publication name. With news
v2 disabled, the original newsroom layout is served instead. The name
and avatar open the normal profile. Follow appears on the right for other
accounts. **Edit front page** is shown to the owner (see Editing). The masthead has no extra
News/Conversation/Profile/refresh/menu action strip. The publication/reporters'
conversation and contextual rail remain accessible at `?view=conversation`.
The full bio, follower counts and normal profile actions remain on the profile.

## Content

This presents the publication account's **own posts** on its frontpage. The
editorial renderer is only used with news v2 enabled. Accountless aggregator
outlets retain their existing article renderer. It reads the standard moderated
author-feed query/cache, using
external-link metadata for article headlines and images, or native photos,
galleries, videos and text when there is no link preview. Photo sets use the
shared carousel and lightbox; native videos use the shared inline player.
Native posts show their full text above their media in smaller, regular-weight
post typography. Links, hashtags and mentions use the normal accented rich-text
rendering. Interactive media and quote cards (including unavailable-quote
placeholders) sit outside navigation links. Replies and reposts are excluded;
duplicate article destinations are collapsed, including common tracking,
fragment, www, protocol and trailing-slash variations. Meaningful query parameters
are retained; saved editorial picks win over unselected duplicate arrivals.
Pagination uses the same author-feed query. No RSS requests, HTML scrapes or synthetic engagement are added.

Headlines and external-preview images open the original article. Small articles
on mobile use a compact thumbnail beside the headline; medium and big stories
keep the full image layout. The date sits inline with ghost comment, repost and
like buttons. Their counts use the normal post formatter (for example, 1.5K), beneath each article or
native post. Comments open the social thread;
repost and like counts open their respective people lists. There is no separate Read story button. Profile and post
moderation, external-card labels, deletion shadows and shared follow controls
remain in use. Blocked accounts do not fetch stories.

## Editing

Only the signed-in publication owner sees **Edit front page**. Demo builds
with `EXPO_PUBLIC_ENABLE_FRONTPAGE_DEMO_EDIT=true` (`../config.ts`) show it to
everyone so they can try the layout locally; there, only the owner sees
**Publish changes**, other viewers have a single **Discard** action, and their
previews cannot write a layout. Switching
accounts discards the draft. In edit mode:

- Desktop editing controls appear on article hover or keyboard focus. Insertion
  + buttons appear when the pointer is nearby or the button has focus. Touch and
  native screens keep controls visible.
- Drag the top-left grip to reorder stories. The first story becomes the lead.
  Pointer events support mouse and touch; arrow keys, Home and End work from a
  focused grip. Escape or a cancelled pointer gesture leaves the order unchanged.
- The + buttons between stories open the add dialog in two steps: first what
  goes in the spot, one of four components, **Post**, **Feed** (the feed's
  card with its latest posts), **Starter pack** (its people or posts) or
  **Featured feeds** (several feeds in one card), then that kind's own picker,
  headed by the kind chosen, with **Change component** leading back to the
  choice. A carousel skips the choice, since it holds posts only. The post
  picker finds posts in three places, **Your posts** (the account's
  originals), **From a feed** and **From a starter pack**: the last two first
  pick a feed or a starter pack, then list its original posts, by any account,
  so a story found in a feed can be pinned on the page. The feed lists combine
  pinned feeds (including other creators' feeds) and feeds created by the account.
  Pinned items are disabled; a post on the page automatically can be picked,
  which pins it at that place. Filtering and loading older picker pages
  use a separate query, so browsing the archive does not insert posts.
- Feed slots show their first two visible posts and a **Show more** link to the
  feed. Starter-pack slots default to six real members with aligned avatars and
  names. Their display menu switches between **People** and **Latest posts**;
  the latter shows two posts from the pack's people list and opens the starter
  pack's Posts tab via **Show more**. This choice is saved per slot. A three-person
  icon and **Follow all** action head the pack; following reads the complete list,
  excluding self, existing follows, muted/blocked and opted-out members. In People
  mode an **X more** link uses the actual member count and opens the full pack.
- The adjacent size picker offers small, medium and big. The lead supports medium
  (two-thirds width) or big (full width). Small stories pair in half-width rows,
  or occupy a narrower sidebar beside a medium story. A medium story can have two
  small companions. Mobile keeps the reading order and stacks all stories.
- The page is a list of **sections**. A section shows its pinned stories
  first, in order, then stories from its fill source until it reaches its
  length. **Fill** is a menu: **Don’t fill**, **Your posts** (the account's own,
  newest first), or one of the editor's pinned feeds. Each source is shared down
  the page in order, and no story shows twice. Room with nothing to fill it
  collapses, and a section with nothing showing is not shown to readers.
- A section is a grid of stories or a **carousel**: a row of post cards that
  scrolls sideways, holding posts only (no feeds or starter packs), and never
  the page's lead. An untitled section has no header for readers; a titled one
  opens with a heavy rule, its title and an optional description. The lead is
  the first story in the page's first non-empty grid.
- In the editor each section is framed, with its name, **Spots**, **Fill**,
  rename (title, description, and grid or carousel), move up/down and remove
  above its stories. **Spots** is a fixed number, typed into its box or
  stepped with the **−** and **+** either side of it, or, for the page's last
  section only, **Infinite**, from the menu beside the box: every story its source has, with **More stories**
  loading older posts when it fills with the account's own. A section that
  stops being last gets 24 spots. A fixed section's bottom edge is a bar to drag
  down for more spots and up for fewer (or use the arrow keys on it); it cannot
  hold fewer stories than it pins.
- A fixed section that **doesn't fill** shows its open spots in the editor as
  empty, dashed story shapes after its stories, so a section of five spots
  looks like one. Over each, on hover or focus with a mouse and always on
  touch, are the four components, **Post**, **Feed**, **Starter pack** and
  **Featured feeds**, each opening the add dialog already at its step;
  **Change component** still leads back to the choice. A carousel's empty
  spots offer only **Post**. Stories are pinned in order, so a
  new one takes the first open spot whichever empty spot was used. Readers
  never see empty spots.
- A **featured-feeds card** is a slot holding several feeds: a heading (its
  title, or *Featured feeds*) and each feed with its avatar, name, creator and
  pin button, opening the feed. Its step of the add dialog picks from the
  editor's pinned feeds and the account's own feeds, in the order chosen, up
  to twelve, with an optional title; the card's pencil reopens that step with
  the card's feeds and title. The card can be dragged, sized
  and removed with its X like a feed slot, and never goes in a carousel. **Add section** adds one above the first or
  below any section; a page always keeps one. Older posts load as needed to
  fill fixed sections with your posts.
- The **+** between two stories of a grid section also offers **Split into new
  section**: the section ends there, and the stories below, pinned or
  automatic, move into a new untitled section filled the same way, so nothing
  on the page moves. An infinite section's lower part stays infinite.
- Automatic stories are grey and faded. One of the account's own posts has an
  **Automatic** tag and **Pin**, which moves it to the end of the section's
  pinned stories. A pinned story, feed, starter pack or card has a top-right
  trash button, which removes it (a post goes back to the automatic ones when
  its section fills), and a pencil, which reopens the add dialog at its own
  kind's step to put something else in its place: another post, feed or
  starter pack, a card's new feeds and title, or, after **Change component**,
  another kind. Another account's post that a feed filled in can be pinned
  and dragged like the account's own. Dropping a story
  among the pinned ones puts it exactly there; dropping it among the automatic
  ones, or on the end of a section, puts it at the end of the pinned ones. The
  section keeps its length; a story moved out of another section leaves its
  room to that section's fill.
- **Show cover photo at the top** fills the top of the page, edge to edge of
  the spread, with the account's banner at 3:1. It is on for a page nobody has
  arranged, needs a banner, and is never shown for a banner the reader's moderation would blur.
- There is no hiding: a post is pinned or automatic.
- Reordering, pinning and resizing animate with FLIP transitions, even
  across columns. Reduced-motion preferences disable these transitions. The page
  uses document scrolling only, including edge auto-scroll while dragging.
- **Preview** shows the draft as readers will see it: no frames, controls, grey
  stories or empty sections. **Back to editing** returns to the same draft;
  the owner can also publish from the preview.
- Changes are local until the owner chooses **Publish changes**. Cancel or
  Discard leaves the public layout untouched.

Published choices live in the owner's public `social.mu.frontpage/self` record,
version 3: `cover`, and `sections`, each with `pinned` (URIs, in order),
`length` (a number, or `infinite` for the last section), `fill` (`none`, `own`
or `{feed}`) and, for a carousel, `kind`. A page with featured-feeds cards is
written as version 4, which adds `featured`, the cards (`id`, optional `title`,
`feeds`), each pinned as `featured:<id>`; a card nothing pins is dropped, and
builds before version 4 show the retry state for such a page. A page without
cards is still written as version 3.
Earlier shapes are read and rewritten on publishing: version 2 sections of
slots become their pinned slots first, at the same length, filled with the
account's posts or not at all; version 1's single `order` list, with
`section:<id>` headers, becomes sections, with what came before any header as
an untitled first section and the section new posts went to filled. App builds
from before a version cannot read it and show the retry state.
Readers resolve that account's PDS, not their own preferences. Referenced older
posts are hydrated in batches of at most 25 and still use the usual moderation.
Compare-and-swap prevents simultaneous editors from overwriting each other.
Without a record the page is the default: the cover on, and one untitled,
infinite section of the account's posts. Unsized stories vary by their
place in a section: a lead with companions, pairs, a wide feature and a
reversed split. Malformed records and network
failures show a retry state instead of falling back to the default page.
Post, feed and starter-pack references, and a featured card's feeds, can
belong to any account; unsupported collections and malformed
URIs are rejected. A page pins at most 100 items, has at most 20 sections and
60 slots in a section.
This prototype uses `validate: false` for the custom collection until its
lexicon is discoverable by PDSes; the client validates every read and write.

Tests: `pnpm test --runInBand src/features/frontpages/editorial`.
