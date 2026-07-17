# Profile Decorations (Eurosky+)

Discord-style profile cosmetics as a paid subscription. v1 ships two slots:
**avatar frames** and **display-name gradients**. Full architecture and phase
plan: `DECORATIONS_PLAN.md` in the workspace root (one level above this repo).

## How rendering works

A DID's decorations render iff both halves exist:

1. **Subscription list membership** - X is a member of an exact Bluesky list in
   `BRAND.decorations.subscriberListUris`. The deco service adds a standard
   `app.bsky.graph.listitem` on payment and removes its item on lapse. Operators
   can also add or remove members through an ordinary Bluesky client.
   Constellation's `getManyToMany` verifies both list-item links in one request:
   `subject` points to X and `list` points to any accepted list URI. Repeated
   `otherSubject` parameters let one query check the whole configured array.
2. **Settings** - one `social.mu.deco.settings` self-record in X's own PDS,
   holding every cosmetic slot: `{avatar?: frameId, name?: gradientId}`.
   Written by the app with the user's own session (no service involved; see the
   settings screen). Fetched through Slingshot because the appview does not
   serve non-app.bsky collections. It survives a lapse dormant, so choices
   restore on resubscribe.

Only exact configured lists count, and only catalog IDs render. Unknown slot
values are ignored. `BRAND.decorations.enabled=false` removes the settings route
and row and disables all decoration entitlement queries/rendering. Test builds
can override the flag, lists, service URL, and service DID with
`EXPO_PUBLIC_DECO_*` variables.

One gated per-DID query (`useDecorations.ts`, 30 min stale) backs both slot
hooks - React Query dedupes, so a DID resolves once regardless of how many
avatars/names reference it:

- `useAvatarDecoration(did)` -> frame. Rendered by `UserAvatar` as
  `AvatarDecorationRing`, beside its live/alert overlays.
  `PreviewableUserAvatar` supplies it for feeds/threads/notifications/cards/
  chat; `Profile/Header/Shell.tsx` wires it explicitly (raw `UserAvatar`).
- `useNameGradient(did)` -> gradient. Applied as a text style
  (`nameGradientTextStyle`) in `PostMeta` (feed) and the profile display name.
  Web paints a real `background-clip: text` gradient; native falls back to a
  representative solid color (masked-view is not installed - adding true
  native text gradient needs a native rebuild).

## The settings screen

`src/screens/Settings/DecorationsSettings.tsx` (Settings -> Profile
decorations). Previews your name live, offers the gradient swatches + None, and
on Save writes the merged settings record via `useSetDecorations`
(read-modify-write, since putRecord replaces the whole record). Editable whether
or not a subscription is active - the choice is inert without membership.

## Testing without the service

`services/deco/scripts/emit-test-records.mjs` adds a normal list membership and,
when issuer and subject are the same account, a settings record. Supply the
exact `LIST_URI`; use `FRAME=` / `GRADIENT=` for slots and `MODE=revoke` to
simulate a lapse. Add the list URI to
`src/config/brand.json` -> `decorations.subscriberListUris` and enable the
feature. Decorations render once Constellation indexes the membership (usually
under a minute).
