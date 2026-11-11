import {type CardKind} from '../model'
import {type CardSize} from '../slotting'

type HeadlineStyle = {
  fontSize: number
  lineHeight: number
  fontWeight: '600' | '700'
  letterSpacing: number
}

function headline(
  fontSize: number,
  lineHeight: number,
  fontWeight: '600' | '700',
  tracking = 0,
): HeadlineStyle {
  return {
    fontSize,
    lineHeight: Math.round(fontSize * lineHeight * 10) / 10,
    fontWeight,
    letterSpacing: Math.round(fontSize * tracking * 100) / 100,
  }
}

/** Inter, display optical size on web from about 32px; Bold only for the lead. */
export const HEADLINE: Record<CardSize, HeadlineStyle> = {
  lead: headline(44, 1.08, '700', -0.02),
  leadTablet: headline(40, 1.08, '700', -0.02),
  leadPhone: headline(30, 1.08, '700', -0.02),
  feature: headline(32, 1.12, '600', -0.016),
  featurePhone: headline(24, 1.12, '600', -0.016),
  standard: headline(24, 1.18, '600'),
  compact: headline(17, 1.25, '600'),
}

/** Text posts sit one step below articles in the same slot. */
export const TEXT_POST_HEADLINE: Record<CardSize, HeadlineStyle> = {
  ...HEADLINE,
  standard: headline(18, 1.3, '600'),
  compact: headline(17, 1.3, '600'),
}

export const STANDFIRST_LINES: Record<CardSize, number> = {
  lead: 3,
  leadTablet: 3,
  leadPhone: 3,
  feature: 2,
  featurePhone: 2,
  standard: 0,
  compact: 0,
}

export const STANDFIRST_SIZE: Record<CardSize, number> = {
  lead: 17,
  leadTablet: 16,
  leadPhone: 15,
  feature: 16,
  featurePhone: 15,
  standard: 16,
  compact: 15,
}

/** Playable media keeps 16:9; compact rows crop squarer so subjects stay legible. */
export function mediaRatio(kind: CardKind, size: CardSize) {
  if (kind === 'video' || kind === 'youtube') return 16 / 9
  if (size === 'compact') return 4 / 3
  return 3 / 2
}

export const COMPACT_THUMB_WIDTH = 104
/** Share of the window height the Lead image may take. */
export const LEAD_MEDIA_MAX_HEIGHT = 0.6
