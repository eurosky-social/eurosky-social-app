import {launchImageLibraryAsync} from 'expo-image-picker'

import * as env from '#/env'
import {openPicker, openUnifiedPicker} from './picker.shared'

jest.mock('#/env', () => ({
  __esModule: true,
  IS_ANDROID: true,
  IS_IOS: false,
}))
jest.mock('#/components/Toast', () => ({show: jest.fn()}))
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(() =>
    Promise.resolve({canceled: true, assets: null}),
  ),
  UIImagePickerPreferredAssetRepresentationMode: {Automatic: 'automatic'},
  VideoExportPreset: {Passthrough: 0},
}))

beforeEach(() => {
  jest.clearAllMocks()
})

afterEach(() => {
  jest.restoreAllMocks()
})

it('uses the Android system picker even if a caller supplies legacy options', async () => {
  expect(await openPicker({legacy: true})).toEqual([])
  expect(launchImageLibraryAsync).toHaveBeenCalledWith(
    expect.objectContaining({legacy: false, mediaTypes: ['images']}),
  )
})

it.each([1, 4, 16])(
  'limits Android selection to %s remaining items',
  async count => {
    const result = await openUnifiedPicker({selectionCountRemaining: count})
    expect(result.canceled).toBe(true)
    expect(launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        legacy: false,
        mediaTypes: ['images', 'videos'],
        selectionLimit: count,
        allowsMultipleSelection: true,
        base64: false,
      }),
    )
  },
)

it('does not turn zero remaining images into an unlimited Android picker', async () => {
  await openUnifiedPicker({selectionCountRemaining: 0})
  expect(launchImageLibraryAsync).toHaveBeenCalledWith(
    expect.objectContaining({selectionLimit: 1}),
  )
})

it('preserves iOS picker options', async () => {
  jest.replaceProperty(env, 'IS_ANDROID', false)
  jest.replaceProperty(env, 'IS_IOS', true)
  await openUnifiedPicker({selectionCountRemaining: 4})
  expect(launchImageLibraryAsync).toHaveBeenCalledWith(
    expect.objectContaining({legacy: true, selectionLimit: 4}),
  )
})

it('preserves web picker options', async () => {
  jest.replaceProperty(env, 'IS_ANDROID', false)
  await openUnifiedPicker({selectionCountRemaining: 4})
  expect(launchImageLibraryAsync).toHaveBeenCalledWith(
    expect.objectContaining({legacy: true, selectionLimit: undefined}),
  )
})
