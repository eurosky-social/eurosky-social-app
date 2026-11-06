# Icons

Restricted upstream UI and brand glyphs have been removed or replaced with
[Lucide](https://lucide.dev/) and [Filled Lucide](https://filledlucide.dev/) artwork.
Do not restore Central/Iconists artwork or inherited Bluesky marks during a sync.

The pinned source mappings live in `scripts/lucide-icons.json`. Run
`pnpm icons:import-lucide`, then `pnpm icons:generate` to rebuild SVGs, components,
and native fonts together. Files in `ui/` and non-service compatibility icons in
`brands/` are generated, not hand-edited. Editable custom additions live in
`scripts/icons/custom/`.

See [`docs/icons.md`](../../docs/icons.md) for the complete workflow and
[`scripts/icons/README.md`](../../scripts/icons/README.md) for codegen policies.
Attribution and full ISC/MIT license texts are linked from
[`NOTICE.md`](../../NOTICE.md). Flags, product logos, and third-party service
marks retain their own licensing terms.
