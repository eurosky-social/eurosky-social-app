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

A video's linked direct replies, sorted by second: a reply more than 30
seconds after the previous one starts a new moment (`moments.ts`; the gap is
a first guess).

`useVideoMoments.ts` asks an AppView that answers
`network.eurosky.feed.getMoments` (schema:
`lexicons/network/eurosky/feed/getMoments.json`, the same file as in
Eurosky's AppView fork). It is Eurosky's by default;
`EXPO_PUBLIC_MEDIA_TIME_MOMENTS_URL` changes it. It counts all of a video's
linked replies, whichever AppView the user reads through, and is asked
without signing in. Linked replies the thread loaded that it doesn't know yet
are added to its moments.

Until it answers, or when it fails, the app groups only the replies its
thread loaded. Eurosky's AppView returns at most 200 replies for a thread;
Bluesky's currently returns all direct replies. Hidden and muted replies are
not counted there.

### A comment just posted

The AppView counts a new comment a few seconds after it is posted, and its
answers can be 30 seconds (moments) or a minute (feed counts) old. So
`post()` remembers each linked reply it writes for five minutes
(`postedComments.ts`) and asks for that video's moments again. The thread
adds the remembered comment to the AppView's moments; a feed card for that
video reads the full moments, which list each comment, instead of the
counts. Comments are matched by their address, so none is counted twice.
Deleting the comment forgets it.

## In feeds

Under a video post with replies, feeds show its three most talked-about
moments (`components/FeedMoments.tsx`, placed in `PostFeedItem`). Nothing
shows while the post is hidden behind a content warning (`feed.ts`). The
counts come from `network.eurosky.feed.getMomentSummaries` on the same
AppView; requests made within 50 ms share one call of up to 25 posts
(`momentSummaries.ts`), and the AppView keeps each answer for a minute. A
failed request shows nothing. Tapping a moment plays the video from there, as
the time links do.

Tests: `pnpm test src/features/mediaTime src/lib/api/__tests__/post.test.ts`.
