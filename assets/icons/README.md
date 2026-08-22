The licensed Central/Iconists glyphs and inherited Bluesky-specific glyphs that previously lived
at the top level of this directory have been removed from this fork. Do not restore them during
an upstream sync unless you hold the necessary rights.

The app and embed renderer now use generated
[Phosphor Icons](https://phosphoricons.com/) components under `src/components/icons/` and
`bskyembed/src/icons/Phosphor.tsx`. Phosphor is MIT licensed; see [`NOTICE.md`](../../NOTICE.md)
and [`licenses/PHOSPHOR-MIT.txt`](../../licenses/PHOSPHOR-MIT.txt). See
[`docs/icons.md`](../../docs/icons.md) before adding or changing icons.

The remaining assets here have separate licensing considerations:

| Asset | Rights holder | See |
|---|---|---|
| `flags/` | @catamphetamine, MIT licensed | [`flags/README.md`](./flags/README.md) |
| `community/` | Third-party services | [`community/README.md`](./community/README.md) |
| `apple_logo.svg` | Apple Inc. | [`ASSETS.md`](../../ASSETS.md#5-third-party-trademarks) |
| `android_logo.svg` | Google LLC | [`ASSETS.md`](../../ASSETS.md#5-third-party-trademarks) |

Adding or changing a UI icon? Follow [`docs/icons.md`](../../docs/icons.md). For other assets,
update [`ASSETS.md`](../../ASSETS.md) when their licensing is not already covered.
