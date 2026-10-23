# Halloween mode

A device-local, opt-in seasonal theme for web, iOS, and Android, plus public
avatar costumes and candy-collection posts.

## Theme, invitation, and decorations

The shared window is October 28–November 3 inclusive in local time (three days
before Halloween, Halloween, and three days after). Theme and costume features
are independent. `HalloweenProvider` wraps both app roots above ALF.
`useHalloween()` exposes saved theme consent (`enabled`), the date window
(`isHalloween`), `isActive` (theme consent AND window), and separate annual
`shouldPrompt` / `shouldPromptCostume` flags with their dismissal methods.

Use `isActive` for the theme, webs, and ghost only. Use `isHalloween` for costume
creation and candy UI, regardless of theme consent. Both choices are remembered
locally with cross-tab updates, not synced as theme consent to other devices.

The clock checks at local midnight, at most every minute, and on resume/visibility
change. Active mode temporarily selects true dark mode and the existing orange
accent without changing saved color mode, dark variant, accent, or borders.
ALF, legacy styling, browser backgrounds/CSS/theme-color, and native system UI
follow the resolved theme. Static splash/build assets retain normal branding.

The first eligible visit each year queues two invitations using the existing NUX
queue and Dialog primitive: theme first, then costume, even if the theme was
rejected. Each is acknowledged separately by `promptedYear` and
`costumePromptedYear`. Accepting the costume offer opens the studio only after
its dialog closes and never enables the theme. Theme acceptance or explicit
rejection changes only theme consent; backdrop/back dismissal preserves the
previous setting. Both invitations wait for onboarding, policy completion,
profile loading, foreground state, and other announcements/dialogs. They are not
repeated on later event days; other NUXs are snoozed for the day. The Appearance
toggle remains available outside the date window to configure the theme.

`CornerWebs.tsx` renders original, distinct pixel-style SVG cobwebs in all four
viewport corners. They are static, decorative, click-through, responsive, and
safe-area aware. Keep them inside navigator/page content: above the bottom bar,
below desktop rails, drawers, and dialogs.

The shared pet mount substitutes `ghost.ts` during active mode, even with pets
disabled, without changing pet preferences. Signed-out users have no ghost. It
uses the licensed white bonus ghost at integer 3x scale, floating above the
bottom bar/viewport bottom. Reduced motion holds its first frame with no
movement timers. Opt-out/expiry restores the saved companion. See
[artwork provenance](../../../assets/pets/halloween/README.md).

## Public avatar costumes

The own-profile **Draw costume** / **Edit costume** button opens the authenticated
`/halloween/costume` screen during the shared date window, even with the Halloween
theme disabled. Direct links cannot publish outside the window; an already-open
studio retains its draft but disables publication at expiry. Saving changes the
actual public profile picture, not an avatar overlay. Other clients see the same
uploaded image. November 4 hides costume tools and candy UI, but does not undo
public profile edits or delete costume records/posts.

Publication requires an explicit confirmation explaining that the public picture
will change and that opting out of the theme will **not** restore the old photo.
The drawing is flattened over the original square photo into a 512x512 PNG and
uploaded to the user's PDS. On both platforms the original photo comes from the
account's actual PDS via `com.atproto.sync.getBlob`, not a CDN thumbnail: the web
editor needs CORS permission to read pixels. A failed photo load aborts publication
rather than silently omitting the photo. Accounts without a photo use a neutral
background. Failures identify image preparation, blob upload, or repository
publication and retain the server's error message.

`costumes/records.ts` is the repository boundary. One atomic `applyWrites` updates
`app.bsky.actor.profile/self` (preserving its other fields) and
`social.mu.halloween.costume/self`. The latter contains:

- `costumeNumber`: starts at 1 and increases once per published change.
- `createdAt` and `updatedAt`.
- `avatar`: uploaded flattened PNG blob.
- `originalAvatar`: original photo blob, if any, retained for future edits.
- `drawing`: validated version-2 pixel art, so editing works across devices.
- `post`: optional URI of the latest candy-collection post for this costume.

A new costume clears `post`; posting does not increment the counter. The original
photo is reused only while the profile still wears the previously published
costume. A separately changed profile picture becomes the new base. The editor
re-reads the repository head and source records just before publication and uses
that fresh `swapCommit`. Unrelated likes/follows do not invalidate a drawing;
concurrent bio/banner edits are preserved. A changed source avatar or costume
counter is a real conflict and requires reopening the studio. A race during the
final atomic write still fails safely; ambiguous network failures are never
automatically retried.

The schema lives at `lexicons/social/mu/halloween/costume.json`. This is a public
record, including its base-photo blob and drawing, not private draft storage.
Existing device-local art is offered as a starting draft when no public costume
exists. Color history remains device-local and per DID. `UserAvatar` no longer
renders local costume overlays, avoiding double costumes over uploaded pictures.

### Studio tools

The 64x64 transparent canvas has brush, eraser, four-connected fill, eyedropper,
and hand/pan tools. Brush sizes are 1/2/4/8/12/16 with interpolated circular stamps.
Fill only reads the art layer. The eyedropper checks art before the original
photo, previews without painting, and returns to the previous tool on release.

An anchored color popover offers Presets, Custom HSV/hex, and Recent. Recent is
a per-DID MRU of up to 24 colors actually painted, not merely previewed. There
are up to 256 drawing colors and 50 whole-operation history steps. Canceled
gestures roll back drawing, palette, and history. Rendering uses one SVG path per
color, not a view per pixel. Version-1 32x32 art migrates with exact 2x2 pixels.

Both platforms support 1x–12x pinch/pan, two-finger tap undo, and three-finger tap
redo. Multitouch cancels an in-progress stroke; lifting to one finger cannot
start another. Safari gesture events and non-passive control-wheel cover desktop
pinch, trackpad scrolling pans, and mouse users have the hand tool. Keyboard:
arrows move, Space/Enter paint, Command/Control-Z undo, Shift-Z redo, +/- zoom,
and 0 fits. Options dismiss before native back; gestures stop on blur. The route
uses minimal shell mode with native drawer/back swipes disabled.

Drafts remain transient until publication. Back/navigation asks before discarding
unsaved edits; browser refresh/close uses its native warning. Clear is confirmed
and undoable. Clearing then publishing uploads the original base photo and counts
as a costume change. Account switches remount the draft. Storage/upload failures
leave it editable.

## Collection posts and candy

After successful publication, **Post to collect candy** offers an optional
composer with the flattened image, alt text, and editable preset text:

> Trick or treat! Like this post to give me candy. You can create your own costume on mu.social

Only the seeded post carries `isHalloweenCostume: true` on its
`app.bsky.feed.post` record. Additional thread posts and ordinary posts do not.
The costume number travels with that draft (including saved drafts); an outdated
costume draft cannot replace the current costume's collection link. Creating the
post and updating the costume's `post` URI happen in one repository transaction.
The web, iOS, and Android composer shells forward all composer options, including
`halloweenCostumeNumber`, so the seeded post does not lose its marker before
reaching the draft state. Older posts published without the marker are not
retrofitted based on their text.

Those mixed batches omit explicit `validate: true`: the reference PDS still
validates known Bluesky schemas by default while allowing the custom costume
collection. Ordinary post batches retain `validate: true`. No post is automatically
published, and declining the prompt keeps the new avatar.

During the date window, profiles with a valid public costume singleton show
**Give candy**, independently of theme consent or whether they shared a post.
Each click creates a fresh TID-keyed `social.mu.halloween.candy` record in the
giver's PDS, with `subject` set to the recipient DID and `createdAt` set to the
gift time. The schema lives at `lexicons/social/mu/halloween/candy.json`. This is
not a singleton or a toggle: subsequent deliberate clicks create additional gifts.

For signed-in viewers, Microcosm Constellation's `getBacklinks` checks
`social.mu.halloween.candy:subject`, filtered by the recipient DID and giver DID,
with `limit=1`. A previous gift changes the button to **Give more candy** with a
highlighted style. Successful writes update the query cache immediately and
cancel older in-flight lookups so indexing lag cannot undo that feedback. The
cache is separate for each giver/recipient pair and becomes stale after one minute.
An unavailable index does not prevent giving candy.

Giving requires sign-in. The button is disabled only while sending, and failed
requests are not automatically retried because an ambiguous timeout may already
have committed. No post is required or liked by this action. Blocked or
moderation-blurred profiles do not show the entry point. Public costume reads use
Slingshot/PDS resolution, not the Bluesky AppView.

`useLikePresentation` switches to the supplied Lucide candy outline **only** when
the post record has the exact boolean `isHalloweenCostume: true` AND the shared
date window is open. Untagged posts always retain hearts. Tagged posts show
candy even with the theme disabled, but return to hearts on November 4 without
changing their likes or marker. FNV-1a of the full URI picks a stable candy color across
feeds, threads, reader mode, and immersive video. Existing likes, counts,
authentication, optimistic updates, undo, and reduced-motion animations remain
unchanged. Post candy is still a normal like; the separate profile gifts above
are custom records, not likes or synthetic posts. See `NOTICE.md`,
`docs/icons.md`, and `licenses/LUCIDE-ISC.txt` for the glyph exception/license.

## Preview and QA

Set `EXPO_PUBLIC_HALLOWEEN_PREVIEW=true` and restart Expo. It simulates the window
in development only. Theme visuals still require consent; costumes/candy do not.
Use Appearance if the theme invitation was already dismissed. Never clear a real account's entire persisted store.
**Avatar publication and posts are real writes even in preview: use a test account.**

```sh
pnpm test --runInBand src/features/halloween src/screens/CostumeEditor src/lib/api/__tests__/halloween-post.test.ts
pnpm typecheck
pnpm lint
pnpm icons:check
```

Manual QA on web, iOS, and Android:

- Check drawing tools, color/history popovers, undo/redo, photo sampling, no-photo
  accounts, pinch/pan/taps, desktop keyboard/trackpad, safe areas, and dirty guards.
- Cancel publication: no upload or profile change. Confirm: verify the new avatar
  in another client, preserved bio/banner/profile fields, singleton rkey, and
  counters 1/2/3 after three changes. Reopen on another device and edit the base
  photo without stacking the previous costume. Check concurrent repo writes.
- Decline/dismiss the collection prompt: retain the uploaded avatar and release
  temporary image resources. Accept: verify image, alt text, editable preset,
  saved-draft restoration, cancel, and publish. Additional thread posts must not
  have the marker. Try publishing an old draft after changing costumes.
- Give profile candy with no costume post and with the theme off: verify a new
  gift in the giver's PDS with the recipient DID. Repeat after completion to
  verify distinct records and the highlighted **Give more candy** button. Reopen
  the profile after indexing and switch accounts/profiles to check that earlier
  gifts are scoped correctly. Check pending/error/sign-in states, index outages,
  and no automatic write retries. Check blocked/blurred profiles and a recipient
  without a costume.
- Share a fresh costume post on web/iOS/Android and check the actual record has
  `isHalloweenCostume: true`. Check candy like/unlike in feeds, threads, reader
  mode, and immersive video. Normal posts must always show hearts.
- Check invitation accept/decline/escape/backdrop/swipe/back and relaunch, yearly
  dismissal for both prompts, theme-first ordering, costume acceptance/decline
  with the theme off, midnight October 27/28 and November 3/4, foreground and
  background transitions, theme preference restoration, cross-tab theme updates,
  corner controls/click-through, native safe areas, and ghost reduced motion.
- Turn the theme off during the window: decorations vanish but costumes/candy
  remain usable. Expire November 4: tools and candy UI disappear, costume posts
  show hearts, and public avatars/posts remain.
