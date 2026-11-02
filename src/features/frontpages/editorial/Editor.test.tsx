import {fireEvent, render, screen} from '@testing-library/react-native'

import {EditorToolbar} from './Editor'

jest.mock('@lingui/react', () => ({
  useLingui: () => ({_: ({message}: {message: string}) => message}),
  Trans: ({message}: {message: string}) => message,
}))
jest.mock('#/alf', () => ({
  atoms: new Proxy({}, {get: () => ({})}),
  useTheme: () => ({atoms: {}, palette: {negative_500: '#f00'}}),
}))
jest.mock('#/state/preferences/moderation-opts', () => ({
  useModerationOpts: () => undefined,
}))
jest.mock('#/components/Button', () => {
  const {Pressable, Text} =
    require('react-native') as typeof import('react-native')
  return {Button: Pressable, ButtonText: Text, ButtonIcon: () => null}
})
jest.mock('#/components/Typography', () => ({
  Text: (require('react-native') as typeof import('react-native')).Text,
}))
jest.mock('#/components/forms/Toggle', () => {
  const {View, Text} = require('react-native') as typeof import('react-native')
  return {Item: View, Checkbox: () => null, LabelText: Text}
})
jest.mock('#/components/Menu', () => ({}))
jest.mock('#/components/moderation/ContentHider', () => ({}))
jest.mock('./moderation', () => ({}))

const onSave = jest.fn()
const onCancel = jest.fn()
const onPreview = jest.fn()

function renderToolbar(
  overrides: Partial<React.ComponentProps<typeof EditorToolbar>> = {},
) {
  return render(
    <EditorToolbar
      canPublish
      onPreview={onPreview}
      cover={false}
      hasBanner
      onCover={jest.fn()}
      onSave={onSave}
      onCancel={onCancel}
      onReload={jest.fn()}
      saving={false}
      dirty
      conflict={false}
      {...overrides}
    />,
  )
}

beforeEach(() => jest.clearAllMocks())

it('lets the publication owner publish or cancel', () => {
  renderToolbar()
  expect(screen.getByText('Cancel')).toBeTruthy()
  fireEvent.press(screen.getByTestId('publishFrontpage'))
  expect(onSave).toHaveBeenCalledTimes(1)
})

it('offers only discard for a local preview, even after changes', () => {
  renderToolbar({canPublish: false})
  expect(screen.queryByTestId('publishFrontpage')).toBeNull()
  expect(screen.queryByText('Cancel')).toBeNull()
  expect(screen.getByText('Discard')).toBeTruthy()
  fireEvent.press(screen.getByTestId('discardFrontpage'))
  expect(onCancel).toHaveBeenCalledTimes(1)
  expect(onSave).not.toHaveBeenCalled()
})

it.each([{dirty: false}, {saving: true}, {conflict: true}])(
  'does not publish when the owner cannot save: %j',
  overrides => {
    renderToolbar(overrides)
    fireEvent.press(screen.getByTestId('publishFrontpage'))
    expect(onSave).not.toHaveBeenCalled()
  },
)

it('switches to a preview and back, still offering to publish', () => {
  renderToolbar()
  fireEvent.press(screen.getByTestId('previewFrontpage'))
  expect(onPreview).toHaveBeenCalledWith(true)
  renderToolbar({previewing: true})
  expect(screen.getAllByTestId('publishFrontpage').length).toBeGreaterThan(0)
  fireEvent.press(screen.getByTestId('exitFrontpagePreview'))
  expect(onPreview).toHaveBeenCalledWith(false)
})
