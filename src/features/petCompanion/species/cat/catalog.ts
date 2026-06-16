// Retro Cats sprite-sheet metadata, ported from the standalone `retro-cats`
// Pixi module. Every coat is one PNG with an identical layout: a 16-wide grid
// of 64x64 frames. Each animation is one row, played left-to-right from column
// 0, so a state is a (row, frames, fps) triple shared by every coat. Frames are
// bottom-aligned within their cell.

import {msg} from '@lingui/core/macro'

import {type PetClip, type Species} from '../../types'
import {CAT_SHEETS} from './assets'

export type CatVariant =
  | 'cream'
  | 'black'
  | 'grey'
  | 'grey-white'
  | 'orange'
  | 'white'

const VARIANTS: readonly CatVariant[] = [
  'cream',
  'black',
  'grey',
  'grey-white',
  'orange',
  'white',
]

// row/frames decoded from the sheet (16x19 grid, 64px cells). See PetClip for
// the meaning of `pad`.
const CLIPS: Record<string, PetClip> = {
  Idle: {row: 0, frames: 6, fps: 8, pad: 0},
  Excited: {row: 1, frames: 3, fps: 8, pad: 0},
  Dead: {row: 2, frames: 1, fps: 6, pad: 3},
  Sleeping: {row: 3, frames: 4, fps: 5, pad: 6}, // nudged down so the tail clips
  Happy: {row: 4, frames: 10, fps: 8, pad: 2},
  Running: {row: 5, frames: 6, fps: 12, pad: 5},
  Jump: {row: 6, frames: 12, fps: 12, pad: 0},
  Box1: {row: 7, frames: 12, fps: 8, pad: 0},
  Box2: {row: 8, frames: 10, fps: 8, pad: 3},
  Box3: {row: 9, frames: 12, fps: 8, pad: 3},
  Crying: {row: 10, frames: 4, fps: 6, pad: 0},
  Dance: {row: 11, frames: 4, fps: 8, pad: 0},
  Chilling: {row: 12, frames: 8, fps: 6, pad: 0},
  Surprised: {row: 13, frames: 2, fps: 8, pad: 0},
  Tickle: {row: 14, frames: 4, fps: 8, pad: 0},
  Dead1: {row: 15, frames: 6, fps: 8, pad: 2},
  Dead2: {row: 16, frames: 5, fps: 8, pad: 6},
  Hurt: {row: 17, frames: 8, fps: 10, pad: 5},
  Attack: {row: 18, frames: 7, fps: 10, pad: 6},
}

export const cat: Species = {
  id: 'cat',
  label: msg`Cat`,
  description: msg`A little cat hangs out at the bottom of the screen. Tap it to pet it - scratch its head or tickle its belly.`,
  frame: 64,
  cols: 16,
  rows: 19,
  size: 88,
  variants: VARIANTS,
  variantLabels: {
    cream: msg`Cream`,
    black: msg`Black`,
    grey: msg`Grey`,
    'grey-white': msg`Grey and white`,
    orange: msg`Orange`,
    white: msg`White`,
  },
  defaultVariant: 'orange',
  sheets: CAT_SHEETS,
  clips: CLIPS,
  loopStates: [
    'Idle',
    'Happy',
    'Chilling',
    'Sleeping',
    'Running',
    'Jump',
    'Dance',
    'Tickle',
    'Crying',
    'Box1',
    'Box2',
    'Box3',
  ],
  behavior: {
    idle: 'Idle',
    ambient: [
      {state: 'Idle', min: 4000, max: 8000},
      {state: 'Chilling', min: 6000, max: 12000},
      {state: 'Happy', min: 6000, max: 12000}, // content loaf
      {state: 'Sleeping', min: 12000, max: 22000},
    ],
    walk: 'Running',
    walkSpeed: 60,
    walkFacesRight: true,
    reactions: ['Excited', 'Happy'],
  },
}
