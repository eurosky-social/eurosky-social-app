# Frontpages

Publication detail pages use the editorial layout only with news v2 enabled.
With news v2 disabled, the original RSS-based newsroom pages remain in use.
Ordinary `/profile/:name` pages keep the normal social profile and its tabs.
The news feed, explore spread, outlet directory, article pages and discussions
remain separate, unchanged surfaces.

## Routes and publisher lookup

- `/frontpage/:name` and the `/newsroom/:name` alias open a publication.
- With news v2 enabled, `useFrontpage` in `frontpages.ts` resolves the
  address. A DID or handle opens that account's frontpage straight from its
  profile, without calling `/api/outlets`, so any account can be opened as a
  publication. Such a page has no aggregator domains, themes or filed
  reporters; its reporters are the `publishers.ts` extras plus its verified
  journalists. A slug is looked up as that one outlet, `/api/outlets/{slug}`,
  rather than in the whole `/api/outlets` list; a page opened from the
  directory starts from the list it already loaded.
  `/frontpage` opens the outlet directory.
- With news v2 disabled, `legacy/NewsroomScreen.tsx` resolves the original
  publisher registry by ID, DID or handle. `/frontpage` opens its default
  publication. It keeps the original switcher, masthead, RSS articles, article
  discussion and publisher/reporters' conversation feed.
- With news v2 enabled, `preview.ts` adds an explicit
  `/frontpage/editorial-test` preview using the WIRED-seeded test account,
  without creating a synthetic aggregator outlet or replacing its profile.

`useProfileFrontpagePath.ts` gives every profile a **Frontpage** shortcut
with news v2 (temporarily): an outlet's opens its slug, looked up
by DID through `/api/outlets/{did}`, and any other account's opens its handle.
Without news v2 it stays limited to the original publisher registry. News v2's domain-matched post chips and outlet directory still link
into these routes. Handles resolve to the canonical publication slug/ID.

## Publication page

With news v2 enabled, `PublicationScreen.tsx` loads the live account and renders
[`editorial/`](editorial/README.md) for account-backed publications:

- A compact masthead with profile-linked avatar/name and verification badge.
  Follow is on the right for other accounts. **Edit front page** is shown only
  to the publication owner. Demo builds with
  `EXPO_PUBLIC_ENABLE_FRONTPAGE_DEMO_EDIT=true` (`config.ts`) show it to
  everyone: other viewers get a local preview with **Discard** and cannot
  publish. There is no extra header action strip.
- Own original posts presented as a wide newspaper spread, with real article
  metadata, native post media, rich text and social engagement.
- Owner-published ordering, sizes, hidden posts, feeds and starter packs in
  the public `social.mu.frontpage/self` record, with ownership and
  compare-and-swap rules. News v1 does not read or edit this record.
- The publication/reporters' conversation remains accessible at
  `?view=conversation`.

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
- `PublicationScreen.tsx` - news v2 detail, status and conversation shells.
- `editorial/` - publication layout, rendering, editing, records and tests.
- `config.ts` - the demo editing build flag.
- `frontpages.ts` - aggregator mapping, paths, domain lookups and reporters.
- `components/` - accountless articles/masthead, post link chips and news v2 rail.
- `directory/` - outlet directory (`/outlets`, `/newsrooms`).
- `legacy/` - original registry, switcher, post link chip and contextual rail.

The original masthead, RSS detail renderer and private queries remain in
`legacy/` for news v1. The editorial layout and editor are news v2 only.

Tests: `pnpm test --runInBand src/features/frontpages`.
