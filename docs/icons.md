# Icon system

Mu uses MIT-licensed [Phosphor Icons](https://phosphoricons.com/) with upstream's SVG-driven
component generator and `react-native-nano-icons` rendering. Attribution and the full license
are in [`NOTICE.md`](../NOTICE.md) and [`licenses/PHOSPHOR-MIT.txt`](../licenses/PHOSPHOR-MIT.txt).
Do not restore Central/Iconists artwork or upstream's prebuilt icon fonts during a sync.

## Adding or changing an icon

1. Add its export name, Phosphor slug, and weight to `scripts/phosphor-icons.json`. Compatibility
   exports introduced upstream are mapped in `scripts/phosphor-upstream-icons.json`; these infer
   `fill` from `Filled` in the name and otherwise use `regular`.
2. Run `pnpm icons:import-phosphor` to import SVGs and update the standalone embed wrappers.
3. Run `pnpm icons:generate` to generate app components and rebuild the native icon fonts.
4. Run `pnpm icons:check`, `pnpm icons:test`, typecheck, and lint.
5. Include the SVGs, generated components, glyphmaps, and fonts in the same change.

The importer normalizes Phosphor's 256-unit artwork into upstream's 24-unit viewBox (64 for
`Large` exports). The long export names are compatibility names, not descriptions of Phosphor's
source geometry. Bare compatibility names such as `VerifiedCheck` live in the `brands/` lane,
which permits names without UI style tokens. Existing imports are preserved through generated
aliases; new imports should use the canonical module emitted by codegen.

The generated SVGs, components, embed wrappers, and fonts must not be edited directly. The
importer rejects unreviewed additions to `ui/` and `brands/` so an upstream sync cannot silently
restore restricted artwork. Other source lanes, including temporary SVG-only icons, use
upstream's generator directly. See
[`scripts/icons/README.md`](../scripts/icons/README.md) for source lanes, naming rules, fallback
behavior, compatibility aliases, and temporary SVG-only icons for OTA updates.

## Rendering

- **iOS and Android:** supported icons render as glyphs in the rebuilt native fonts. Gradients,
  SVG refs, and other unsupported props fall back to SVG without changing the component API.
- **Web:** icons remain SVGs.
- **Standalone embeds:** use the generated Phosphor Preact wrappers, not the native fonts.

Adding or changing a font glyph requires a new native build. Do not ship a new glyph only through
an OTA update. Upstream's `assets/icons/tmp/` workflow supports new SVG-only icons until the next
native release.

## Weights

- `regular`: default outlines and inactive navigation.
- `bold`: emphasized outlines, such as selected Feeds and Lists.
- `fill`: selected navigation, active toggles, and solid controls such as Play and Pause.

Use matching Phosphor variants rather than filling an outline from another icon family.

## Branding and third-party marks

Mu's themed brand logos, splash artwork, favicons, and external assets remain managed by
`assets/brand/`, the `brand:*` commands, and `BrandLogo`. They are not replaced by this pipeline.
Country flags and third-party service marks retain their own licensing notices. Native fonts
containing service marks carry the same restrictions as those source marks.
