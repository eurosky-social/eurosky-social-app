# Supporter subscriptions

A single paid supporter tier: members receive a fixed heart badge beside their
name, distinct from the verification checkmark. There are no cosmetic choices,
avatar frames, name gradients, or per-user decoration settings.

## Badge rendering

`ProfileBadges` calls `useIsSupporter(did)`, so the heart appears wherever the
app already displays profile badges: profiles, posts, cards, lists, etc. The
interactive variant explains that support is not identity verification.

Entitlement is membership in an exact `app.bsky.graph.list` URI configured in
`BRAND.decorations.subscriberListUris`. Constellation's `getManyToMany` checks
both list-item links and verifies that the linking record belongs to the list
owner. Manually added list memberships work too.

One per-DID React Query lookup is shared across badge instances, with a 30-minute
stale time. The key includes the trusted list URIs. No Slingshot lookup or
`social.mu.deco.settings` record is required. Old cosmetic settings are ignored;
we do not delete users' records.

## Subscription page

Settings -> Support Mu (`/settings/supporter`) displays the service-provided
price/status, starts Mollie checkout on web, polls after the redirect, and
supports cancellation. It discloses that supporter membership is public.
Native builds show web-management instructions instead of selling digital access.

`/settings/decorations` remains a route alias for existing checkout redirects.
After activation, badge queries are invalidated immediately and after indexing
delays. These timers are cleaned up on unmount/account change.

## Configuration compatibility

The `decorations` brand key, `EXPO_PUBLIC_DECO_*` build variables,
`social.mu.deco.*` service methods, database tables, and service hostname remain
unchanged so existing deployments do not need a migration. Their purpose is now
supporter subscriptions, not selectable decorations.

The default feature flag is still **off**, and the accepted-list array is empty.
`enabled=false` hides the route/row, suppresses membership queries, and hides even
cached badges. It does not cancel Mollie subscriptions.

Backend: `services/deco/README.md`. Deployment checklist:
`docs/DECORATIONS_SETUP.md` in the workspace root.

## Testing without payments

Enable the feature in a test build and configure an exact test-list URI. Add the
user to that list with a normal Bluesky client, or use
`services/deco/scripts/emit-test-records.mjs`. Membership alone is enough; the user
need not save any settings. Use `MODE=revoke` to remove the test membership.
