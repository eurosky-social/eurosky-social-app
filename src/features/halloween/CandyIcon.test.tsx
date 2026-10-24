import {StyleSheet} from 'react-native'
import {render} from '@testing-library/react-native'

import {AnimatedLikeIcon as NativeLikeIcon} from '#/lib/custom-animations/LikeIcon'
import {AnimatedLikeIcon as WebLikeIcon} from '#/lib/custom-animations/LikeIcon.web'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {
  Heart2_Filled_Stroke2_Corner0_Rounded as HeartFilled,
  Heart2_Stroke2_Corner0_Rounded as HeartOutline,
} from '#/components/icons/Heart2'
import {CandyIcon, candyIcons} from './CandyIcon'

jest.mock('react-native-reanimated', () => {
  const {View} = require('react-native')
  return {
    __esModule: true,
    default: {View},
    Keyframe: class {
      duration() {
        return this
      }
    },
    LayoutAnimationConfig: ({children}: React.PropsWithChildren<{}>) =>
      children,
    useReducedMotion: () => true,
  }
})
jest.mock('#/alf', () => ({
  useTheme: () => ({
    palette: {pink: '#EC4899', contrast_500: '#797876'},
    atoms: {bg: {backgroundColor: '#000000'}},
  }),
}))

function iconColor(
  screen: ReturnType<typeof render>,
  icon: React.ComponentType<SVGIconProps>,
) {
  const props = screen.UNSAFE_getByType(icon).props as SVGIconProps
  return StyleSheet.flatten(props.style)?.color
}

it('uses the supplied 24px Lucide outline with a 1.5 stroke in both states', () => {
  expect(CandyIcon.svgViewBox).toBe('0 0 24 24')
  expect(CandyIcon.svgStrokeWidth).toBe(1.5)
  expect(CandyIcon.svgPaths[0]).toContain('M10 7v10.9')
  expect(CandyIcon.svgPaths[0]).toContain('M14 6.1V17')
  expect(candyIcons.outline).toBe(candyIcons.filled)
})

describe.each([
  ['native', NativeLikeIcon],
  ['web', WebLikeIcon],
] as const)('%s like icon', (_platform, Icon) => {
  it('only colors the candy when toggled on, and restores neutral on undo', () => {
    const props = {
      hasBeenToggled: true,
      color: '#A3E635',
      icons: candyIcons,
    }
    const screen = render(<Icon {...props} isLiked={false} />)
    expect(iconColor(screen, CandyIcon)).toBe('#797876')
    screen.rerender(<Icon {...props} isLiked />)
    expect(iconColor(screen, CandyIcon)).toBe('#A3E635')
    screen.rerender(<Icon {...props} isLiked={false} />)
    expect(iconColor(screen, CandyIcon)).toBe('#797876')
  })

  it('retains normal outline/filled hearts when no seasonal icons are supplied', () => {
    const screen = render(<Icon isLiked={false} hasBeenToggled={false} />)
    expect(screen.UNSAFE_getByType(HeartOutline)).toBeTruthy()
    screen.rerender(<Icon isLiked hasBeenToggled={false} />)
    expect(iconColor(screen, HeartFilled)).toBe('#EC4899')
  })
})
