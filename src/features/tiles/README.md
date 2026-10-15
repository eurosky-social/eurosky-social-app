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
| `permissions.ts` | who may post tiles, and the error the post pipeline throws |
| `mothership(.web).ts` | the page's one `TileMothership`, with a mu loader that resolves the PDS itself |
| `sizing.ts` | the rendered height for a manifest's `sizing` and a card width, shared by web and native |
| `host.ts` | the URL of the hosted page the native player loads (`@dasl/tile-host`) |
| `components/TileCard.tsx` | the card, shared by the feed embed and the composer preview |
| `components/TileEmbed/` | web: card that runs the tile in the page; native: card that runs it in a WebView |
| `components/TilePlayer.tsx` | native: the WebView on the hosted page, and the message bridge |

Touchpoints in upstream code, each marked `EUROSKY`:

- `lib/api/resolve.ts`: a tile at-URI resolves to an external card with `tile` set.
- `lib/api/index.ts`: the rkey is minted before the embed resolves; a tile card
  gets the post URL and the pointer; unverified accounts are refused.
- `components/Post/Embed/index.tsx`: the `link` case checks the post record for a
  pointer before the custom embed handlers.
- `view/com/composer/text-input/TextInput.web.tsx` and `TextInput.tsx`: a tile
  at-URI pasted (web) or appearing in the text (native) attaches it, since facet
  detection never sees at-URIs; a paste that is only the URI stays out of the text.
- `app.config.js`: the host page's domain in `WKAppBoundDomains` (below).
- `view/com/composer/Composer.tsx`: the paste is gated on verification with a
  toast; `post()` is told whether tiles are allowed.
- `view/com/composer/ExternalEmbed.tsx`: a tile link previews as its card.

## Who may post

Only accounts verified by one of mu's trusted verifiers (`useMuVerificationQuery`,
also verifiers themselves) may attach a tile. Anyone can repost or quote a tile
post. This is a client-side rule for now.

## Loading server

`TILES_LOAD_DOMAIN` (`EXPO_PUBLIC_TILES_LOAD_DOMAIN`, default `load.webtil.es`)
is the `@dasl/tile-server` the loader frames tiles from. webtil.es is a stopgap:
mu should run its own on a first-party domain. The loader in the app is the
hardened build (`vendor/README.md`), which stamps the tile policy on every
response the tile receives regardless of what the server does; the server-side
half (dead-end origins, the runtime CSP) depends on the server running
`@dasl/tile-server` 2.1 or later.

## Before landing

- Put tile resources behind a CDN. The loader fetches every blob straight from
  the author's PDS. Plan: a Bunny Edge Script in `services/` modelled on the RSS
  proxy (`ALLOWED_ORIGIN` default `*`), `GET /blob/{did}/{cid}` resolving the
  DID to its PDS and passing `com.atproto.sync.getBlob` through with `*` CORS,
  an immutable long cache header keyed on the CID, nosniff and an inert
  disposition or CSP. `tileBlobUrl` in `manifest.ts` is the one place to point
  at it; make it an env setting.

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
- A tile's `sizing` is honoured as an aspect ratio against the card width,
  capped between `MIN_TILE_HEIGHT` and `MAX_TILE_HEIGHT`.
- The mothership keeps a reference to every frame it has started; closing a
  tile removes the frame but the loader has no teardown API yet.
