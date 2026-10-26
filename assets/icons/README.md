# Mu icons

The licensed Central/Iconists glyphs and inherited Bluesky-specific glyphs have been removed
or replaced with MIT-licensed [Phosphor Icons](https://phosphoricons.com/). Do not restore the
restricted SVGs or upstream's prebuilt fonts during a sync.

Phosphor artwork is imported into `ui/` and `brands/`, then upstream's SVG codegen generates
components under `src/components/icons/` and rebuilds the native fonts under `assets/nano-icons/`.
The `brands/` lane also holds bare compatibility names such as `VerifiedCheck` and `Tote`; those
are Phosphor replacements, not inherited Bluesky marks.

See [`docs/icons.md`](../../docs/icons.md) for the import/generation workflow and
[`scripts/icons/README.md`](../../scripts/icons/README.md) for generator details.
Phosphor's attribution is in [`NOTICE.md`](../../NOTICE.md) and its full license is in
[`licenses/PHOSPHOR-MIT.txt`](../../licenses/PHOSPHOR-MIT.txt).

Other assets have separate licensing considerations:

| Asset | Rights holder | See |
|---|---|---|
| `flags/` | @catamphetamine, MIT licensed | [`flags/README.md`](./flags/README.md) |
| `community/` | Third-party services | [`community/README.md`](./community/README.md) |
| `brands/AppleLogo.svg` | Apple Inc. | [`ASSETS.md`](../../ASSETS.md#5-third-party-trademarks) |
| `brands/AndroidLogo.svg` | Google LLC | [`ASSETS.md`](../../ASSETS.md#5-third-party-trademarks) |

Their restrictions also apply to glyphs derived from these marks in the native fonts. Update
[`ASSETS.md`](../../ASSETS.md) when adding artwork whose licensing is not already covered.
