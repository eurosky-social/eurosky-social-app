import {msg} from '@lingui/core/macro'

import {type Species} from '#/features/petCompanion/types'

/** Seasonal override only; deliberately absent from the saved pet picker. */
export const halloweenGhost: Species = {
  id: 'halloween-ghost',
  label: msg`Ghost`,
  description: msg`A little ghost floats along the bottom of the screen.`,
  frame: 32,
  cols: 8,
  rows: 1,
  size: 96,
  variants: ['ghost'],
  variantLabels: {ghost: msg`Ghost`},
  defaultVariant: 'ghost',
  sheets: {ghost: require('../../../assets/pets/halloween/ghost.png')},
  clips: {
    // Remove the six transparent bottom rows; the authored bob still floats.
    Idle: {row: 0, frames: 8, fps: 6, pad: 6},
  },
  loopStates: ['Idle'],
  behavior: {
    idle: 'Idle',
    ambient: [{state: 'Idle', min: 3000, max: 6500}],
    // The bonus ghost has one bobbing cycle, shared while resting and moving.
    walk: 'Idle',
    walkSpeed: 35,
    // The cute ghost artwork faces left before mirroring.
    walkFacesRight: false,
    reactions: [],
  },
}
