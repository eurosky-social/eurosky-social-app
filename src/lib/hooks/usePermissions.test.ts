import * as MediaLibrary from 'expo-media-library/legacy'
import {renderHook} from '@testing-library/react-native'

import {Alert} from '#/view/com/util/Alert'
import * as env from '#/env'
import {
  usePhotoLibraryPermission,
  useVideoLibraryPermission,
} from './usePermissions'

jest.mock('#/env', () => ({
  __esModule: true,
  IS_ANDROID: true,
  IS_WEB: false,
}))
jest.mock('#/view/com/util/Alert', () => ({Alert: {alert: jest.fn()}}))
jest.mock('expo-media-library/legacy', () => {
  const requestPermissionsAsync = jest.fn()
  return {
    requestPermissionsAsync,
    usePermissions: jest.fn(() => [
      {granted: false, canAskAgain: false, status: 'denied'},
      requestPermissionsAsync,
    ]),
  }
})

beforeEach(() => {
  jest.clearAllMocks()
})

afterEach(() => {
  jest.restoreAllMocks()
})

it('allows Android photo and video selection even when library access is denied', async () => {
  const {result} = renderHook(() => ({
    ...usePhotoLibraryPermission(),
    ...useVideoLibraryPermission(),
  }))

  expect(await result.current.requestPhotoAccessIfNeeded()).toBe(true)
  expect(await result.current.requestVideoAccessIfNeeded()).toBe(true)
  expect(MediaLibrary.usePermissions).toHaveBeenCalledWith({
    granularPermissions: ['photo'],
    get: false,
  })
  expect(MediaLibrary.usePermissions).toHaveBeenCalledWith({
    granularPermissions: ['video'],
    get: false,
  })
  expect(MediaLibrary.requestPermissionsAsync).not.toHaveBeenCalled()
  expect(Alert.alert).not.toHaveBeenCalled()
})

it('preserves iOS permission gating', async () => {
  jest.replaceProperty(env, 'IS_ANDROID', false)
  const {result} = renderHook(() => usePhotoLibraryPermission())

  expect(await result.current.requestPhotoAccessIfNeeded()).toBe(false)
  expect(MediaLibrary.usePermissions).toHaveBeenCalledWith({
    granularPermissions: ['photo'],
    get: true,
  })
  expect(Alert.alert).toHaveBeenCalled()
})
