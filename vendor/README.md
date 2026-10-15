# Vendored packages

Tarballs installed with `file:` specifiers from `package.json`, for packages
that are not (yet) on npm in the version the app needs.

## `@dasl/tile-loader`, `@dasl/tile-lexicon`

The hardened tile loader from the
[dasl-tiles](https://tangled.org/robin.berjon.com/dasl-tiles) monorepo at
commit `bbf5392` ("Harden tile origins: one shared policy, dead-end origins,
WebRTC guard, containment tile" and after). npm still has 2.0.0, which predates
the hardening; the tarballs carry the same version number because the monorepo
has not cut a release yet.

Built and packed from a clean checkout:

```sh
cd dasl-tiles && npm install && npm run build
npm pack ./tile-lexicon --pack-destination <app>/vendor   # from outside the app
npm pack ./tile-loader  --pack-destination <app>/vendor
```

(`npm pack` from inside the app directory trips on the app's `devEngines`.)

`pnpm-workspace.yaml` overrides `@dasl/tile-lexicon` so that the loader's own
`^2.0.0` range resolves to the vendored build rather than the npm one, which
lacks `tileResponseHeaders`.

## `@dasl/tile-host`

The hosted page that runs one tile for the native apps' WebView, from the same
monorepo at commit `800c2ed` (its first version; not on npm yet). The app
only imports `@dasl/tile-host/messages`, the dependency-free schema of the
WebView bridge; the page itself is served by webtil.es at `/host/`. Packed the
same way.

Once the monorepo releases, replace all three with the npm versions, drop the
override, and delete the tarballs. `src/features/tiles/README.md` says what
the app uses from them.
