# Live

A curated section of live broadcasts. `/live` lists what is on now, coming up
and recently ended; `/live/:id` is one event: the stream playing inside mu,
the host, the live thread, and the conversation about the stream elsewhere on
the network.

## Data model

Three sources, merged into one programme and shown newest first:

1. **Posts from the curated accounts list.** `LIVE_SOURCES_LIST_URI` names
   a list kept by the mu.social account. `useLiveSourcesQuery` reads the
   membership straight from that account's repo (`app.bsky.graph.listitem`
   records), so a change to the list shows up without waiting for an
   appview. Each member's latest posts (not replies or reposts) come from
   the appview's author feed; any post whose link plays inline is an event,
   anchored on that post, hosted by its author, titled from its link card.
   A post carries no end, so a post-derived event counts as live for twelve
   hours.
2. **Posts from the curator account** (`liveonmu.eurosky.social`), read from
   its PDS so they appear the moment they are made, ahead of indexing.
3. **`social.mu.live.event` records** in the curator's repo (lexicon in
   `lexicons/social/mu/live/event.json`), for the metadata a post cannot
   carry: times, running order, speakers, an explicit anchor. Signed in as
   the curator, the Live index shows "New event" and each event page shows
   "Edit" (`LiveEventEditorDialog`); records are validated against the
   lexicon before they are written.

Events are keyed by stream (`streamKey`): a record supersedes a post for the
same stream, inherits its anchor, and keeps the post's key as an alias so
shared links stay valid. The record or post key is the id in `/live/:id`.

A stream must play inline: `getStreamPlayer` runs the link through the same
parser ordinary posts use (`parseEmbedPlayerFromUrl`) and accepts YouTube,
Twitch, Vimeo and Streamplace. Streamplace (`stream.place/<handle>`) plays
through its embed page, `stream.place/embed/<handle>`, which is a new
external-embed source in `embed-player.ts` with its own consent entry, so
Streamplace links play inline in ordinary posts too.

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

Both routes require a session, like the news surfaces. The index is a single
chronological list, newest first; each card carries a LIVE or REPLAY badge.

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
