# Publisher reader

`src/screens/Publisher/` is a reader-only flow, separate from Home and the editable Frontpage V2:

- The Publisher menu opens `PublisherDirectory` at `/publishers` (`/publisher` is a directory alias).
- The directory has responsive account cards: two columns on wide web screens, one on mobile/native. Cards show real moderated avatars, names, handles, verification when present, bios, follower counts, and the shared Follow/Following control. No invented locations, topics, or popularity counts. Profiles use standard cached queries; feeds are not loaded until selection.
- Selecting a publisher opens `Publisher` at `/publisher/:publisher`, with a stable registry ID. Its profile block groups a larger avatar/name, handle, Follow button, follower/post counts (no following count), linkified bio, and existing safe profile links. The back button is ordinary content above the profile and scrolls away. There is no sticky bar, generic directory heading, inline switcher, or duplicate identity row.
- Normal back navigation returns to the directory; directly opened details fall back there when there is no navigation history. Unknown IDs show a not-found message and Browse publishers link.

Edit `publishers.ts` to add/reorder accounts. The temporary registry is WIRED, The Verge, Financial Times, Euractiv, and 404 Media, using their existing account DIDs. It is independent of the legacy RSS publisher registry.

Details load moderated author-feed queries and render own original posts chronologically through `features/articles/ArticleList`, with explicit older-story pagination. Automatic sizes vary between leads, pairs, full-width features, and reversed splits. Right-hand features have two small stories stacked on the left, preceding the feature in both DOM and visual reading order. Incomplete groups use ordinary pairs/full-width fallbacks, not a one-companion reversed split.

Article likes use the normal authenticated like/unlike mutation queue and post shadows, not links to the people list. Comments retain the existing thread routes. In the news product, original registry-publisher posts use article typography, full preview metadata, and distinct post commentary in both selected and ancestor positions. Replies stay normal comments, including when a reply becomes selected. The ancestor retains its list moderation/filter boundary; the selected post retains its deletion, reporting, content moderation, translation, reply/threadgate, and action controls. Duplicate captions/headlines/summaries are suppressed, and article threads retain the date/action bar with extra spacing but omit the expanded engagement/known-liker rows. Social and reader-mode thread presentation is unchanged.

There are no sections, drag/rearrange, size controls, layout records, or publishing actions. Shared views preserve native media/gallery/video, quotes, rich text, and post identity. Blocked accounts cannot fetch stories; loading/empty/error/retry states and pagination-error retention remain intact.

News menus include Home, Publisher, Profile, and Settings. Both publisher routes keep Publisher active and work without the aggregator or News V2 flag. Public web browsing retains signed-out moderation/auth rules; native retains the shared authentication shell.

Desktop width and right-sidebar policy are independent; see `features/product/README.md#page-layout`. News hides the right sidebar globally and widens both Publisher and PublisherDirectory. Native/small windows stay stacked. `PublisherFollowButton` reuses the unchanged shared Follow/Follow back/Following copy, permissions, queue and profile shadows; there is no separate subscription relationship.

Tests: `pnpm test --runInBand src/screens/Publisher src/features/publishers src/features/articles src/features/product src/config/layout.test.ts src/features/product/layout src/screens/PostThread/__tests__`.
