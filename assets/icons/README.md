The licensed Central/Iconists glyphs and inherited Bluesky-specific glyphs that previously lived
at the top level of this directory have been removed from this fork. Do not restore them during
an upstream sync unless you hold the necessary rights.

The app and embed renderer now use generated
[Phosphor Icons](https://phosphoricons.com/) components under `src/components/icons/` and
`bskyembed/src/icons/Phosphor.tsx`. Phosphor is MIT licensed; see [`NOTICE.md`](../../NOTICE.md)
and [`licenses/PHOSPHOR-MIT.txt`](../../licenses/PHOSPHOR-MIT.txt). See
[`docs/icons.md`](../../docs/icons.md) before adding or changing icons.

The remaining assets here have separate licensing considerations:

- `flags/` — country-flag-icons, MIT licensed; see [`flags/README.md`](./flags/README.md)
- `community/` — third-party service marks; see [`community/README.md`](./community/README.md)
- `apple_logo.svg`, `android_logo.svg` — Apple and Google trademarks used to identify their
  services; see [`ASSETS.md`](../../ASSETS.md)
