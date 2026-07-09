// Dog sprite packs. All eight breeds come from the same artist series: 64x64
// frames, one animation per row, art facing RIGHT and floor-aligned in its
// cell. The per-animation strips were combined into one sheet per breed (see
// assets/pets/dogs), all sharing the same ten states, so a single factory
// builds every breed's Species from its measured frame counts.
//
// Standard row order in the rebuilt sheets:
//   0 Idle  1 Run  2 Sitting  3 LieDown  4 Sleeping  5 Bark  6 Sniff
//   7 Attack  8 Hurt  9 Die
// The Labrador keeps its pack's original combined sheets (three coats) and the
// Pharaoh Hound has Eating instead of Sniff, so both override the row map.
//
// Sitting and LieDown are one-shot transitions that end seated/lying, so the
// director's ambient `enter` mechanic plays them once and then settles into a
// looping hold state (SitIdle / Sleeping). Attack, Hurt and Die are defined
// but unused, like the fox's Run.

import {type ImageSourcePropType} from 'react-native'
import {type MessageDescriptor} from '@lingui/core'
import {msg} from '@lingui/core/macro'

import {type PetClip, type Species} from '../../types'
import {DOG_SHEETS, LABRADOR_SHEETS} from './assets'

const ROWS: Record<string, number> = {
  Idle: 0,
  Run: 1,
  Sitting: 2,
  LieDown: 3,
  Sleeping: 4,
  Bark: 5,
  Sniff: 6,
  Attack: 7,
  Hurt: 8,
  Die: 9,
}

// Playback rates shared by every breed; the packs are authored around 8fps.
const FPS: Record<string, number> = {
  Idle: 6,
  Run: 10,
  Sitting: 8,
  LieDown: 8,
  Sleeping: 4,
  Bark: 10,
  Sniff: 8,
  Eating: 8,
  Attack: 12,
  Hurt: 10,
  Die: 8,
}

const DOG_DESCRIPTION = msg`A loyal dog trots along the bottom of the screen. Tap it to make it bark.`

// On-screen body height to match the cat's (64px cells at size 88, body 45px
// tall => ~62px on screen). The dog packs leave much more empty cell above the
// art than the cat's, and each breed fills a different share of its cell, so
// the display size is derived from the breed's measured body height (the
// hitbox) rather than fixed.
const BODY_SCREEN_HEIGHT = 62

// All breeds collapse into one "Dog" entry in the animal picker, with the
// breed chosen in a second-level picker.
const DOG_FAMILY = {id: 'dog', label: msg`Dog`}

function makeDog(spec: {
  id: string
  label: MessageDescriptor
  /** Sheet grid width (the longest animation's frame count); rows are always 10. */
  cols: number
  /** Frame count per state, measured from the source strips' alpha. */
  frames: Record<string, number>
  /** Row overrides for packs whose sheet has a different row order. */
  rows?: Record<string, number>
  /** Pad overrides for states whose art floats above the cell floor. */
  pads?: Record<string, number>
  /** Idle art's content bounds within a cell, for the tap target. */
  hitbox: {x: number; y: number; w: number; h: number}
  variants?: readonly string[]
  variantLabels?: Record<string, MessageDescriptor>
  defaultVariant?: string
  sheets: Record<string, ImageSourcePropType>
}): Species {
  const rows = spec.rows ?? ROWS
  const clips: Record<string, PetClip> = {}
  for (const [state, row] of Object.entries(rows)) {
    clips[state] = {
      row,
      frames: spec.frames[state],
      fps: FPS[state],
      pad: spec.pads?.[state] ?? 0,
    }
  }
  // Seated hold played after the one-shot sit-down: a slow loop over the last
  // two frames of the sitting animation (a subtle seated fidget).
  clips.SitIdle = {
    row: rows.Sitting,
    col: spec.frames.Sitting - 2,
    frames: 2,
    fps: 2,
    pad: spec.pads?.Sitting ?? 0,
  }
  // The Pharaoh Hound pack has Eating where the others have Sniff; either way
  // it's an in-place looping "nose to the ground" ambient.
  const sniff = 'Sniff' in rows ? 'Sniff' : 'Eating'
  const size = Math.round((BODY_SCREEN_HEIGHT * 64) / spec.hitbox.h)
  return {
    id: spec.id,
    label: spec.label,
    description: DOG_DESCRIPTION,
    family: DOG_FAMILY,
    frame: 64,
    cols: spec.cols,
    rows: 10,
    size,
    hitbox: spec.hitbox,
    variants: spec.variants ?? ['classic'],
    variantLabels: spec.variantLabels ?? {classic: msg`Classic`},
    defaultVariant: spec.defaultVariant ?? 'classic',
    sheets: spec.sheets,
    clips,
    loopStates: ['Idle', 'Run', 'SitIdle', 'Sleeping', sniff],
    behavior: {
      idle: 'Idle',
      ambient: [
        {state: 'Idle', min: 4000, max: 8000},
        {state: 'SitIdle', enter: 'Sitting', min: 6000, max: 12000},
        {state: sniff, min: 5000, max: 9000},
        {state: 'Sleeping', enter: 'LieDown', min: 12000, max: 22000},
      ],
      walk: 'Run',
      // A gallop needs to actually cover ground or the dog looks like it's
      // running in place. Scaled with the rendered size (~0.9px/s per screen
      // pixel of body: ~120px/s for a size-137 dog vs the cat's 60).
      walkSpeed: Math.round(size * 0.9),
      walkFacesRight: true,
      reactions: ['Bark'],
    },
  }
}

export const labrador = makeDog({
  id: 'labrador',
  label: msg`Labrador`,
  cols: 16,
  // The pack's own combined sheet, so the row order differs from the rebuilt
  // sheets (identified by pixel-matching rows against the individual strips).
  rows: {
    Idle: 0,
    LieDown: 1,
    Sitting: 2,
    Sleeping: 3,
    Hurt: 4,
    Run: 5,
    Die: 6,
    Sniff: 7,
    Attack: 8,
    Bark: 9,
  },
  frames: {
    Idle: 6,
    LieDown: 12,
    Sitting: 8,
    Sleeping: 8,
    Hurt: 9,
    Run: 6,
    Die: 11,
    Sniff: 16,
    Attack: 11,
    Bark: 9,
  },
  hitbox: {x: 6, y: 35, w: 47, h: 29},
  variants: ['ruby', 'blond', 'reddish'],
  variantLabels: {
    ruby: msg`Brown`,
    blond: msg`Blond`,
    reddish: msg`Reddish`,
  },
  defaultVariant: 'ruby',
  sheets: LABRADOR_SHEETS,
})

export const goldenRetriever = makeDog({
  id: 'golden-retriever',
  label: msg`Golden Retriever`,
  cols: 29,
  frames: {
    Idle: 10,
    Run: 6,
    Sitting: 8,
    LieDown: 12,
    Sleeping: 8,
    Bark: 11,
    Sniff: 29,
    Attack: 17,
    Hurt: 15,
    Die: 15,
  },
  hitbox: {x: 5, y: 35, w: 49, h: 29},
  sheets: {classic: DOG_SHEETS['golden-retriever']},
})

export const husky = makeDog({
  id: 'husky',
  label: msg`Husky`,
  cols: 24,
  frames: {
    Idle: 6,
    Run: 6,
    Sitting: 8,
    LieDown: 12,
    Sleeping: 8,
    Bark: 10,
    Sniff: 24,
    Attack: 15,
    Hurt: 15,
    Die: 18,
  },
  hitbox: {x: 5, y: 32, w: 49, h: 32},
  sheets: {classic: DOG_SHEETS.husky},
})

export const dalmatian = makeDog({
  id: 'dalmatian',
  label: msg`Dalmatian`,
  cols: 26,
  frames: {
    Idle: 7,
    Run: 5,
    Sitting: 8,
    LieDown: 12,
    Sleeping: 8,
    Bark: 12,
    Sniff: 26,
    Attack: 16,
    Hurt: 15,
    Die: 11,
  },
  hitbox: {x: 3, y: 35, w: 51, h: 29},
  sheets: {classic: DOG_SHEETS.dalmatian},
})

export const rottweiler = makeDog({
  id: 'rottweiler',
  label: msg`Rottweiler`,
  cols: 31,
  frames: {
    Idle: 6,
    Run: 5,
    Sitting: 8,
    LieDown: 12,
    Sleeping: 8,
    Bark: 12,
    Sniff: 31,
    Attack: 18,
    Hurt: 15,
    Die: 15,
  },
  // The run cycle's lowest frame still floats 2px above the cell floor.
  pads: {Run: 2},
  hitbox: {x: 6, y: 35, w: 47, h: 29},
  sheets: {classic: DOG_SHEETS.rottweiler},
})

export const caneCorso = makeDog({
  id: 'cane-corso',
  label: msg`Cane Corso`,
  cols: 16,
  frames: {
    Idle: 7,
    Run: 7,
    Sitting: 7,
    LieDown: 7,
    Sleeping: 3,
    Bark: 9,
    Sniff: 12,
    Attack: 16,
    Hurt: 6,
    Die: 10,
  },
  hitbox: {x: 3, y: 35, w: 51, h: 29},
  sheets: {classic: DOG_SHEETS['cane-corso']},
})

export const dogoArgentino = makeDog({
  id: 'dogo-argentino',
  label: msg`Dogo Argentino`,
  cols: 16,
  frames: {
    Idle: 7,
    Run: 7,
    Sitting: 7,
    LieDown: 7,
    Sleeping: 3,
    Bark: 9,
    Sniff: 12,
    Attack: 16,
    Hurt: 6,
    Die: 10,
  },
  hitbox: {x: 3, y: 35, w: 51, h: 29},
  sheets: {classic: DOG_SHEETS['dogo-argentino']},
})

export const pharaohHound = makeDog({
  id: 'pharaoh-hound',
  label: msg`Pharaoh Hound`,
  cols: 15,
  rows: {
    Idle: 0,
    Run: 1,
    Sitting: 2,
    LieDown: 3,
    Sleeping: 4,
    Bark: 5,
    Eating: 6,
    Attack: 7,
    Hurt: 8,
    Die: 9,
  },
  frames: {
    Idle: 6,
    Run: 6,
    Sitting: 8,
    LieDown: 8,
    Sleeping: 8,
    Bark: 9,
    Eating: 15,
    Attack: 11,
    Hurt: 10,
    Die: 8,
  },
  hitbox: {x: 6, y: 34, w: 48, h: 30},
  sheets: {classic: DOG_SHEETS['pharaoh-hound']},
})

// Picker order for the settings screen.
export const DOG_LIST: readonly Species[] = [
  labrador,
  goldenRetriever,
  husky,
  dalmatian,
  rottweiler,
  caneCorso,
  dogoArgentino,
  pharaohHound,
]
