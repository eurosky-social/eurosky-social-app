import {render} from '@testing-library/react-native'

import {type ComposerOpts} from '#/state/shell/composer'
import {ComposePost} from '#/view/com/composer/Composer'
import {Composer as IosComposer} from './Composer.ios'
import {Composer as WebComposer} from './Composer.web'

let mockState: ComposerOpts | undefined
jest.mock('#/state/shell/composer', () => ({useComposerState: () => mockState}))
jest.mock('#/view/com/composer/Composer', () => ({
  ComposePost: jest.fn(() => null),
  useComposerCancelRef: () => ({current: null}),
}))
jest.mock('react-native/Libraries/Modal/Modal', () => ({
  __esModule: true,
  default:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}))
jest.mock('#/state/a11y', () => ({
  useA11y: () => ({reduceMotionEnabled: true}),
}))
jest.mock('#/alf', () => {
  const {createContext} = jest.requireActual<typeof import('react')>('react')
  return {
    atoms: {},
    BreakpointWidthContext: createContext<number | undefined>(undefined),
    flatten: () => ({}),
    useTheme: () => ({name: 'dark', atoms: {}}),
    useBreakpoints: () => ({gtMobile: true}),
  }
})
jest.mock('#/env', () => ({IS_LIQUID_GLASS: true}))
jest.mock('#/components/Tooltip', () => ({
  SheetCompatProvider:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}))
jest.mock('react-native-edge-to-edge', () => ({
  SystemBars: {pushStackEntry: jest.fn(), popStackEntry: jest.fn()},
}))
jest.mock('react-native-reanimated', () => {
  const {View} =
    jest.requireActual<typeof import('react-native')>('react-native')
  const transition = {duration: () => ({easing: () => ({})})}
  return {
    __esModule: true,
    default: {View},
    Easing: {out: () => null, in: () => null, exp: () => 0},
    SlideInDown: transition,
    SlideOutDown: transition,
  }
})
jest.mock('react-remove-scroll-bar', () => ({RemoveScrollBar: () => null}))
jest.mock('@radix-ui/react-focus-guards', () => ({useFocusGuards: () => {}}))
jest.mock('@radix-ui/react-focus-scope', () => ({
  FocusScope:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}))
jest.mock('@radix-ui/react-dismissable-layer', () => ({
  DismissableLayer:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}))
const AndroidComposer =
  jest.requireActual<typeof import('./Composer')>('./Composer.tsx').Composer

beforeEach(() => {
  jest.clearAllMocks()
  mockState = {
    halloweenCostumeNumber: 3,
    text: 'Trick or treat!',
    imageUris: [{uri: 'file:///costume.png', width: 512, height: 512}],
    logContext: 'Other',
    onClose: jest.fn(),
  }
})

it.each([
  ['web', WebComposer],
  ['iOS', IosComposer],
  ['Android', AndroidComposer],
])(
  'forwards the costume marker and seeded image through the %s shell',
  (_platform, Composer) => {
    render(<Composer />)
    const props = jest.mocked(ComposePost).mock.calls[0][0]
    expect(props).toEqual(expect.objectContaining(mockState!))
    expect(props.halloweenCostumeNumber).toBe(3)
  },
)
