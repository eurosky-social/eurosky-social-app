# Tiles

Fork-owned support for embedding [DASL web tiles](https://dasl.ing/) in posts.

A tile is a self-contained bundle of web content published as an
`ing.dasl.masl` record (its MASL manifest), with every resource a blob on the
author's PDS. The loader runs it in an iframe on a throwaway origin served by
a tile loading server, with a service worker answering every request from the
tile's own resources and a CSP that keeps the tile from reaching anything else.

## What a tile post is

A tile post is an ordinary `app.bsky.embed.external` link card, so every client
shows something sensible, plus a pointer:

- `external.uri` is the URL of the post itself on mu (`/profile/<handle>/post/<rkey>`),
  which is why `post()` mints the record key before it resolves the embed.
- `external.title` / `description` come from the manifest's `name` / `description`.
- `external.thumb` is the manifest's first screenshot with a translucent play
  button drawn over it (`thumb.web.ts`), so the card reads as playable anywhere.
- `external.tile` is `{uri, cid}`: the strongRef of the tile record
  (`record.ts`, `TileExternal`). Lexicon objects admit unknown fields, so the PDS
  keeps it; the appview's `#viewExternal` does not carry it, so renderers read it
  from `PostView.record`.

In another client the card links to the post on mu, where the tile plays. On mu,
`TileEmbed` renders the card and, when clicked, swaps the screenshot for the
running tile instead of following the link.

## Pieces

| File | Role |
| --- | --- |
| `detect.ts` | `at://<repo>/ing.dasl.masl/<rkey>` parsing and scanning |
| `record.ts` | `TileRef` / `TileExternal`, reading the pointer off a post record |
| `manifest.ts` | manifest helpers: resource CIDs, blob URLs, the screenshot |
| `resolve.ts` | reads the tile record from the author's PDS (handle or any DID) |
| `thumb(.web).ts` | the card thumbnail; the web build composites the play button |
| `permissions.ts` | whether a tile's author is trusted, and the error the post pipeline throws |
| `policy.ts` | the switch that pauses every tile: the admin repo's `social.mu.tiles.policy` record, read at play time |
| `author.ts` | the author of a tile (the repo in its URI), the trust check, and the hook the card footer uses |
| `attach.ts` | attaching a tile to a post draft, with the author check; used by the paste path and the toolbar button |
| `mothership(.web).ts` | the page's one `TileMothership`, with a mu loader that resolves the PDS itself |
| `sizing.ts` | the rendered height for a manifest's `sizing` and a card width, shared by web and native |
| `host.ts` | the URL of the hosted page the native player loads (`@dasl/tile-host`) |
| `components/TileCard.tsx` | the card, shared by the feed embed and the composer preview |
| `components/AddTileButton.tsx` | the composer toolbar button and its dialog, which asks for a tile's at-URI |
| `components/TileAuthor.tsx` | the footer line: the author's avatar, name, check and handle |
| `components/TileEmbed/` | web: card that runs the tile in the page; native: card that runs it in a WebView |
| `components/TilePlayer.tsx` | native: the WebView on the hosted page, and the message bridge |

Touchpoints in upstream code, each marked `EUROSKY`:

- `lib/api/resolve.ts`: a tile at-URI resolves to an external card with `tile` set.
- `lib/api/index.ts`: the rkey is minted before the embed resolves; a tile card
  gets the post URL and the pointer; a tile by an unverified author is refused.
- `components/Post/Embed/index.tsx`: the `link` case checks the post record for a
  pointer before the custom embed handlers, and tells the embed whether it may
  spread to the post's edges (not in a quote or a DM) and whether to autoplay
  (the post is shown on its own, as a thread's anchor, rather than in a feed).
- `view/com/composer/text-input/TextInput.web.tsx` and `TextInput.tsx`: a tile
  at-URI pasted (web) or appearing in the text (native) attaches it, since facet
  detection never sees at-URIs; a paste that is only the URI stays out of the text.
- `app.config.js`: the host page's domain in `WKAppBoundDomains` (below).
- `view/com/composer/Composer.tsx`: a pasted tile is resolved and its author
  checked before it is attached (`attach.ts`); a tile by an unverified author
  gets a toast. The footer toolbar has the add-tile button next to the GIF
  one, disabled while the post carries a link card or media (one tile per
  post, and the pipeline prefers media to a card) and back once it is removed.
- `view/com/composer/ExternalEmbed.tsx`: a tile link previews as its card.

## Who may post, and whose tiles run

Anyone may post, repost or quote a tile. What is gated is the tile itself: it
only runs if its *author*, the account whose repo holds the `ing.dasl.masl`
record, is verified by one of mu's trusted verifiers (`useMuVerificationQuery`)
or is one of them. A tile is code, so the trust root is ours alone: Bluesky's
own verifications do not count, and a denylisted account never does
(`permissions.ts`).

The check is applied where it matters, at play time: `TileEmbed` asks
`fetchIsTrustedTile` when the card is clicked, before the loader (web) or the
WebView (native) touches anything of the tile. That covers posts from any
client and authors who have lost their verification since posting. The card
shows the verdict once it is known: the footer names the author, with the check
when they are verified and a link to their profile, and a tile by an
unverified author says so there. The composer and the post pipeline apply the same check up front
so nobody attaches a card that will never play. This is a client-side rule for
now.

## Pausing every tile

`social.mu.tiles.policy` (`lexicons/social/mu/tiles/policy.json`) is a
singleton record in the brand's admin repo, the account that owns the
trusted-verifier list in `brand.json`, so the people who decide whose tiles
run also decide whether any do. `policy.ts` reads it with a one-minute refetch
while any tile embed is mounted, and every gate asks it first: a card shows a
pause icon and the record's `message` instead of offering to play, autoplay
stays off, a tile running when the switch flips comes down, and the composer
and the post pipeline refuse to attach one. No record, or an admin PDS that
cannot be reached, means tiles play: the switch can stop them, an outage
cannot. `services/tiles/policy.mjs` flips it from a terminal with the admin
account's app password; open apps notice within a minute, with no release.

## Playing

On the web a running tile is given the whole post: when the card is clicked,
the embed measures how far it sits in from the post's edges (the avatar column,
the padding) by the test ids upstream puts on feed items and thread posts, and
cancels that out with negative margins, so the frame runs flush from edge to
edge, without side borders or rounding. Nothing is measured in a quote or a DM,
where the tile keeps its card's width; native keeps the column too, having no
DOM to measure the post by.

The height follows the manifest's `sizing` at the width the tile ends up with
(`sizing.ts`): the requested size scaled to the width but never shorter than
the height it asked for, the way the reference loader honours a declared
height as is; a wider column grows it in proportion; no sizing means 16:9.
As it runs, a tile can ask for another height over the size protocol
(https://dasl.ing/tp-size.html), and one whose manifest declares `sizing.fit`
follows its content without any script of its own. Whatever is asked for is
settled by the rules all tile contexts share (`resolveSize` in
`@dasl/tile-lexicon`): inside the range the manifest declares, then inside
mu's limits (`tileLimits` in `sizing.ts`), which win. On the web
the loader's `tileSize` passes requests on and tells the tile what it got; on
native the hosted page sends them up as `size` events and the WebView is
resized.

mu's limits are these. The width is nailed to the column: minimum and maximum
are both the column's width, so a tile can ask for another and will be told
the one it has. The height is at least `MIN_TILE_HEIGHT` and at most the
viewport's height less `TILE_POST_CHROME`, the room kept on screen for the
app's bars, the post's author line above the tile, and the card's footer and
the post's actions below it, so a running tile never pushes its own post off
screen. Native takes the safe areas off the viewport first. The limits follow
the window: rotating a phone or resizing a browser settles the tile again.
The frame fills a div whose height React owns, so a resize never remounts the
tile. A post shown on its own, as the anchor of its thread rather than as a
feed item, loads the tile on mount instead of waiting for a click; the card's
link is the plain post URL, so other clients lead there.

## Loading server

`TILES_LOAD_DOMAIN` (`EXPO_PUBLIC_TILES_LOAD_DOMAIN`, default `load.webtil.es`)
is the `@dasl/tile-server` the loader frames tiles from. webtil.es is a stopgap:
mu's own is `services/tileLoader`, the same server as a Bunny Edge Script for
`load.t.mu.social`, switched on by setting the variable in
`.github/environments/common.env` once it is deployed. The loader in the app
(`@dasl/tile-loader` 2.3 or later, from npm) stamps the tile policy on every
response the tile receives regardless of what the server does; the server-side
half (dead-end origins, the runtime CSP, a worker that survives being
restarted) depends on the server running `@dasl/tile-server` 2.2.1 or later.

## Blob CDN

Every resource of a tile is a blob on its author's PDS, and the web loader
fetches each one when the tile runs. With `TILES_BLOB_URL`
(`EXPO_PUBLIC_TILES_BLOB_URL`; `https://tiles.mu.social` for every web
environment, in `.github/environments/common.env`) set, `tileBlobUrl`
(`manifest.ts`) points those fetches, and the card screenshot the composer
composites, at `services/tiles` instead: a Bunny Edge Script that answers
`GET /blob/<did>/<cid>` by resolving the DID to its PDS and passing
`com.atproto.sync.getBlob` through, so the pull zone caches each blob by CID
for good and a tile costs its author's PDS about one fetch per resource per
edge location rather than one per viewer. The script serves blobs with `*`
CORS and the same inert headers the reference PDS uses; see its README for
the deploy and the pull-zone settings to check. Unset, everything is fetched
from the PDS as before.

The native path does not go through it: the hosted page (`@dasl/tile-host`)
runs the reference loader, which fetches from the PDS itself. Teaching the
page a blob base URL is a change to that package.

## Native

The loader needs iframes and a service worker, which React Native has no
equivalent of, so iOS and Android run the tile in a WebView on a hosted page:
[`@dasl/tile-host`](https://tangled.org/robin.berjon.com/dasl-tiles/tree/main/tile-host),
`TILES_HOST_URL` (`EXPO_PUBLIC_TILES_HOST_URL`, default
`https://webtil.es/host/`). The page runs the same hardened loader against the
same loading server; `TilePlayer` only talks to it over the WebView message
bridge (manifest size, readiness, errors) and keeps anything but the page out
of the top frame, sending links a tile opens through `useOpenLink`.

Two things the native builds need:

- **iOS: App-Bound Domains.** WKWebView only provides service workers to
  app-bound domains, so `app.config.js` lists the host page's domain in
  `WKAppBoundDomains` (derived from the two env settings) and the player sets
  `limitsNavigationsToAppBoundDomains`. Changing the host or loading domain
  means a new native build. Up to ten domains fit.
- **WebRTC on iOS.** The loader spends Chromium's peer-connection budget before
  a tile loads, which covers Android's WebView. WebKit has no such cap, so on
  iOS, as in Safari, WebRTC egress from a tile stays open.

Neither native app could be built here (no Xcode, no Android SDK), so the native
path is typechecked and its pure parts tested, and the host page itself is
tested end to end in Chromium in its own package; it has not been run on a
device yet. The one assumption to confirm on a device is that service workers
work in the WebView for subdomains of an app-bound domain.

## Limits

- Native posts a tile with its plain screenshot as the card image: the play
  button is composited with a canvas, which only the web build has.
- The native embed starts at the default height and adjusts when the host page
  reports the manifest's size, under the loading overlay.
- The rendered height is kept between `MIN_TILE_HEIGHT` and what the screen
  leaves once the post's chrome is counted (`tileLimits`), whatever the
  manifest or the running tile asks for. `TILE_POST_CHROME` is one figure for
  every layout, not a measurement of the post.
- A running tile has no close button: it stays until the post leaves the
  screen (or tiles are paused). The mothership keeps a reference to every
  frame it has started, and the loader has no teardown API yet.
