import * as MediaLibrary from 'expo-media-library/legacy'

import {requestPhotoSavePermission, savePhotoToLibrary} from './index'
import {photoFileUri} from './uri'

beforeEach(() => {
  jest.clearAllMocks()
})

it('preserves add-only permission requests on iOS', async () => {
  expect(await requestPhotoSavePermission()).toBe(true)
  expect(MediaLibrary.requestPermissionsAsync).toHaveBeenCalledWith(true)
})

it.each(['/cache/image.png', 'file:///cache/image.png'])(
  'saves %s without reading the created asset back',
  async uri => {
    await savePhotoToLibrary(uri)
    expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledWith(
      'file:///cache/image.png',
    )
    expect(MediaLibrary.requestPermissionsAsync).not.toHaveBeenCalled()
  },
)

it('does not corrupt an existing content URI', () => {
  expect(photoFileUri('content://media/external/images/media/1')).toBe(
    'content://media/external/images/media/1',
  )
})
