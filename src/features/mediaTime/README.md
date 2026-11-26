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

A video's linked direct replies, grouped by where they pile up
(`moments.ts`). Every comment adds a bump about 10 seconds wide to a curve
along the video, and the moments are the hills of that curve: two
neighbouring hills are two moments where the curve between them dips at
least 30% below the lower top. A moment plays from where its hill rises
above half its height, at most 5 seconds before its first comment. The
settings are first guesses, to be tuned with real comments.

`useVideoMoments.ts` asks an AppView that answers
`network.eurosky.feed.getMoments` (schema:
`lexicons/network/eurosky/feed/getMoments.json`, the same file as in
Eurosky's AppView fork). It is Eurosky's by default;
`EXPO_PUBLIC_MEDIA_TIME_MOMENTS_URL` changes it. It counts all of a video's
linked replies, whichever AppView the user reads through, and is asked
without signing in. Linked replies the thread loaded that it doesn't know yet
are added to its moments: each joins the nearest moment within 20 seconds, or
starts one of its own. The app never moves the AppView's borders.

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
failed request shows nothing. Tapping a moment opens its page; "All
moments" opens the video with its moments.

## Watching, with moments

The full-screen video screen (route `PostVideo`,
`/profile/<name>/post/<rkey>/video?t=`) shows a video with its moments, after
the design canvas's "Watching, with moments". Time links open it on phones,
and "All moments" on the thread's and feed's moment rows opens it everywhere
(`openWatching.ts`, from where the video was last watched in the app).

- The video, the strip of where people commented, the video's title, who
  posted it and when, and how many comments it has in how many moments
  (`components/VideoTitleBlock.tsx`).
- The moments as a timeline (`components/MomentsTimeline.tsx`), each with a
  dot sized by its comments, its time, a tag ("Now playing", "Most
  discussed", "From the comments"), a title and its count. The title and the
  number of people come from its first 25 comments (`useMomentTitle.ts`).
  Tapping a moment opens its page.
- Where each moment is against the second being watched (`watching.ts`):
  ahead, playing (from its start until 10 seconds after its last comment),
  or past. Past moments except the last two fold into "N earlier moments".
- Moments ahead keep their comments hidden ("N comments · shown when you get
  there"); "Show" reveals one anyway. Decided 2026-11-26.
- On phones the list scrolls by itself, and "Follow the video" keeps the
  moment playing in view. On the web it scrolls with the page.
- "at 0:41 · Add a comment…" links a new comment to the second being
  watched.

## A moment's page

Tapping a moment, in a thread, a feed or the phone player, opens its page
(`openMoment.ts`, route `PostMoment`, `/profile/<name>/post/<rkey>/moment/<t>`):
the video on top, playing from `t`, and below it the moment that holds that
second (`momentAt`; moments shift a little as comments come in, so the link
names a second, not a moment). Its comments read as one conversation
(`components/MomentRoom.tsx`, after the design canvas's "One moment's room"):

- the moment's span, tap to play from its start, and "Most discussed" on the
  video's busiest moment;
- a title: until moments get names, the top comment quoted (from two
  comments on, skipping comments with a warning), else "Moment at 0:41";
- how many comments, and by how many people;
- the comments sorted by Top (most liked) or Newest, each with its own second
  as a chip next to the name (the "▶ 0:41" link is left out of its text),
  Reply, likes and the post menu;
- under each comment, up to two of its replies, the video author's first
  with a "Host" badge, then the most liked (`pickCommentReplies`), and a
  link to the rest in the comment's thread. They load per comment, while it
  is on screen (`useCommentReplies.ts`), and are filtered like the comments;
- "at 0:41 · Add to this moment…", which links a new comment to the second
  being watched, kept inside the moment's span (`commentSecond`), so it lands
  in this moment. The ±5 s buttons in the composer can still move it out.

The video pauses when it plays to the end of the moment, so people can read
without it running on (`usePauseAtMomentEnd.ts`, through `pauseIfVisible`).
Pressing play carries on past it, going back into the moment pauses it there
again, and jumping past the end doesn't pause.

The comments are loaded from the viewer's AppView, 25 at a time
(`useMomentPosts.ts`). Replies the video's author hid and posts the viewer's
moderation settings filter out are left out (`momentPosts.ts`). The AppView
lists at most 100 comments per moment; the page says so when there are
more. A comment just posted may take a few seconds to reach the AppView, so
missing ones are asked for again a few times.

Under the video, a strip shows where people commented
(`components/MomentStrip.tsx`): one bar per stretch of the video, as high as
its share of comments (`momentBars`), the open moment highlighted, the part
already played tinted, and where the video is. Tapping it plays from there;
when the tap is on or near another moment, the page switches to that moment.
It needs the video's length, which the players report with their position,
so it shows once the video has loaded.

On iOS and Android the page is dark above, with the video's title and the
player (`screens/PostMoment/index.tsx`, sharing the player and header bar in
`screens/PostVideo/VideoSurface.tsx` with the watching screen), and the
moment is a sheet in the app's own theme with a close button. On the web it is a normal page with the
post's own player, which jumps to `t` (`index.web.tsx`).

Tests: `pnpm test src/features/mediaTime src/lib/api/__tests__/post.test.ts`.
