# News front-page cards

The front page for the news product: Home (Discover and Following) and Publisher pages. Design spec: renderghost/eurosky-social-app#2.

Posts are presented two ways (`cardPresentation`). A post whose link card has a real title, on any host (most publishers post through shorteners such as buff.ly or reut.rs), is a **news card**: the article's own title as the headline and its description as the standfirst; the post text is left for the post page. Everything else is a **social post**: the post text at 16px regular (6 lines, 4 in compact rows) with its image or video below. Only news cards with an image take Lead and Feature slots (`cardCanFeature`).

Every story uses one anatomy: kicker (publisher logo and name, then the first hashtag as topic), headline, standfirst, media and actions. The whole card links to the post; publisher, repost, like and bookmark sit above that link as their own controls.

## Files

- `model.ts`: `cardKind` (article, link, text, image, gallery, video, youtube, quote), `cardHasMedia`, `cardTopic`, `cardTimeBucket` and `cardAccessibleName`. Pure.
- `slotting.ts`: `columnsForWidth` (4 at ≥ 1440px of content, 3 at ≥ 960, 2 at 600–959, 1 below), `cardSizeFor`, `continueRows` (the three-column rhythm full, 2+1, 1+1+1, Shorts, 1+2, or on four columns 3+1, 2+1+1, 1+1+1+1, Shorts, 1+1+2, with media stories promoted at most 3 places into media slots) and `reflowRows` (two and one columns reflow the three-column plan). Pure.
- `useFrontPageRows.ts`: plans once on three columns (four on very wide screens) and keeps every row but the last when stories are appended, so loading more never reshuffles what is on screen. Column changes reflow the same plan; crossing between three and four columns plans again.
- `NewsCard/`: the card. `styles.ts` holds the type scale (Lead 44/30 Bold, Feature 32/24, Standard 24/20, Compact 17) and the ratios (16:9 playable, 3:2 photos and articles, 4:3 compact). `Media.tsx` blurs moderated media and plays a muted Lead video unless autoplay is off or reduced motion is on. `CardActions.tsx` shows the time and the post actions.
- `FrontPage/`: renders planned rows in a hairline grid (`BoxGrid`), the Shorts section, and `FrontPageSkeleton` for the first load.

## Hairlines

One owner per line, and every line meets another. The page column (`Layout.Screen`) draws the left and right edges on every page. Grids run edge to edge inside it with no side padding: a grid draws its top line, each cell its bottom line, and each cell but the last in a row its right line. Shorts draws only top and bottom. Headings sit in open space between grids, inset to line up with the card text. Wide pages fill the space from the nav's edge (no maximum width); 600px pages stay centred.

## Sectioned Discover (#4)

`SectionedFrontPage` lays Discover out as Top stories, Popular, Video, Shorts, up to three publisher and five topic sections, then an endless Latest grouped by day. Following uses the same page in `following` mode: Top stories and Latest only.

- `ranking.ts`: `storyScore` = (2 × replies + reposts) / (hours + 2)^1.5 over 24 hours; likes are ignored.
- `sections.ts`: `buildDiscoverSections`, `buildFollowingSections` and `latestGroups`. Each story appears once, in page order. Publisher and topic sections need three unused stories; a feed under 20 stories shows only Top stories and Latest. On four columns (`wide`) sections take more stories to fill their rows: Top 9, Popular and Video 7, one-row sections 4.
- `slotting.ts` `planShapes`: lays a section into fixed shapes (Top `[3],[2,1],[1,1,1]`, or `[3,1],[2,1,1],[1,1,1,1]` on four columns; Popular and Video two rows; publisher and topic one row) with the usual media promotion.
- `FrontPage/useFrozenSections.ts`: two stages. Top stories freeze from the first page (20+ stories); Home fetches the second page straight away, and the other sections are built from the first 60 (or the end of the feed) below that Top block and freeze. Sections remember story URIs and are filled from the current feed, so muted, hidden or deleted posts drop out. Latest keeps the order it was shown in and appends each newly loaded batch (sorted newest-first within the batch), so rows already read never move. A refresh is detected when the first story is one the page has never seen. Home prefetches at most three pages and stops after a failed page. Page 2 measured at about 0.65 s on fast and slow-4G connections.

Publisher pages still use `FrontPage`.

## Accessibility

The card link's name reads the kicker, headline, time and counts, so the visible story text and media are hidden from assistive technology and the counts are skipped by Tab. Each card has five stops: card, publisher, repost, like, bookmark.

## Use

```tsx
import {FrontPage, FrontPageSkeleton} from '#/features/newsCards/FrontPage'

return isPending ? (
  <FrontPageSkeleton />
) : (
  <FrontPage articles={articles} shorts={<HomeShortsRow />} />
)
```

Callers own fetching, moderation filtering of the list, pagination and error states, as with `ArticleList`. The thread article header and the Frontpage editor still use `#/features/articles`.

Tests: `pnpm test src/features/newsCards`.
