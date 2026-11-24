# Media time comments

A reply to a video post can be linked to a second of that video. Replies that
land close together form _moments_, shown under the video in its thread.

Off unless the build sets `EXPO_PUBLIC_ENABLE_MEDIA_TIME=true`.

## The data

A linked reply is an ordinary `app.bsky.feed.post` with two additions:

- an extra field `network.eurosky.mediaTime` holding
  `{"$type": "network.eurosky.mediaTime", "seconds": 41}`
  (schema: `lexicons/network/eurosky/mediaTime.json`);
- a short link at the end of the text, `▶ 0:41`, pointing at the video post
  with `?t=41`, so other apps show the moment too. The link counts against the
  300-character limit; the composer reserves room for it.

Replies to a linked reply belong to the same moment and carry no time.

mu renders the link as a tappable time (`components/MediaTimeLink.tsx`)
instead of a web link. Recognition is by the link's shape (`record.ts`,
`parseMediaTimeLink`), so links written by other builds on other domains work
too.

## Writing

The composer opens with a time when the caller passes `mediaTime`, or when the
replied-to post's video was watched in the last ten minutes
(`playback.ts`, `getCommentableMediaTime`). The writer can move the time by
five seconds or make the reply about the whole video
(`components/ComposerMediaTime.tsx`). `post()` in `#/lib/api` writes the
field and the link on the first post of the thread only.

Players report their position with `reportPlaybackPosition`: the inline
players on web and native, the video feed and the full-screen player.

## Jumping to a second

`useJumpToMediaTime` plays a post's video from a second:

- a player on the current screen jumps in place (web inline players, and the
  full-screen player);
- otherwise web opens the post's thread with `?t=`, and iOS and Android open
  the full-screen player (`#/screens/PostVideo`). The inline native player
  cannot seek.

A thread opened with `?t=` (for example from another app) does the same
(`useMediaTimeParam.ts`).

## Moments

`moments.ts` groups a thread's linked direct replies: sorted by second, a
reply more than 30 seconds after the previous one starts a new moment. The
gap is a first guess. Grouping happens in the app from the thread's replies.
The thread call (`getPostThreadV2`) currently returns all direct replies; its
docs say they may be paged later, and then the app would see only part of
them. Hidden and muted replies are not counted. A server-side index is a
later step; it is also needed to show moments outside the thread (timeline
card, insights for the video's publisher).

Tests: `pnpm test src/features/mediaTime src/lib/api/__tests__/post.test.ts`.
