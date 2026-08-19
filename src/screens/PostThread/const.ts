import {type Theme} from '@bsky.app/alf'

import {tokens} from '#/alf'

export const TREE_INDENT = tokens.space.lg
export const TREE_AVI_WIDTH = 24
export const LINEAR_AVI_WIDTH = 42
export const REPLY_LINE_WIDTH = 2
export const OUTER_SPACE = tokens.space.lg
export const READER_LINE_INDENT = tokens.space.sm
export const READER_BRACKET_WIDTH = 1

/**
 * Structural thread connectors remain visible when subtle interface borders
 * are hidden. They communicate reply hierarchy rather than separating UI.
 */
export function getReplyLineColor(t: Theme): string {
  return t.name === 'light' ? t.palette.contrast_100 : t.palette.contrast_200
}

// Fixed height for the seam's interaction row, so the bracket's bottom can be
// placed at its vertical center (level with the action icons).
export const READER_SEAM_HEIGHT = 28
