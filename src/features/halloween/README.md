# Halloween mode

A device-local, opt-in seasonal layer for web, iOS, and Android. It recurs each
October 28–31, from local midnight on October 28 until local midnight at the
start of November 1. While active,
it temporarily selects true dark mode (not dim) and the existing orange accent.
Saved color mode, dark variant, accent, and border preferences are never changed.

## Shared state

`HalloweenProvider` wraps `InnerApp` in both app roots, above ALF. `useHalloween()`
exposes:

- `enabled`: the saved consent, including outside the event window.
- `isHalloween`: whether the local event window is open.
- **`isActive`**: consent AND event window. Gate all seasonal visuals with this.
- `shouldPrompt`: an invitation is due for the current local year.
- `setEnabled(boolean)` and `dismissInvitation()`.

Preference storage uses the existing cross-platform persisted store (`halloween`),
including web cross-tab updates. Consent survives restarts and applies to future
Halloweens on this device, not other devices. Dismissal (including escape,
backdrop, native swipe/back) suppresses the invitation for the current year.
Changing the toggle during the event also acknowledges that year's invitation.

The clock checks at local midnight and at most every minute to recover from
wall-clock/timezone changes, and immediately on app resume/web visibility change.
Only changes to the event window/year update context state.

## Theme and invitation

`themes.ts` reuses `buildThemes('orange')`, without custom seasonal palettes.
`useThemeName` temporarily resolves to `dark` while Halloween is active, including
for native dialogs. `useThemesOverride` applies the orange accent before existing
border preferences. The ALF-to-legacy bridge keeps feed and composer styling in
sync. The browser's runtime background, CSS variables, and theme-color follow
the resolved palette; static pre-React splash/build assets keep normal branding.
Native system UI already follows the ALF theme in the app shell.

`Invitation.tsx` uses the existing Dialog primitive (web modal/native bottom
sheet). The NUX queue prioritizes it without replacing an active announcement.
It waits for policy completion, foreground state, and other dialogs to clear.
Dismissing it snoozes other announcements for the day. Nothing activates until
acceptance, and preference changes run after the dialog closes. The invitation
is only offered to signed-in users after onboarding/profile loading completes.
The invitation appears on the first eligible visit during October 28–31 and is
not repeated on subsequent days after dismissal. The Appearance toggle is always
available, including outside this window when it sets consent for the next
Halloween.

## Give candy

`useLikePresentation` replaces heart controls with the supplied Lucide wrapped
candy outline while `isActive`. The SVG retains its 1.5 stroke and stays neutral
until toggled on; active candy and its count use a stable bright color. FNV-1a of
the full post URI (including author and rkey) chooses that color, so it survives
reloads and is the same in feeds, threads, reader mode, and immersive video on
web and native. No random state or additional storage is needed.

Candy is only a presentation of normal likes: existing like/unlike mutations,
counts, authentication, optimistic updates, and undo remain unchanged. Opt-out
or expiry restores hearts without changing likes. The existing platform-specific
like animations use the candy glyph and color, retaining reduced-motion support.
The Lucide exception and ISC license are documented in `NOTICE.md` and
`docs/icons.md`; the generated Phosphor catalog is untouched.

## Decorations

`CornerWebs.tsx` adds subtle, original pixel-style SVG cobwebs to all four viewport
corners in both platform shells. Each has different spokes, spacing, and broken
strands rather than a mirrored copy. Webs scale down on small screens, respect
native safe areas, and stay fixed while scrolling on web. They are static, hidden
from assistive technology, and let all pointer/touch events pass through. The
shared `isActive` gate removes them immediately on opt-out or when the event ends.

On web, webs live inside the navigator, above the mobile bottom bar but below
the desktop rails, profile/account controls, outer drawer, and dialogs. On native,
they live inside the drawer's page content, above the tab bar, so the drawer and
its scrim still cover them. Keep them out of the outer shell overlay stack to
preserve that layering.

Co-locate seasonal components here and mount them in both platform shells (or a
shared shell component). Read `useHalloween().isActive` rather than checking the
date, saved consent, or theme name independently. This gives cobwebs, logo
costumes, etc. the same opt-out and automatic expiry as the palette. Keep overlays
non-interactive, accessible, and respectful of reduced-motion preferences. Do not
replace original user avatars/posts or persist the Halloween palette as a normal
accent. Costumes below are a separate, reversible presentation layer.

## Ghost companion

The shared `PetCompanion` mount substitutes `ghost.ts` while `isActive`, even
when the saved pet preference is disabled. It never writes pet preferences or
adds the ghost to the selectable pet registry. Opt-out or expiry restores the
saved pet (or no pet), and signed-out users still have no companion.

The existing companion director and pixel-art renderer use the white cute bonus
ghost's eight-frame bobbing cycle while resting and slowly floating above the
bottom bar (or viewport bottom on desktop). It renders at an integer 3× scale.
The ghost is decorative: it passes through all touches/clicks and is hidden from
assistive technology. Reduced motion holds the first idle frame and schedules no
movement/frame timers. Only the needed animation is bundled; see the
[artwork provenance](../../../assets/pets/halloween/README.md).

## Local avatar costumes

While Halloween is active, your profile has a **Draw costume** / **Edit costume**
button, opening the authenticated **Costume studio** screen at
`/halloween/costume` (not a modal). The same editor works with mouse, pen, touch,
and desktop keyboard (arrows to move, Space/Enter to paint, Command/Control-Z to
undo and Shift-Command/Control-Z to redo while the canvas is focused). It has a 64x64
transparent canvas between two compact horizontal bars: drawing tools (brush,
eraser, fill, eyedropper, and hand/pan) at the top, and brush size, color,
undo/redo, and clear at the bottom. There are no permanently visible swatches.
Brush sizes are 1/2/4/8/12/16 pixels, chosen in a small toolbar popover; fast drags are
interpolated with circular stamps. Fill is four-connected and only reads the
drawing layer, never the underlying photo.

Clicking the color swatch opens an anchored, dismissible popover above the bottom
bar with **Presets**,
**Custom**, and **Recent** tabs. Custom colors use the same HSV square, continuous
hue strip, and hex input on every platform. Recent colors are a deduplicated MRU
of colors actually painted, not every color previewed. Up to 24 are saved per DID
in the separate device-local `halloweenCostumeColors` preference, including web
cross-tab updates. Canceled gestures do not update history. Choosing a color never
recolors existing pixels; new colors are allocated only when painted. Tooltips
on desktop and long-press labels on native keep the icon-only tools discoverable.

The eyedropper samples the painted layer first, then the photo underneath. It
previews the sampled color during the gesture and returns to the previous paint
tool on release, without painting or creating an undo step. The photo sampler
center-crops/resizes to the same 64x64 grid locally: browser canvas with CORS,
and Expo image manipulation plus the portable `upng-js` PNG decoder on native.
Temporary PNGs/native image handles are released; no sampled photo is saved or
uploaded. Transparent photo pixels composite against the avatar background.
Missing/CORS-blocked photos do not prevent picking painted colors, and stale
asynchronous photo results cannot leak across URL/account changes.

Zoom is continuous from 1x to 12x, anchored around the two-finger centroid. Both
platforms support two-finger pinch/pan, two-finger tap to undo, and three-finger
tap to redo. Chrome/Firefox trackpad pinch uses a non-passive control-wheel
listener; WebKit gesture events support Safari without double-applying zoom.
Ordinary trackpad scrolling pans. Mouse users retain the hand tool; keyboard
plus/minus zoom and zero fits the canvas.
`DrawingSurface/controller.ts` shares gesture policy across native and web:
multitouch rolls back an in-progress stroke, ignores the remaining single finger,
and only recognizes stationary, short 2/3-finger taps after all fingers lift.
Pinch, drag, long holds, cancellation, and replaced fingers never trigger history.

There are up to 256 colors and 50 whole-operation undo/redo steps, including
palette changes, fill, and clear. A canceled brush/fill/eyedropper transaction
restores the draft without consuming undo or redo. The header previews the actual
avatar size. Clear asks for confirmation; clearing then saving removes the
costume. Popover outside taps dismiss without painting; escape/native hardware
back close options first. Gesture capture and dismissal listeners stop on blur.

The route uses minimal shell mode and disables native drawer/back swipes so they
cannot steal drawing gestures. Safe areas and the iOS keyboard are accounted for.
Back/navigation with unsaved edits asks before discarding; browser refresh/close
uses the browser's native unsaved-changes warning. Save waits for its storage
adapter to resolve before leaving; a rejected write keeps the draft editable.
Account switching remounts a fresh draft for that DID. There is no auto-save; drafts never update shared avatars before
Save. The studio can finish editing outside the seasonal window, but costume
visibility and its profile entry point still follow `isActive`.

Saved art appears throughout the app via `UserAvatar`, including feeds, replies,
DMs, notifications, hover cards, profile headers, and account/navigation avatars.
Callers pass the account DID explicitly, so costumes do not depend on avatar URLs
or leak onto another account, feed, or list, and also work without a profile photo.
Blurred/filtered avatars suppress costumes; existing moderation alerts, live
badges, and subscriber frames remain above the drawing. Opt-out or event expiry
hides costumes without deleting them or changing the original profile image.
The image lightbox and photo-upload editor still show the original photograph.

Implementation lives in [`costumes/`](./costumes/). `model.ts` defines a bounded,
versioned, JSON-serializable `Costume`: `gridSize`, hex `palette`, row-major integer
`pixels` (palette indices, with `-1` for transparency), and `updatedAt`. Version 2
uses 64x64 pixels; saved version-1 32x32 art is upgraded with exact nearest-neighbor
2x2 pixels, preserving its appearance. Reading does not write a migration; the
next Save persists v2. Rendering uses at most one SVG path per color, not one
native view per pixel. Editor drafts and
undo history are transient; only Save writes `halloweenCostumes` in the existing
cross-platform persisted store, keyed by DID, with web cross-tab updates. Invalid
art is rejected at the adapter boundary without discarding account sessions.

This is intentionally device-local: there are no lexicons, uploads, protocol
writes, or changes to `app.bsky.actor.profile`. Photo sampling only reads the
existing avatar URL. `state.tsx` is the persistence boundary;
a future lexicon-backed query/mutation can replace that adapter while retaining
the editor, validated data model, and renderer. Do not put local undo/session state
in a future record. Actual record namespace, discovery, and publishing consent
are deferred. Profile trick-or-treating/candy buckets are not implemented here.

## Preview and QA

Set `EXPO_PUBLIC_HALLOWEEN_PREVIEW=true` and restart Metro/Expo. This simulates the
event window on web and native in **development only**, but still requires
opt-in. It does not reset a previously dismissed invitation: use Appearance to
preview the theme, or clear only the `halloween` preference in a disposable test
profile to test the invitation again. Never clear the entire store of a real
account. Production ignores this flag.

Automated checks:

```sh
pnpm test --runInBand src/features/halloween src/screens/CostumeEditor
pnpm typecheck
pnpm lint
pnpm icons:check
```

Manual checks on web, iOS, and Android:

- Open the dedicated studio on phone and desktop. Check all brush sizes, fast
  diagonal drags, eraser, bounded fill, whole-stroke undo,
  redo, and clear confirmation/undo. Choose colors via hue/SV and hex, and verify
  existing pixels do not change. Open saved v1 art and check its appearance.
- Open Color and check all three tabs, their empty/recent states, preset selection,
  HSV/hex, backdrop/escape/hardware-back dismissal, and no painting through the
  popover. Check tools at the top, other controls at the bottom, brush-size/color
  popovers above the bottom bar, small-screen fit without control scrolling, and
  hover/long-press labels. Recent colors should survive reopening/reloading and
  remain separate between accounts. Previewing a color must not add to Recent.
- Pick colors from painted pixels and the underlying photo; verify no history
  step or stray mark and return to the previous tool. Check no-photo, transparency,
  slow loads, CORS failure on web, and account/avatar switches while loading.
- Pinch/pan, release one finger, and move it: there must be no new stroke. Tap with
  two fingers to undo and three to redo; never confuse a pinch, drag, long hold,
  canceled gesture, or additional finger with a tap. Check Safari trackpad pinch
  and Chrome/Firefox control-wheel pinch without browser-page zoom; two-finger
  trackpad scroll pans. Check keyboard +/−/0, arrows/Space, and undo/redo.
- Drag outside and release/cancel. Rotate the phone and check the toolbar, color
  popover, hex keyboard, safe areas, and avatar preview. Leave while options are
  open and verify the next screen keeps normal hardware-back/keyboard behavior.
- Check back/navigation with dirty edits: keep drawing, discard, save/reload,
  browser refresh/close, and clear/save removal. No avatar changes before Save.
- Check the saved costume in feed/reply/DM/profile/navigation/account avatars,
  including an account without a photo. Switch accounts and verify identity.
  Check moderation blur/filter, live badges, and subscriber frames; opt-out and
  November 1 must hide art without deleting it. Nothing is uploaded or visible
  to another device. Verify the original profile photo is unchanged.
- Accept, decline, escape/backdrop, swipe/back; relaunch after each decision.
- Change the Appearance toggle in light, dim, dark, and system modes.
- Check hidden borders, composer, feed, dialogs, and saved accent restoration.
- Check all four cobwebs on phone/desktop, scrolling, rotation, and native safe
  areas. Corner controls must remain clickable; opt-out must remove the webs.
- With pets disabled, enable Halloween and check the ghost idles and flies above
  the bottom bar on mobile and at the viewport bottom on desktop. With pets
  enabled, ensure only the ghost appears and the saved animal/coat return on
  opt-out or expiry. Check click-through, reduced motion, and sign-out cleanup.
- On web, check overscroll/form CSS/browser chrome and a second tab.
- With preview off and a test clock, cross October 27→28 and October 31→November 1
  while open and while backgrounded. The mode should remain active across the
  intervening midnights. No seasonal visuals or invitation should remain on
  November 1.
