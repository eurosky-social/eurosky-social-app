# Upstream sync: 2026-10-20

Source: `origin/main` at `3f9b9a94e` (1.136.0), merged into
`flo/sync-upstream-2026-10-20` from `eurosky/fork`.

## Resolution decisions

- Adopt upstream's SVG icon generator and native `react-native-nano-icons` rendering, using
  Phosphor artwork instead of Central/Iconists or Bluesky-specific glyphs. Rebuild all native
  fonts from the replacement SVGs. The importer/check rejects unreviewed permanent UI/brand
  sources so future syncs cannot silently restore restricted artwork. See [icons.md](./icons.md).
- Keep Mu's themed brand-logo pipeline, splash screens, favicons, and external assets.
- Adopt Metro for web exports and the move from `web/` to `public/`. Keep `web-build/` as the
  deployment artifact expected by Bunny, Cloudflare, OAuth metadata, and partner previews.
  Restore the PWA manifest and install icons, which Metro does not generate automatically.
- Keep Mu's OAuth, appview selection/shadow reads, moderation authorities, health probe,
  analytics policy, curated onboarding, custom embeds, profile pronouns/website, and branding.
  Merge upstream's profile links and embed providers additively.
- Following v2 uses the legacy feed page for news/frontpage sources, whose pagination APIs are
  stateful. The opt-in merged following feed stays on the legacy home implementation.
- Update fork haptic calls to upstream's intent-based API and adapt affected tests/mocks.
- Align pre-commit Oxlint with CI's `src/` and `modules/` scope. Node build scripts and the
  separate `dev-env` project must not be linted with the app's browser-only/type-aware rules.
  Prettier and SVG optimization remain enabled for their staged-file scopes.

## Validation

- iOS, Android, and web TypeScript checks.
- Full Jest suite: 178 suites, 2,252 passing tests, 28 existing todos, 21 passing snapshots.
  All 26 focused SVG/font generator tests also pass.
- Lint, icon drift checks, branding checks, and asset-notice validation.
- Production Metro web export, browser compatibility check, and standalone embed build.
- Chromium logged-out startup smoke test: Mu branding, no uncaught browser errors or missing
  local assets. Verify generated PWA icon dimensions, OAuth metadata, newsroom hosts, and
  YouTube iframe assets in the deployment artifact.

The web export validation reused existing compiled translation catalogs; extraction and
compilation are left to CI. It did not upload source maps or deploy anything.

Native binaries were not built or installed. Regenerate/rebuild native projects before device
QA: the dependency/config changes and rebuilt icon fonts require a new native build, not an OTA
update alone. Local export also warns that the ignored native projects need regeneration for
Sentry's updated configuration; Android FCM credentials were not present locally.
