# Icon system

Mu uses [Lucide](https://lucide.dev/) outlines and
[Filled Lucide](https://filledlucide.dev/) solid icons with upstream's SVG-driven
component generator and `react-native-nano-icons` rendering. Filled Lucide is an
independent community project, not an official Lucide variant. Both sets are
permissively licensed (ISC/MIT); see [`NOTICE.md`](../NOTICE.md).

Do not restore Central/Iconists artwork, Bluesky-specific marks, or upstream's
prebuilt icon fonts during a sync.

## Adding or changing an icon

1. Add its exact export name and source to `scripts/lucide-icons.json`. Every UI
   and compatibility export has an explicit mapping; there is no automatic
   fallback to another icon family.
2. Run `pnpm icons:import-lucide` to import SVGs and regenerate standalone embed
   and OG-card wrappers.
3. Run `pnpm icons:generate` to generate app components and rebuild native fonts.
4. Run `pnpm icons:check`, `pnpm icons:test`, typecheck, and lint.
5. Include the manifest, SVGs, generated components, glyphmaps, and fonts in the
   same change.

Example mapping:

```json
{
  "HomeOpen_Filled_Corner0_Rounded": {
    "icon": "house",
    "variant": "filled"
  }
}
```

The manifest pins the installed source-package versions. Artwork is read locally;
code generation and freshness checks do not download icons. Update package pins,
the manifest versions, and license notices together when upgrading the sets.

## Sources and variants

- `outline`: Lucide's standard 2-unit rounded stroke.
- `bold`: a 3-unit rounded stroke, used for emphasized open forms such as selected
  lists and hashtags, which do not have a meaningful solid silhouette.
- `filled`: the corresponding Filled Lucide solid artwork. Do not obtain a solid
  state by setting `fill` on an arbitrary outline.
- `source: "lab"`: Lucide Lab outlines, currently Alien, UFO, and the peace hand.
- `source: "custom"`: reviewed exceptions under `scripts/icons/custom/`.
  Currently Tabler's GIF lettering (matching Lucide's 24x24 grid and 2-unit rounded
  stroke) and a Lucide list/star composite. These are source files, not generated
  output, and can be edited directly. Preserve their source/license notices.

Outlines are converted to a single even-odd fill path using the font compiler's
PathKit geometry engine. Stroke expansion runs at a larger internal scale to
preserve small circles and curves. Raster tests compare every imported shape to
its original SVG. The resulting icons keep the same appearance on web and native
without requiring another runtime icon library.

The importer uses a 24-unit viewBox (64 for `Large` exports), preserves existing
export names, and rejects unmapped artwork in `ui/` and `brands/`. Long export
names are compatibility names, not descriptions of Lucide's source geometry.
Bare compatibility names live in the `brands/` lane, which permits names without
UI style tokens; this does not make those icons product marks. New imports should
use the canonical module emitted by codegen.

Generated SVGs, components, wrappers, and fonts must not be edited directly. See
[`scripts/icons/README.md`](../scripts/icons/README.md) for source lanes, naming,
fallback behavior, compatibility aliases, and temporary SVG-only icons.

## Rendering and native releases

- **iOS and Android:** supported icons render as glyphs in the rebuilt native fonts.
  Gradients, SVG refs, and unsupported props fall back to SVG with the same API.
- **Web:** icons remain SVGs.
- **Standalone embeds and OG cards:** generated SVG wrappers use the same artwork,
  including post actions, robot labels, verification marks, and avatar placeholders.

Adding or changing a font glyph requires a new native build. **The Lucide migration
must ship in a native release, not only an OTA update.** For subsequent additions,
upstream's `assets/icons/tmp/` workflow supports SVG-only icons until the next
native release.

## Verification marks

`VerifiedCheck` and `VerifierCheck` use Filled Lucide's circle-check and badge-check
silhouettes with a white backing behind their checkmark cutouts. This keeps ticks
white on light, dark, and dim surfaces. App SVGs, native fonts, and standalone
embeds preserve both paint roles. `pnpm icons:test` checks their rendered ticks
and native glyph layers.

## Branding and non-icon graphics

Mu's themed logos, splash artwork, favicons, and default-avatar brand rasters remain
managed by `assets/brand/`, the `brand:*` commands, and `BrandLogo`. Country flags
and third-party service marks retain their own artwork and licensing notices.
Native fonts containing service marks carry the restrictions of those sources.

Layout graphics (thread connectors, scanner masks, avatar clipping, color-picker
gradients, and pixel-editor drawings) are not icon-family artwork and remain
unchanged. The animated success check retains its animation but uses Lucide's
circle-check geometry.
