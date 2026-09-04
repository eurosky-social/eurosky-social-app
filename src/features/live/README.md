# Live

A curated section of live broadcasts. `/live` lists what is on now, coming up
and recently ended; `/live/:id` is one event: the stream playing inside mu,
the host, the live thread, and the conversation about the stream elsewhere on
the network.

## Data model

Events are `social.mu.live.event` records (lexicon in
`lexicons/social/mu/live/event.json`) in the repo of the curator account,
`liveonmu.eurosky.social`. `useLiveCuratorQuery` resolves that handle to its
DID and PDS once an hour; `useLiveEventsQuery` lists the collection straight
from the PDS with `com.atproto.repo.listRecords`, so no appview or edge
service is involved and any client can read the programme. The record key is
the id in `/live/:id`.

The simplest curation is a post: any post from the curator account (not a
reply) whose link plays inline is an event too, read from the same PDS, with
the post as anchor, its embed title as the event title and its creation time
as the start. A post carries no end, so a post-derived event counts as live
for twelve hours. Events are keyed by stream: a record for a stream the
curator already posted supersedes the post-derived event, inherits its anchor,
and keeps the post's key as an alias so shared links stay valid.

Richer curation is done inside mu: signed in as the curator account, the Live index
shows "New event" and each event page shows "Edit"
(`LiveEventEditorDialog`). The form resolves handles to DIDs, converts a
pasted post link into the anchor at-uri, and refuses stream links that do
not play inline. Records are written with the normal PDS client
(`useLiveEventMutation`), so "who can curate" is whoever holds the account.

A stream must play inline: `getStreamPlayer` runs the link through the same
parser ordinary posts use (`parseEmbedPlayerFromUrl`) and accepts only
YouTube, Twitch and Vimeo.

## The two conversations

- **The live thread** is the replies to one anchor post. `useLiveAnchorQuery`
  takes the record's anchor post, else finds the host's own post of the
  stream link (a URL-filtered `searchPosts` scoped to the host, the way
  newsrooms find a publisher's canonical post). `useLiveThread` reads the
  thread with the standard `usePostThread` hook in linear view, flattens the
  replies newest-first, refetches every 15 seconds while the event is live
  and the screen is focused, and opens the ordinary composer as a reply to
  the anchor. Replies from the host and registered speakers are tinted and
  labelled.
- **Across the network** (`useLiveDiscussionQuery`) is every post linking
  the stream under any of its URL forms (`streamUrlVariants`), minus the
  anchor and anything whose reply root is the anchor. Ranked by interactions
  and rendered with the newsroom discussion row; "See all" opens the URL
  search.

Both run against the appview's URL-filtered search, which the Eurosky
appview supports. The pure link helpers (`postUrls`, `engagementScore`, URL
normalization) are shared with newsrooms in
`src/features/newsrooms/postLinks.ts`.

Both routes require a session, like the news surfaces.

## Layout

- Phone and narrow web: player, header, then tabs (Live thread, Across the
  network) with the compose prompt pinned under the thread.
- Wide web (`rightNavVisible`): `LiveSplitViewLayout`, modelled on the
  messages split view. The left nav collapses to icons (`LeftNav.tsx`
  treats `LiveEvent` like a messages route), the right nav is hidden, the
  screen takes a 600px column and the thread scrolls in its own 420px column
  with the compose prompt at the bottom.

## Files

- `events.ts` - `LiveEvent`, record mapping, state and stream-URL helpers
- `queries.ts` - curator, events, editing mutations, anchor and network
  discussion queries
- `LiveScreen.tsx` - `/live`
- `LiveEventScreen.tsx` - `/live/:id`
- `components/` - hero player (wraps `ExternalPlayer`), header, thread,
  network view, card, split view layout, LIVE pill, the curator's editor

## Touchpoints in upstream files

`routes.ts`, `lib/routes/types.ts`, `Navigation.tsx` (two screens, one
`Stack.Group` with the split layout), `LeftNav.tsx` (nav item, minimal mode),
`RightNav.tsx` (hidden on the event page), `Drawer.tsx` (menu item),
`analytics/metrics/types.ts` (`'live'` nav item). The newsroom
`DiscussionPost` row is exported for reuse.

## Not yet

Explore rail, "Watch in Live" chip on posts linking a curated stream, host
Live Now status driving the live state, RSVP and reminders, image upload
(the editor takes an image link for now).
