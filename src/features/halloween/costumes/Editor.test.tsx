import {setupI18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {fireEvent, render} from '@testing-library/react-native'

import {CostumeButton} from './Editor'
import {type Costume, createCostume} from './model'

const mockNavigate = jest.fn()
let mockActive = true
let mockDid = 'did:plc:alice'
let mockCostumes: Record<string, Costume> = {}
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}))
jest.mock('#/features/halloween/context', () => ({
  useHalloween: () => ({isActive: mockActive}),
}))
jest.mock('#/features/halloween/costumes/state', () => ({
  useCostumes: () => ({costumes: mockCostumes}),
}))
jest.mock('#/state/session', () => ({
  useSession: () => ({currentAccount: {did: mockDid}}),
}))
jest.mock('#/components/Button', () => {
  const {Pressable, Text} = require('react-native')
  return {Button: Pressable, ButtonText: Text}
})
const i18n = setupI18n({locale: 'en', messages: {en: {}}})
const profile = {did: 'did:plc:alice'}
function renderEntry() {
  return render(
    <I18nProvider i18n={i18n}>
      <CostumeButton profile={profile} />
    </I18nProvider>,
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockActive = true
  mockDid = profile.did
  mockCostumes = {}
})

it('opens a dedicated drawing screen, not a popup', () => {
  const screen = renderEntry()
  fireEvent.press(screen.getByTestId('drawCostumeButton'))
  expect(mockNavigate).toHaveBeenCalledWith('CostumeEditor')
  expect(screen.queryByTestId('costumeEditorDialog')).toBeNull()
})

it('offers editing for a saved costume only on your own profile during Halloween', () => {
  mockCostumes = {[profile.did]: createCostume()}
  const screen = renderEntry()
  expect(screen.getByText('Edit costume')).toBeTruthy()
  mockActive = false
  screen.rerender(
    <I18nProvider i18n={i18n}>
      <CostumeButton profile={profile} />
    </I18nProvider>,
  )
  expect(screen.queryByTestId('drawCostumeButton')).toBeNull()
  mockActive = true
  mockDid = 'did:plc:bob'
  screen.rerender(
    <I18nProvider i18n={i18n}>
      <CostumeButton profile={profile} />
    </I18nProvider>,
  )
  expect(screen.queryByTestId('drawCostumeButton')).toBeNull()
})
