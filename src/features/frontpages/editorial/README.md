# Editorial frontpages

The shared account-backed publication detail layout for both the original
newsrooms and news v2 frontpages. It uses the news explore geometry across the
center and right columns, with a compact masthead and ruled story columns.
Small screens stack the spread. Ordinary account profiles remain unchanged.

## Try it

- `/frontpage/editorial-test` - the test account seeded with WIRED links.
- `/frontpage/wired.com` - WIRED, resolved through the active publication registry.
- `/newsroom/:name` - the existing alias for the same publication detail page.

`../PublicationScreen.tsx` supplies the account and publication name. The original
newsroom adapter supplies its organization switcher above the masthead. The name
and avatar open the normal profile. Follow appears on the right for other
accounts. **Edit front page** is temporarily shown for everyone. The masthead has no extra
News/Conversation/Profile/refresh/menu action strip. A link below the spread
retains access to the publication/reporters' conversation and contextual rail.
The full bio, follower counts and normal profile actions remain on the profile.

## Content

This presents the publication account's **own posts** on its frontpage. Both
news-version adapters use the same renderer, while keeping their own registry
lookup. Accountless aggregator outlets retain their existing article renderer. It reads the standard moderated author-feed query/cache, using
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

Everyone can currently open **Edit front page** to try the layout locally. Only
the signed-in publication owner sees **Publish changes**; other viewers have a
single **Discard** action, and their previews cannot write a layout. Switching
accounts discards the draft. In edit mode:

- Desktop editing controls appear on article hover or keyboard focus. Insertion
  + buttons appear when the pointer is nearby or the button has focus. Touch and
  native screens keep controls visible.
- Drag the top-left grip to reorder stories. The first story becomes the lead.
  Pointer events support mouse and touch; arrow keys, Home and End work from a
  focused grip. Escape or a cancelled pointer gesture leaves the order unchanged.
- The + buttons between stories open a picker for existing posts, feeds and
  starter packs. Posts are the account's own originals; the feed picker combines
  pinned feeds (including other creators' feeds) and feeds created by the account.
  Already-present items are disabled. Filtering and loading older picker pages
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
- The top-right X hides a story from this presentation, not from the account.
  **Not on the front page** lets the owner restore it.
- **Include new posts automatically** appends new arrivals after saved picks.
  Turning it off freezes the currently selected stories.
- Reordering, hiding, restoring and resizing animate with FLIP transitions, even
  across columns. Reduced-motion preferences disable these transitions. The page
  uses document scrolling only, including edge auto-scroll while dragging.
- Changes are local until the owner chooses **Publish changes**. Cancel or
  Discard leaves the public layout untouched.

Published choices live in the owner's public `social.mu.frontpage/self` record.
Readers resolve that account's PDS, not their own preferences. Referenced older
posts are hydrated in batches of at most 25 and still use the usual moderation.
Compare-and-swap prevents simultaneous editors from overwriting each other.
Only record absence enables the automatic layout: chronological stories with
alternating medium-with-companions, paired small, full-width and reversed-split
bands. The first eligible starter pack created by the profile is inserted between
stories, normally after four posts. Pack-discovery errors leave stories usable.
Editing snapshots these automatic choices; published layouts are never decorated
with automatic resources or overridden sizes. Malformed records and network
failures show a retry state instead of accidentally revealing hidden selections.
Post references are limited to the account's own post URIs. Feed and starter-pack
references can belong to other creators; unsupported collections and malformed
URIs are rejected. Each saved list is limited to 100 entries.
This prototype uses `validate: false` for the custom collection until its
lexicon is discoverable by PDSes; the client validates every read and write.

Tests: `pnpm test --runInBand src/features/frontpages/editorial`.
