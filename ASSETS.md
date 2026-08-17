# Asset licensing

The [MIT license](./LICENSE) in this repository covers our source code. It does not cover
every file in the tree.

Some of the images, icons, fonts, and brand assets here are licensed to Bluesky Social PBC
by third parties, or are our trademarks, or are third-party trademarks. We cannot pass those
rights on to you. This document identifies them.

We should have written this down sooner. If you have already forked this repository and
shipped one of the assets listed below, we are not treating that as bad faith on your part —
the repository did not tell you, and that is our fault. Please work through the
[If you are forking](#if-you-are-forking) checklist when you can.

Assets are scoped by directory wherever possible, so that adding a file to a carved-out
directory does not require an edit here. Individual paths are listed only where an asset does
not sit in a dedicated directory.

**The rule:** if a file is listed in this document, the MIT license does not grant you rights
to it. Everything in [Section 6](#6-third-party-assets-you-may-redistribute) is redistributable
on its own terms, which travel with the files.

---

## 1. Commissioned Bluesky artwork — removed

The commissioned landing-screen illustrations from the upstream Bluesky repository have been
removed from this fork. They were licensed for Bluesky's products only and must not be restored
during an upstream sync.

## 2. Licensed icon system — removed

The Central icon system glyphs inherited from the upstream Bluesky repository have been removed
from `assets/icons/`, `bskyembed/assets/`, and the app's icon components. Do not restore those
files during an upstream sync unless you hold an appropriate license from Iconists.

The replacement UI icon system is generated from MIT-licensed Phosphor Icons. Its source,
generation commands, and notice are described in [Section 6](#6-third-party-assets-you-may-redistribute)
and [`assets/icons/README.md`](./assets/icons/README.md).

## 3. Bluesky trademarks and brand assets — removed

The inherited Bluesky name, butterfly marks, logotypes, app icons, Newskie glyph, verification
glyphs, and starter-pack glyphs have been removed or replaced with Mu and openly licensed
assets. Do not restore them during an upstream sync.

You may still refer to Bluesky by name to describe interoperability or origin — for example,
"a client for Bluesky," or "based on the Bluesky app." Do not use Bluesky's marks as the
identity of this product or in a way that suggests Bluesky publishes, endorses, or supports it.

## 4. Community and contest artwork — removed

The community and contest logo variants inherited from the upstream Bluesky repository have
been removed from this fork. Do not restore them without permission from their artists.

## 5. Third-party trademarks

These marks belong to other companies. We include them to identify their services in our UI —
sign-in buttons, store badges, and links to third-party applications. We are neither granting
nor withholding permission, because it is not ours to give. Your use of them rests on your own
nominative-use basis or on permission from the mark owner.

- `assets/icons/apple_logo.svg` — Apple Inc.
- `assets/icons/android_logo.svg` — Google LLC
- `assets/icons/community/` — Leaflet, Offprint, pckt (`pckt.svg`, `pckt-full.svg`),
  Standard.site, and Germ Network (`germ_logo.webp`)

Apple's and Google's marks in particular carry their own brand guidelines governing size,
spacing, and permitted contexts. If you ship a sign-in button or a store badge, follow theirs,
not ours.

## 6. Third-party assets you may redistribute

These are licensed on terms that permit redistribution. Nothing in this document restricts them.
Their license text travels with the files, and you must keep it there.

| Asset | Path | License | Notice |
|---|---|---|---|
| Inter typeface | `assets/fonts/inter/` | SIL Open Font License 1.1 | [`OFL.txt`](./assets/fonts/inter/OFL.txt) |
| Inter typeface (OG card service) | `bskyogcard/src/assets/fonts/` | SIL Open Font License 1.1 | [`README.md`](./bskyogcard/src/assets/fonts/README.md) |
| country-flag-icons | `assets/icons/flags/` | MIT, © @catamphetamine | [`README.md`](./assets/icons/flags/README.md) |
| Phosphor UI icons | `src/components/icons/`<br>`bskyembed/src/icons/Phosphor.tsx` | MIT, © Phosphor Icons | [`NOTICE.md`](./NOTICE.md) |
| Material Icons | `bskyweb/static/media/MaterialIcons.*.ttf` | Apache License 2.0 | [`NOTICE.md`](./NOTICE.md) |

Build output under `bskyweb/static/media/` also contains compiled Inter files. They are the same
OFL-licensed typeface, emitted by the web build.

**One thing to watch on Inter:** OFL 1.1 includes a Reserved Font Name provision. If you modify
or subset the font, the result cannot be distributed under the name "Inter."

See [`NOTICE.md`](./NOTICE.md) for the consolidated third-party notices.

## 7. Product imagery — treat as not licensed to you

**`assets/images/`**

Product illustration and announcement imagery — onboarding value-prop art, chat backgrounds,
feature announcement graphics, and similar.

**Treat everything in this directory as outside the MIT license and not licensed for your use.**
Some of it is commissioned work. Rather than have you guess file by file which is which, we are
drawing the line at the directory.

If you are forking, replace these or ship without them.
See [`assets/images/README.md`](./assets/images/README.md).

## 8. Mu brand assets

Mu's name, logo, app icons, favicons, splash images, social cards, and other product-identity
assets are not Bluesky assets. Forks should still replace them with their own branding rather
than ship as Mu.

The white-label sources are `src/config/brand.json`, `assets/brand/`, and the primary app-icon
master. Run `pnpm brand` after changing them; it regenerates the runtime logo data, web and embed
identity, QR/default-avatar rasters, App Clip icon, social cards, and favicon set. See
[`docs/rebranding.md`](./docs/rebranding.md).

---

## If you are forking

You have our blessing to fork this application. To do it cleanly:

1. **Do not restore the upstream landing illustrations.** They were commissioned for Bluesky's
   products only and have been removed. See
   [Section 1](#1-commissioned-bluesky-artwork--removed).
2. **Keep the Phosphor notice if you redistribute the generated UI icons.** See
   [Section 6](#6-third-party-assets-you-may-redistribute).
3. **Replace `assets/images/`.** Treat as not licensed to you. See
   [Section 7](#7-product-imagery--treat-as-not-licensed-to-you).
4. **Do not restore the removed Bluesky marks** described in
   [Section 3](#3-bluesky-trademarks-and-brand-assets--removed).
5. **Do not restore the removed community artwork** described in
   [Section 4](#4-community-and-contest-artwork--removed).
6. **Check your own position on the third-party marks** in
   [Section 5](#5-third-party-trademarks).
7. **Keep the license notices** for the assets in
   [Section 6](#6-third-party-assets-you-may-redistribute).
8. **Change your branding, support links, and analytics** as described in the
   [Forking guidelines](./README.md#forking-guidelines).

This list is about licensing. The [Forking guidelines](./README.md#forking-guidelines) in the
README cover the rest of what makes a fork clearly distinguishable from Bluesky, which matters
both for your users and for app store review.

## Questions

If something in this repository looks like it should be on this list and is not, or if you are
unsure whether an asset is covered, open an issue or email us and we will sort it out. We would
much rather answer the question than have someone guess.

---

*Last reviewed: August 2026. This document describes the licensing position of assets in this
repository. It is not a grant of rights, and it does not modify the [MIT license](./LICENSE) as
it applies to source code.*
