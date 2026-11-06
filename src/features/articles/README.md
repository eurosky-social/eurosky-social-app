# Post-backed articles

Shared article rendering for the simple Publisher page and the editable Frontpage V2. Nothing in this feature imports the frontpage editor, curation records, publisher registry, RSS, or an aggregator API.

- `articles.ts`: `PostArticle`, `ArticleSize`, `articleFromPost(item)`, and `articlesFromAuthorFeed(slices, did)`. Author feeds keep own originals in feed order, excluding replies/reposts and duplicate external destinations. The legacy `EditorialArticle` and `editorialArticles` exports remain compatibility aliases.
- `Article.tsx`: one story with small/medium/big, lead, compact, wide, and carousel-card presentations. It preserves post shadows, moderation, native photos/gallery/video, quotes, rich text, external article links, and separate conversation/repost links. Likes use the existing authenticated like/unlike queue and shared shadows. Editing controls are an optional slot, not a dependency on an editor.
- `ArticleGrid/`: responsive newspaper bands. Reversed features put two stacked small companions on the left, before the right-hand feature in visual/DOM order. Incomplete groups fall back to pairs or full width. Native/narrow layouts remain chronological.
- `ArticleList.tsx`: a ready-to-use chronological spread with the original automatic rhythm: lead/companions, pairs, full-width features, and reversed splits. Bare text posts get a normal full-width row rather than an empty hero column. It has no fetching, selection, sections, or editable state.
- `moderation.ts`, `articleLinks.ts`, and `articleText.ts`: shared filtering, link deduplication, and caption/metadata comparison (including whitespace, typographic quotes and a redundant article URL).
- `ArticleContent`: body-only integration for a thread that already applies post shadows/deletion and a content moderation boundary. Thread presentation keeps full summaries, distinct selectable post commentary, and highlighted media context, with the date/actions owned by the thread rather than a duplicate stats row. Callers must include the shared post/media/external moderation decisions; it is not a moderation bypass.

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
