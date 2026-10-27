# Halloween ghost artwork

`ghost.png` is the white cute ghost from the user-supplied paid artwork at
`HorrorUltimateEdition/GhostPaid/Bonus/BonusCuteGhostIdle-sheet.png` in the workspace. It is **not covered by the
repository's MIT license**. Access to this repository does not grant permission
to reuse or redistribute the artwork independently. Downstream users must
obtain their own applicable license from the original rights holder or remove
this artwork. The source delivery did not include a license text.

The original PNG is copied unchanged: a transparent 256×32 image with eight
32×32 cells. Its bobbing idle cycle is also used while floating horizontally;
this bonus ghost has no separate flying cycle. It renders at 3× scale (96×96
cells) to keep the small sprite readable and pixel-crisp. No attack/death
artwork is bundled.

Playback rates are chosen for the app; no authored timing metadata was supplied.
The seasonal descriptor lives in `src/features/halloween/ghost.ts`, not the
selectable pet registry. See [`ASSETS.md`](../../../ASSETS.md).
