// Fox sprite-sheet metadata. One combined PNG (AllFoxTogether.png), a 10-wide
// grid of 32x32 frames (320x256 => 10 cols, 8 rows). Each animation is one row
// played left-to-right from column 0; frame counts were measured from per-cell
// alpha. The art faces RIGHT and every frame is floor-aligned in its cell, so
// all pads are 0.
//
// Row map (confirmed against the art):
//   0 Attack  1 Walk  2 LieDown  3 hurt (unused)  4 Idle  5 Sit  6 Sleeping
//   7 Run (unused)
// The fox is a low, wide animal and only fills a small part of its cell, so its
// display `size` is larger than the cat's to read at a comparable size; 160 is
// an exact 5x of the 32px frame, so it renders with no downsample.

import {msg} from '@lingui/core/macro'

import {type PetClip, type Species} from '../../types'
import {FOX_SHEETS} from './assets'

export type FoxVariant = 'red'

const CLIPS: Record<string, PetClip> = {
  Idle: {row: 4, frames: 4, fps: 6, pad: 0}, // sit, look around
  Walk: {row: 1, frames: 4, fps: 8, pad: 0}, // trot
  LieDown: {row: 2, frames: 5, fps: 8, pad: 0}, // lie down (intro to Sleeping)
  Sleeping: {row: 6, frames: 4, fps: 5, pad: 0}, // curled, asleep
  Sit: {row: 5, frames: 2, fps: 4, pad: 0}, // settled sit
  Attack: {row: 0, frames: 8, fps: 12, pad: 0}, // playful pounce (one-shot)
  Run: {row: 7, frames: 10, fps: 12, pad: 0}, // gallop (defined, unused)
}

export const fox: Species = {
  id: 'fox',
  label: msg`Fox`,
  description: msg`A little fox trots along the bottom of the screen. Tap it to say hello.`,
  frame: 32,
  cols: 10,
  rows: 8,
  size: 160,
  // Body bounds for the standing poses (measured from the sheet's alpha), so the
  // tap target hugs the fox instead of the mostly-empty 32px cell. Deliberately
  // excludes the sleeping pose's tall "zzz" marks, which would inflate the box.
  hitbox: {x: 4, y: 20, w: 25, h: 12},
  variants: ['red'],
  variantLabels: {red: msg`Red`},
  defaultVariant: 'red',
  sheets: FOX_SHEETS,
  clips: CLIPS,
  // Attack and LieDown are one-shots; everything else loops.
  loopStates: ['Idle', 'Walk', 'Sleeping', 'Sit', 'Run'],
  behavior: {
    idle: 'Idle',
    ambient: [
      {state: 'Idle', min: 4000, max: 8000},
      {state: 'Sit', min: 6000, max: 12000},
      // Lie down first, then sleep.
      {state: 'Sleeping', enter: 'LieDown', min: 12000, max: 22000},
    ],
    // Walk art faces right, same as the cat's run, so no mirror flip needed.
    walk: 'Walk',
    walkSpeed: 60,
    walkFacesRight: true,
    // A quick playful pounce when tapped.
    reactions: ['Attack'],
  },
}
