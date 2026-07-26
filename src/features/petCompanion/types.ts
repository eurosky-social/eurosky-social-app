import {type ImageSourcePropType} from 'react-native'
import {type MessageDescriptor} from '@lingui/core'

// One animation: `frames` consecutive cells read left-to-right starting at
// (row, col), wrapping to the next row at the sheet's column count. `fps` is
// the authored playback rate. `pad` shifts the sprite down by this many
// frame-pixels so each state's feet land on a shared ground line (and can be
// nudged to intentionally sink a pose). Authored in the species' own frame
// space, independent of the on-screen size.
export interface PetClip {
  row: number
  col?: number
  frames: number
  fps: number
  pad: number
}

// The behavioural interface the director (index.tsx) drives. It maps abstract
// roles to THIS species' state names, so the director never hardcodes a
// concrete animation: a dog with no "sleep" simply omits it from `ambient`,
// and a bird that hops faster sets a higher `walkSpeed`.
export interface PetBehavior {
  // Resting state, also used between actions and on reaction end.
  idle: string
  // Looping "doing nothing" states with how long to hold each, in ms. An
  // optional `enter` is a one-shot intro played once before settling into the
  // looping `state` (e.g. lie down, then sleep). `enter` must be a non-loop
  // state; if it loops it is ignored and `state` plays directly.
  ambient: {state: string; enter?: string; min: number; max: number}[]
  // Locomotion animation, played while walking between rest spots.
  walk: string
  // On-screen travel speed, px/second.
  walkSpeed: number
  // Whether the walk art is authored facing right. Default true; set false for
  // packs whose walk cycle gallops left, so the director mirrors correctly.
  walkFacesRight?: boolean
  // States played when the pet is tapped. May be loop or one-shot states; the
  // director holds loops briefly and lets one-shots resume via onAnimationEnd.
  reactions: string[]
}

// A self-contained companion species: its art, sheet geometry, animation
// catalog, selectable variants ("skins"), and behaviour. Everything that was
// cat-specific lives here so adding a species is a new descriptor + art, with
// no changes to the renderer or director.
export interface Species {
  id: string
  // Settings label and blurb (MessageDescriptors via the `msg` macro so they
  // extract for translation while living in a data table).
  label: MessageDescriptor
  description: MessageDescriptor
  // Species sharing a family collapse into one entry in the settings' animal
  // picker (labelled with the family's label), with the members offered in a
  // second-level "breed" picker. A species without a family stands alone.
  family?: {id: string; label: MessageDescriptor}
  // Square frame side, in pixels (cat: 64).
  frame: number
  // Sheet grid dimensions.
  cols: number
  rows: number
  // Natural on-screen size, in pixels (cat: 88). Need not be a multiple of
  // `frame`; PetSprite renders at an integer scale and downsamples to fit.
  size: number
  // Optional tap target, as the art's content bounds within a frame cell (in
  // frame-space pixels, origin at the cell's top-left). When the art fills only
  // part of its cell, this keeps the tap area on the body instead of the whole
  // box. Omit to make the full `size` box tappable. Assumes a fixed vertical
  // content position (i.e. pad 0 across states); the rect is mirrored
  // horizontally when the pet faces left.
  hitbox?: {x: number; y: number; w: number; h: number}
  // Selectable skins. A single-skin species lists one variant.
  variants: readonly string[]
  variantLabels: Record<string, MessageDescriptor>
  defaultVariant: string
  // One sheet per variant, all sharing this species' geometry and catalog.
  sheets: Record<string, ImageSourcePropType>
  clips: Record<string, PetClip>
  // States that loop forever. Everything else is a one-shot that plays once,
  // holds its last frame, and reports completion via PetSprite.onAnimationEnd.
  loopStates: readonly string[]
  behavior: PetBehavior
}
