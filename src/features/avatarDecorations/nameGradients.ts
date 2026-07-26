/**
 * Curated display-name gradients (Eurosky+).
 *
 * A subscriber's settings record names a gradient by id; unknown ids are
 * ignored, so gradients added later degrade gracefully in older builds.
 *
 * Colors are chosen to stay legible against BOTH the light and dark name
 * backgrounds - i.e. mid-luminance, saturated - because the same stops render
 * on either theme. `solid` is a representative single color used where a true
 * text gradient isn't available (native, until masked-view lands).
 */
export type NameGradient = {
  id: string
  /* Picker display name. Product names, not translated. */
  name: string
  /* Linear-gradient stops, left to right (2+). */
  colors: string[]
  /* Representative solid fallback. */
  solid: string
}

export const NAME_GRADIENTS: NameGradient[] = [
  {
    id: 'sunset',
    name: 'Sunset',
    colors: ['#FF9D2B', '#F2571F', '#DB4AA6'],
    solid: '#F2571F',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: ['#28ACDC', '#1C8DBA', '#6366F1'],
    solid: '#1C8DBA',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    colors: ['#22C55E', '#14B8A6', '#28ACDC'],
    solid: '#14B8A6',
  },
  {
    id: 'rose',
    name: 'Rose',
    colors: ['#EF86CB', '#DB4AA6', '#A73981'],
    solid: '#DB4AA6',
  },
  {
    id: 'ember',
    name: 'Ember',
    colors: ['#F97316', '#EF4444', '#DB2777'],
    solid: '#EF4444',
  },
  {
    id: 'violet',
    name: 'Violet',
    colors: ['#8B5CF6', '#7C3AED', '#DB4AA6'],
    solid: '#7C3AED',
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    colors: ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6'],
    solid: '#7C3AED',
  },
]

export function getNameGradient(
  id: string | undefined,
): NameGradient | undefined {
  if (!id) return undefined
  return NAME_GRADIENTS.find(g => g.id === id)
}
