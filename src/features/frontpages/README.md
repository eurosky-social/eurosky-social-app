# Frontpages

Publication detail pages use one shared editorial layout in both news versions.
Ordinary `/profile/:name` pages keep the normal social profile and its tabs.
The news feed, explore spread, outlet directory, article pages and discussions
remain separate, unchanged surfaces.

## Routes and publisher lookup

- `/frontpage/:name` and the `/newsroom/:name` alias open a publication.
- With news v2 enabled, `FrontpageScreen.tsx` resolves the aggregator's
  `/api/outlets` entries by slug, DID or live account handle. `/frontpage`
  opens the outlet directory. Unregistered accounts do not become publications.
- With news v2 disabled, `legacy/NewsroomScreen.tsx` resolves the original
  publisher registry by ID, DID or handle. `/frontpage` opens its default
  publication. Its news-organization switcher appears above the selected
  publication's masthead.
- `preview.ts` adds an explicit `/frontpage/editorial-test` preview using the
  WIRED-seeded test account. It works with either news version without creating
  a synthetic aggregator outlet or replacing the account's profile.

`useProfileFrontpagePath.ts` keeps profile shortcuts tied to the appropriate
registry. News v2's domain-matched post chips and outlet directory still link
into these routes. Handles resolve to the canonical publication slug/ID.

## Publication page

`PublicationScreen.tsx` loads the live account and renders
[`editorial/`](editorial/README.md) for account-backed publications:

- A compact masthead with profile-linked avatar/name and verification badge.
  Follow is on the right for other accounts. **Edit front page** is temporarily
  available to everyone: only the publication owner can publish; other viewers
  get a local preview with **Discard**. There is no extra header action strip.
- Own original posts presented as a wide newspaper spread, with real article
  metadata, native post media, rich text and social engagement.
- Owner-published ordering, sizes, hidden posts, feeds and starter packs in
  the public `social.mu.frontpage/self` record. Both news versions read the
  same record and enforce the same ownership and compare-and-swap rules.
- A contextual link below the spread opens the publication/reporters'
  conversation at `?view=conversation`.

Outlets without an AT Protocol account retain their aggregator masthead and
articles (`components/FrontpageMasthead.tsx`, `FrontpageArticles.tsx`). They do
not get a fake account or writable account-owned layout.

## Conversation and context

The conversation retains the merged `frontpage|<dids>` post feed. News v2
combines the publication, aggregator `sources.accounts`, configured reporter
extras and trusted-verifier records. The original news version uses its
publisher/reporter registry. `NewsFeedAPI` chooses the appropriate backend.

The existing reporter cards, Your News link and live sports module remain in
the wide-screen right rail and inline on smaller conversation screens. The
editorial spread itself occupies the center and right columns and uses document
scrolling on web. Normal profiles retain their normal shell/right rail.

## Files

- `FrontpageScreen.tsx` - aggregator publication resolution.
- `legacy/NewsroomScreen.tsx` - original registry resolution and switcher.
- `PublicationScreen.tsx` - shared detail, status and conversation shells.
- `editorial/` - publication layout, rendering, editing, records and tests.
- `frontpages.ts` - aggregator mapping, paths, domain lookups and reporters.
- `components/` - accountless articles/masthead, post link chips and news v2 rail.
- `directory/` - outlet directory (`/outlets`, `/newsrooms`).
- `legacy/` - original registry, switcher, post link chip and contextual rail.

The superseded legacy masthead, RSS detail renderer and its private queries
have been removed. Shared news RSS/explore/article functionality is not removed.

Tests: `pnpm test --runInBand src/features/frontpages`.
