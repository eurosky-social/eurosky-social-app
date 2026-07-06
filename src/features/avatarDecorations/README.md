# Profile Decorations (Eurosky+)

Discord-style profile cosmetics as a paid subscription. v1 ships two slots:
**avatar frames** and **display-name gradients**. Full architecture and phase
plan: `DECORATIONS_PLAN.md` in the workspace root (one level above this repo).

## How rendering works

A DID's decorations render iff both halves exist:

1. **Grant** - a `social.mu.deco.grant` record `{subject: X}` in the repo of
   an allowlisted issuer (`BRAND.decorations.issuerDids`, empty = feature
   off). Existence-only, like verification: created by the deco service
   (`services/deco/`) on payment, deleted on lapse. Discovered via the
   Constellation backlink index - the same pattern and hot-path volume as
   `useMuVerificationQuery` / `src/lib/verification/constellation.ts`.
2. **Settings** - one `social.mu.deco.settings` self-record in X's own PDS,
   holding every cosmetic slot: `{avatar?: frameId, name?: gradientId}`.
   Written by the app with the user's own session (no service involved; see
   the settings screen). Fetched through slingshot (the appview doesn't serve
   getRecord for non-app.bsky collections). Survives a lapse dormant, so
   choices restore on resubscribe.

Anyone can write either record; only the issuer allowlist makes a grant
count, and only catalog ids render (unknown slot values are ignored).

One gated per-DID query (`useDecorations.ts`, 30 min stale) backs both slot
hooks - react-query dedupes, so a DID resolves once regardless of how many
avatars/names reference it:

- `useAvatarDecoration(did)` -> frame. Rendered by `UserAvatar` as
  `AvatarDecorationRing`, beside its live/alert overlays.
  `PreviewableUserAvatar` supplies it for feeds/threads/notifications/cards/
  chat; `Profile/Header/Shell.tsx` wires it explicitly (raw `UserAvatar`).
- `useNameGradient(did)` -> gradient. Applied as a text style
  (`nameGradientTextStyle`) in `PostMeta` (feed) and `ProfileHeaderStandard`
  (profile). Web paints a real `background-clip: text` gradient; native falls
  back to a representative solid color (masked-view isn't installed - adding
  true native text gradient needs a native rebuild).

## The settings screen

`src/screens/Settings/DecorationsSettings.tsx` (Settings -> Profile
decorations). Previews your name live, offers the gradient swatches + None,
and on Save writes the merged settings record via `useSetDecorations`
(read-modify-write, since putRecord replaces the whole record). Editable
whether or not a grant is active - the choice is inert without one.

## Testing without the service

`services/deco/scripts/emit-test-records.mjs` hand-writes a grant + settings
record (`FRAME=` for the avatar slot, `GRADIENT=` for the name slot,
`MODE=revoke` to simulate a lapse). Add the printed issuer DID to
`src/config/brand.json` -> `decorations.issuerDids`; decorations render
app-wide once Constellation indexes the grant (usually under a minute).
