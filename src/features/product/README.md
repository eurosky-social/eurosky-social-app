# Product presets

The same source can be built for different products. Brand identity and service configuration remain separate (`src/config/brand.json` and its adapters).

## Select a product

```sh
EXPO_PUBLIC_PRODUCT=social pnpm web
EXPO_PUBLIC_PRODUCT=news pnpm web
EXPO_PUBLIC_PRODUCT=news pnpm build-web
```

Use the same variable with `pnpm start` or the native build commands. Set it in the build environment, not after deploying a bundle. Restart Expo when changing it; use a clean/rebuilt bundle when comparing products.

Omitting the variable preserves the social product. An explicitly empty or unknown value is rejected. Expo configuration validates the selection for builds, and the runtime adapter validates it too. No remote configuration or user feature editor is involved.

**The news preset is a development scaffold, not production-ready.** Messaging and standalone/quote posting are disabled in this client, but interactive checks and broader news-product work remain pending. News navigation now contains only Home, Profile, and Settings; social navigation is unchanged. Home content, configurable settings composition, signed-out presentation, and news data dependencies remain unfinished.

## Current capabilities

Edit `src/config/product-presets.json`; `src/config/product.ts` exposes a typed, import-light `PRODUCT` adapter. Expo's config reads the same preset IDs for early validation.

| Behavior                                          | Social            | News scaffold     |
| ------------------------------------------------- | ----------------- | ----------------- |
| New standalone/root posts                         | Available         | Disabled          |
| Quote posts, including quotes attached to replies | Available         | Disabled          |
| Replies and chained replies                       | Existing behavior | Existing behavior |
| Likes/reposts                                     | Existing behavior | Existing behavior |
| Editing/deleting existing posts                   | Existing behavior | Existing behavior |
| Account-owned frontpage layout records            | Existing behavior | Existing behavior |
| Messaging                                         | Existing behavior | Disabled          |

Quotes are provisionally disabled for news. Replies/likes/reposts and edit/delete behavior are preserved for now, not a new permission grant. Upstream authentication, moderation, ownership, and other restrictions continue to apply. Capabilities govern this client only, not what an account can do in another client.

## Navigation

Edit the selected preset's `navigation` in `src/config/product-presets.json`. Each array selects destinations **in display order**; omit an ID to hide it. Social preserves its existing menus. News uses Home, Profile, and Settings on every signed-in surface, Home only in the signed-out drawer, and no signed-out sidebar destinations.

The news preset uses:

```json
{
  "sidebar": ["home", "profile", "settings"],
  "drawer": ["home", "profile", "settings"],
  "bottomBar": ["home", "profile", "settings"],
  "signedOutSidebar": [],
  "signedOutDrawer": ["home"]
}
```

- `sidebar`: desktop and native wide-screen sidebar.
- `drawer`: mobile drawer.
- `bottomBar`: mobile web and, by default, native.
- Optional `nativeBottomBar`: overrides only the native bottom bar when a different selection/order is needed.
- `signedOutSidebar` / `signedOutDrawer`: separate visitor menus, limited to public destinations. The bottom bar's signed-out create-account/sign-in controls are unchanged.

Available IDs: `home`, `news`, `search`, `notifications`, `atmosphere`, `chat`, `feeds`, `lists`, `saved`, `profile`, `settings`. Unknown/duplicate IDs and bottom bars outside 1–5 items are rejected. Atmosphere still requires its upstream feature flag; account-only destinations are filtered for signed-out visitors. Keep useful navigation and account/settings access when composing a menu.

**Hiding Chat is separate from disabling messaging.** Omitted destinations generally remain routable. The news preset also sets `capabilities.messaging: false`, which independently blocks the Messages route family, filters Chat even if added back to a menu, and disables messaging actions/background work. Compose availability follows the posting capability, not a navigation ID.

The first item is **not** a new home route: `/`, native startup, login/onboarding return, logout, and account-switch fallbacks are unchanged. Those are a separate home-policy slice. Changing presets requires restarting/rebuilding the bundle.

### Add a destination

1. Implement the screen and register its typed route/URL in `src/lib/routes/types.ts`, `src/routes.ts`, and `src/Navigation.tsx` as appropriate. Keep existing authentication/moderation/access checks.
2. Add a stable ID to `src/config/navigation.ts` and its translated label, icons, URL, related routes, and analytics item to `navigation/destinations.ts`. Use a registered native `tab` for an independent stack, or a typed common-screen `target` to open in the current native stack. Add analytics typing if introducing a new metric item.
3. Add the ID to the desired preset arrays. Standard buttons render on all surfaces without editing each shell. Existing native tabs retain their histories/reselect behavior; common screens do not gain independent tab history merely by appearing in the bottom bar.
4. Add a `NavigationSlot` only if the destination needs specialized platform UI (such as the profile avatar/account-switch long press, unread badges, or moderation badge). Existing specialized controls stay in their platform renderers to minimize upstream churn; their styling/copy still lives there.
5. Test signed in/out, active related routes, direct links, native back/reselect, and both presets. The shared selector/renderer and bottom-bar integration tests live in `navigation/`.

## Messaging

`capabilities.messaging` is enabled for social and disabled for news. `messaging.ts` owns the shared route/transport policy.

- The shared stack navigator rejects `Messages*` routes before authentication/onboarding or split-view layouts mount, including restored background routes. Existing typed routes/URLs stay registered and show the existing Not Found screen instead of prompting login. Chat invitation intents are ignored before authentication, landing-state changes, or prefetch.
- Profile message buttons, chat sharing/recent chats, invitation embeds/dialogs, chat keyboard shortcuts/help, and the group-chat announcement are gated. Standard link sharing, following, blocking, reporting, and supported posting remain independent.
- The polling event-bus and conversation-list subscription providers do not start in news. Chat query hooks are disabled, imperative invitation prefetch/resolution is skipped, and cached unread counts cannot restore badges.
- The standard `createLexClient` factory rejects chat-service requests before the underlying authenticated/public transport runs, covering reads, sends, reactions, groups, and chat notification mutations. Caller-supplied service overrides cannot bypass this. Chat declaration editing/deletion is guarded separately at its PDS mutation boundary; mixed chat/app notification updates are rejected before optimistic changes or partial writes.
- Chat notification rows/dialogs, chat export, the privileged-app-password toggle, and chat debug settings are hidden. Existing privileged credentials remain identifiable for security auditing.

### Account safety and authentication

Explicit account-deletion cleanup (`chat.bsky.actor.deleteAccount`) is an intentional transport exception: disabling messaging must not leave private data behind when deleting an account. Existing PDS age-assurance declaration reads/restrictions also remain intact; feature policy must not weaken age safeguards or accidentally overwrite account-wide settings. Generic repository export remains available.

OAuth requested/declared scopes and existing sessions are deliberately unchanged. Removing the transitional chat grant without independently verifying account-deletion authorization could break account management; reducing scopes requires a separate granular-grant review. A retained grant does not bypass client policy, and this does not revoke messaging access in other clients.

Non-chat notification permissions/registration remain shared. The app ignores warm/cold chat notification actions and foreground chat alerts/badges, and does not create new Android chat channels in news. This does **not** revoke existing push registrations or alter native background notification-extension delivery: existing native installations may still receive OS-level background chat notifications. Product-aware background delivery filtering and physical-device checks remain required before a native news release.

## Posting enforcement

- `publishing.ts` owns the small shared posting policy. Do not scatter product-name comparisons throughout screens.
- `useOpenComposer` checks before login/email verification, so unsupported actions do not trigger misleading authentication prompts.
- The composer provider checks direct callers too and releases caller-owned resources via `onClose` when rejecting an open.
- Standalone compose UI uses a product-aware `ComposeFAB` wrapper, while the generic FAB stays usable for other actions. Feed prompts, sidebar compose, profile empty-state actions, article post-sharing, and quote controls also honor capabilities.
- New-post keyboard shortcuts and compose intents are disabled, without closing unrelated UI.
- The composer checks its current draft contents before enabling publish, not just its initial options. Root drafts cannot be restored in the news product. Existing-post edits remain separate.
- The post-write API rejects disallowed creation before network/media work and checks resolved post-record embeds before `applyWrites`, covering pasted links that become quotes.
- Frontpage publication records do not use the post-creation guard.

Hiding a control is not enforcement. Future posting entry points must continue through these shared opening/write paths. Disabling a feature does not guarantee its code is absent from the bundle.

## Checks

```sh
pnpm test --runInBand src/config src/features/product src/lib/lexClient.test.ts src/lib/routes src/lib/hooks/useOpenComposer.test.tsx src/state/shell/composer/composer.test.tsx src/lib/api/__tests__/post.test.ts src/components/PostControls/RepostButton src/view/shell/nativeTabBarVisibility.test.ts
pnpm lint
pnpm typecheck
```

The tests exercise both policies explicitly. Also run them with `EXPO_PUBLIC_PRODUCT=news` to check loading under that build selection. Social integration checks also include `src/state/session/__tests__`, `src/state/messages/__tests__`, and message-composer layout tests. Manually verify unsupported actions do not prompt login or issue chat requests; supported replies, social messaging/invitations, account switching, and account deletion still work on narrow/wide web and native. Physical-device background push checks remain separate.

Broader product architecture and the implementation checklist live in the workspace's `news-docs/` directory.
