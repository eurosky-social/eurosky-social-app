import {useState} from 'react'
import {Text} from 'react-native'
import {setupI18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {fireEvent, render, within} from '@testing-library/react-native'

import {createCostume, TRANSPARENT} from './model'
import {useDrawing} from './useDrawing'
import {CostumeWorkspace} from './Workspace'

jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => {
  const React = require('react') as typeof import('react')
  const RN = jest.requireActual<typeof import('react-native')>('react-native')
  /* Web scroll refs have scrollTo, but no native setNativeProps method. */
  const ScrollView = React.forwardRef<
    {scrollTo: () => void},
    React.ComponentProps<typeof RN.View> & {scrollEnabled?: boolean}
  >(function WebScrollViewMock(props, ref) {
    'use no memo'
    React.useImperativeHandle(ref, () => ({scrollTo: () => {}}))
    return <RN.View {...props} />
  })
  return {__esModule: true, default: ScrollView}
})

jest.mock('#/alf', () => ({
  atoms: {},
  useTheme: () => ({
    atoms: {},
    palette: {
      primary_500: '#FF8A24',
      contrast_700: '#111111',
      contrast_500: '#777777',
      contrast_300: '#AAAAAA',
    },
  }),
}))
jest.mock('#/view/com/util/UserAvatar', () => ({UserAvatar: () => null}))
jest.mock('#/components/Typography', () => ({
  Text: jest.requireActual<typeof import('react-native')>('react-native').Text,
}))
jest.mock('#/components/Toast', () => ({show: jest.fn()}))
jest.mock('#/components/Button', () => {
  const {Pressable, Text} = require('react-native')
  return {Button: Pressable, ButtonText: Text, ButtonIcon: () => null}
})
jest.mock('#/components/forms/TextField', () => {
  const {View, TextInput} = require('react-native')
  return {Root: View, Input: TextInput}
})
const i18n = setupI18n({locale: 'en', messages: {en: {}}})

function Harness({active = true}: {active?: boolean}) {
  const [initial] = useState(createCostume)
  const [recent, setRecent] = useState<string[]>([])
  const drawing = useDrawing(initial, () => {}, {
    onColorUsed: color =>
      setRecent(previous => [
        color,
        ...previous.filter(item => item !== color),
      ]),
  })
  return (
    <I18nProvider i18n={i18n}>
      <CostumeWorkspace
        drawing={drawing}
        recentColors={recent}
        active={active}
        disabled={false}
        onClear={drawing.clear}
      />
      <Text testID="state">
        {JSON.stringify({
          tool: drawing.tool,
          size: drawing.brushSize,
          color: drawing.color,
          painted: drawing.costume.pixels.filter(pixel => pixel !== TRANSPARENT)
            .length,
          palette: drawing.costume.palette,
        })}
      </Text>
    </I18nProvider>
  )
}
function state(screen: ReturnType<typeof render>) {
  return JSON.parse(screen.getByTestId('state').props.children) as {
    tool: string
    size: number
    color: string
    painted: number
    palette: string[]
  }
}
function draw(screen: ReturnType<typeof render>) {
  const canvas = screen.getByTestId('costumeDrawingSurface')
  fireEvent(canvas, 'responderGrant', {
    nativeEvent: {locationX: 100, locationY: 100},
  })
  fireEvent(canvas, 'responderMove', {
    nativeEvent: {locationX: 120, locationY: 100, touches: [{}]},
  })
  fireEvent(canvas, 'responderRelease', {
    nativeEvent: {locationX: 120, locationY: 100},
  })
}
function preset(screen: ReturnType<typeof render>, index: number) {
  fireEvent.press(screen.getByTestId('costumeColor'))
  fireEvent.press(screen.getByTestId('costumeColorTab-presets'))
  fireEvent.press(screen.getByTestId(`costumePresetColor-${index}`))
}

it('groups drawing tools at the top and other controls at the bottom, keeping popovers', () => {
  const screen = render(<Harness />)
  const tools = within(screen.getByTestId('costumeToolsBar'))
  const actions = within(screen.getByTestId('costumeActionsBar'))
  for (const tool of ['brush', 'eraser', 'fill', 'eyedropper', 'pan']) {
    expect(tools.getByTestId(`costumeTool-${tool}`)).toBeTruthy()
    expect(actions.queryByTestId(`costumeTool-${tool}`)).toBeNull()
  }
  for (const control of [
    'costumeBrushSize',
    'costumeColor',
    'costumeUndo',
    'costumeRedo',
    'costumeClear',
  ]) {
    expect(actions.getByTestId(control)).toBeTruthy()
    expect(tools.queryByTestId(control)).toBeNull()
  }
  expect(screen.queryByTestId('costumeToolbar')).toBeNull()
  expect(screen.queryByTestId('costumeZoom')).toBeNull()
  expect(screen.queryByTestId('costumeTool-line')).toBeNull()
  expect(screen.queryByTestId('costumeFit')).toBeNull()
  expect(screen.queryByTestId('costumeGrid')).toBeNull()
  expect(screen.queryByTestId('costumePresetColor-0')).toBeNull()
  fireEvent.press(screen.getByTestId('costumeBrushSize'))
  fireEvent.press(screen.getByTestId('costumeBrushSize-4'))
  expect(state(screen).size).toBe(4)
  expect(screen.queryByTestId('costumeBrushPopover')).toBeNull()
  draw(screen)
  expect(state(screen).painted).toBeGreaterThan(20)
  fireEvent.press(screen.getByTestId('costumeTool-eraser'))
  draw(screen)
  expect(state(screen).painted).toBe(0)
  fireEvent.press(screen.getByTestId('costumeTool-fill'))
  draw(screen)
  expect(state(screen).painted).toBe(4096)
  fireEvent.press(screen.getByTestId('costumeUndo'))
  expect(state(screen).painted).toBe(0)
  fireEvent.press(screen.getByTestId('costumeRedo'))
  expect(state(screen).painted).toBe(4096)
  fireEvent.press(screen.getByTestId('costumeClear'))
  expect(state(screen).painted).toBe(0)
})

it('closes options and disables gesture capture when the editor loses focus', () => {
  const screen = render(<Harness />)
  fireEvent.press(screen.getByTestId('costumeColor'))
  expect(screen.getByTestId('costumeColorPopover')).toBeTruthy()
  screen.rerender(<Harness active={false} />)
  expect(screen.queryByTestId('costumeColorPopover')).toBeNull()
  const props = screen.getByTestId('costumeDrawingSurface').props as {
    onStartShouldSetResponder: () => boolean
  }
  expect(props.onStartShouldSetResponder()).toBe(false)
})

it('offers presets, custom HSV/hex, and genuinely used recent colors in three tabs', () => {
  const screen = render(<Harness />)
  fireEvent.press(screen.getByTestId('costumeColor'))
  expect(screen.queryByTestId('costumeHexColor')).toBeNull()
  fireEvent.press(screen.getByTestId('costumeColorTab-recent'))
  expect(screen.getByText('Paint a color to add it here.')).toBeTruthy()
  fireEvent.press(screen.getByTestId('costumeColorTab-custom'))
  fireEvent.changeText(screen.getByTestId('costumeHexColor'), '#123ABC')
  expect(state(screen).color).toBe('#123ABC')
  expect(state(screen).palette).not.toContain('#123ABC')
  fireEvent.press(screen.getByTestId('costumeColorPickerClose'))
  draw(screen)
  expect(state(screen).palette).toContain('#123ABC')
  expect(state(screen).palette[0]).toBe('#17121F')
  fireEvent.press(screen.getByTestId('costumeColor'))
  fireEvent.press(screen.getByTestId('costumeColorTab-recent'))
  expect(
    screen.getByTestId('costumeRecentColor-0').props.accessibilityLabel,
  ).toContain('#123ABC')
})

it('supports custom color drags with web-style scroll refs and restores scrolling after release or cancellation', () => {
  const screen = render(<Harness />)
  preset(screen, 4)
  fireEvent.press(screen.getByTestId('costumeColor'))
  fireEvent.press(screen.getByTestId('costumeColorTab-custom'))
  const surfaces = screen.getAllByTestId('costumeDrawingSurface')
  const hue = surfaces[2]
  const sv = surfaces[1]
  const size = (hue.props.style as {width: number}).width
  const scrollingEnabled = () =>
    screen.getByTestId('costumeColorScroll').props.scrollEnabled
  expect(scrollingEnabled()).toBe(true)
  fireEvent(hue, 'responderGrant', {
    nativeEvent: {locationX: size / 2, locationY: 12},
  })
  expect(scrollingEnabled()).toBe(false)
  fireEvent(hue, 'responderRelease', {
    nativeEvent: {locationX: size / 2, locationY: 12},
  })
  expect(scrollingEnabled()).toBe(true)
  fireEvent(sv, 'responderGrant', {
    nativeEvent: {locationX: size / 2, locationY: size / 2},
  })
  expect(scrollingEnabled()).toBe(false)
  fireEvent(sv, 'responderRelease', {
    nativeEvent: {locationX: size / 2, locationY: size / 2},
  })
  expect(scrollingEnabled()).toBe(true)
  expect(state(screen).color).toBe('#408080')
  fireEvent(sv, 'responderGrant', {nativeEvent: {locationX: 0, locationY: 0}})
  expect(scrollingEnabled()).toBe(false)
  fireEvent(sv, 'responderTerminate')
  expect(scrollingEnabled()).toBe(true)
  fireEvent(sv, 'responderGrant', {nativeEvent: {locationX: 0, locationY: 0}})
  fireEvent.press(screen.getByTestId('costumeColorTab-presets'))
  expect(scrollingEnabled()).toBe(true)
  expect(screen.queryByTestId('costumeColorPicker')).toBeNull()
})

it('dismisses options without painting and samples a painted color without adding undo history', () => {
  const screen = render(<Harness />)
  preset(screen, 4)
  draw(screen)
  const painted = state(screen).painted
  preset(screen, 1)
  fireEvent.press(screen.getByTestId('costumeColor'))
  fireEvent.press(screen.getByTestId('costumePopoverBackdrop'))
  expect(state(screen).painted).toBe(painted)
  fireEvent.press(screen.getByTestId('costumeTool-eyedropper'))
  draw(screen)
  expect(state(screen).color).toBe('#ED445E')
  expect(state(screen).painted).toBe(painted)
  expect(state(screen).tool).toBe('brush')
  fireEvent.press(screen.getByTestId('costumeUndo'))
  expect(state(screen).painted).toBe(0)
})
