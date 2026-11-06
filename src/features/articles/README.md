# Post-backed articles

Shared article rendering for news Home, Publisher pages and the editable Frontpage V2. Nothing in this feature imports the frontpage editor, curation records, publisher registry, RSS, or an aggregator API.

- `articles.ts`: `PostArticle`, `ArticleSize`, `articleFromPost(item)`, and `articlesFromAuthorFeed(slices, did)`. Author feeds keep own originals in feed order, excluding replies/reposts and duplicate external destinations. The legacy `EditorialArticle` and `editorialArticles` exports remain compatibility aliases.
- `Article.tsx`: one story with small/medium/big, lead, compact, wide, and carousel-card presentations. It preserves post shadows, moderation, native photos/gallery/video, quotes, rich text, external article links, and separate conversation/repost links. Likes use the existing authenticated like/unlike queue and shared shadows. Editing controls are an optional slot, not a dependency on an editor. An optional `byline` slot appears in the metadata/engagement row, outside the story link. Large preview videos place media beside text on wide screens and cap height at 80% of the window; narrow views remain stacked.
- `ArticleGrid/`: responsive newspaper bands. Each feature pairs with only one small companion, never two stacked stories. Reversed features put that companion on the left, before the right-hand feature in visual/DOM order. Incomplete groups fall back to pairs or full width. Native/narrow layouts remain chronological.
- `ArticleList.tsx`: a ready-to-use chronological spread with the original automatic rhythm: lead/companions, pairs, full-width features, and reversed splits. Bare text posts get a normal full-width row rather than an empty hero column. It freezes already-visible bands when stories are appended, so loading more cannot resize or regroup an existing tail row. Reordering, removal, or a size change rebuilds the layout; editorial grids keep their normal dynamic grouping. `density="compact"` reduces Home feature headline sizes and caps external preview images without changing Publisher defaults; `renderByline` lets the caller supply source badges without importing the registry. It has no fetching, selection, sections, or editable state.
- `moderation.ts`, `articleLinks.ts`, and `articleText.ts`: shared filtering, link deduplication, and caption/metadata comparison (including whitespace, typographic quotes and a redundant article URL).
- `ArticleContent`: body-only integration for a thread that already applies post shadows/deletion and a content moderation boundary. Thread presentation keeps full summaries, distinct selectable post commentary, and highlighted media context, with the date/actions owned by the thread rather than a duplicate stats row. Callers must include the shared post/media/external moderation decisions; it is not a moderation bypass.

`ArticleList` reader previews open the original post view from the headline/image/summary before visiting the external article. `Article` defaults to `linkTo="article"`, preserving direct external links in threads and the editorial editor; `linkTo="post"` selects the original conversation instead.

News headlines use a newspaper serif stack (Georgia/Times on web, Georgia on iOS, system serif on Android), without downloading a remote font. Desktop sizes are 56px for wide features, 40px for medium articles and 28px for compact cards; compact Home features cap at 48px. Body text, controls and social typography remain unchanged, and normal font scaling still applies. Small/compact metadata separates publisher identity from date/actions; wide companion/equal-pair summaries can show four genuine lines. Composer publisher previews use the same serif headline family without live media or navigation.

News restores publisher-only bookmark actions through shared authentication and mutation guards. Caller-supplied bylines retain registry separation; Saved filtering never changes stored account bookmarks.

To render elsewhere:

```tsx
import {ArticleList} from '#/features/articles/ArticleList'
import {articlesFromAuthorFeed} from '#/features/articles/articles'
import {articleModeration} from '#/features/articles/moderation'

const articles = articlesFromAuthorFeed(slices, did).filter(
  article => !articleModeration(article, moderationOpts).filter,
)
return <ArticleList articles={articles} wide={wide} />
```

Use `Article` directly for a single story or a different collection layout. Callers own query/loading/error/pagination state and must keep profile-level `ScreenHider` and blocked-account fetching restrictions. `Article` independently enforces post/external-card moderation and deletion shadows. It does not fabricate article metadata or engagement. A link preview with no real title falls back to regular rich post text plus a small source-domain link, not a giant headline made from the post caption. Headline and rich-text tokens wrap within their columns.

The old `features/frontpages/editorial/` import paths re-export these implementations for compatibility. Rendering/model/grid tests now live here; editorial curation/record tests remain with their feature.

Tests: `pnpm test --runInBand src/features/articles`.
