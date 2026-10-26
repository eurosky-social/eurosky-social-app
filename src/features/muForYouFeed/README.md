# Mu’s For You feed

- New accounts save `FU_FEED_URI` as their first pinned feed during onboarding,
  replacing the Discover default. Following, Video, and unique starter-pack feeds
  follow it. Explicit starter-pack choices are retained, including Discover.
- Existing accounts without the feed pinned get a dismissible opt-in through the
  shared NUX dialog queue (including its one-dialog-per-day snooze). Simply
  signing into Mu on a new device does not change saved feeds.
- Acceptance reads fresh server preferences, pins/moves the feed to the front,
  reuses its existing saved-feed ID, and preserves other feeds. The normal feed
  controls can reorder, unpin, or remove it on every platform.
- The NUX system records that the offer has been shown in server-side account
  preferences. Onboarding also completes this NUX, so unpinning the new-account
  default does not trigger an invitation to add it again.
- Home selection remains local and account-scoped. With no remembered selection,
  Home uses the first server-pinned feed. There is no synthetic local pinned feed.

## Publishing the name

All feed names come from the generator record. Before rollout, the feed owner
should rename the existing generator’s `displayName` to **Mu’s For You**:

`at://did:plc:ooensn4mr5mhznzypvxelfa3/app.bsky.feed.generator/fu`

Keep the URI unchanged so existing subscriptions continue working. This is a
separate published-record change, not a client-side alias; this implementation
neither modifies that record nor overrides its current name.

## Review checks

- Finish onboarding with and without a starter pack: Mu first, no default
  Discover, no duplicate feeds, and no opt-in dialog.
- On an existing account, decline the offer: feeds and selection remain
  unchanged, and the offer does not recur after reload/account switching.
- Accept with Mu absent or saved but unpinned: it becomes first, appears in saved
  feeds on native, and remains removable. Existing Discover is not removed.
- Simulate a failed preference write: the dialog offers a retry and does not
  select a feed that was not saved.
- Switch accounts in the same web tab: selections stay separate; explicit home
  feed links still take precedence.
