import {PermissionsAndroid, Platform} from 'react-native'
import {Album, Asset} from 'expo-media-library'
import * as LegacyMediaLibrary from 'expo-media-library/legacy'

import {requestPhotoSavePermission, savePhotoToLibrary} from './index.android'

jest.mock('expo-media-library', () => ({
  Album: {
    create: jest.fn(() => Promise.resolve({id: 'saved-album'})),
    get: jest.fn(),
    getAll: jest.fn(),
  },
  Asset: {create: jest.fn(() => Promise.resolve({id: 'saved-asset'}))},
}))

beforeEach(() => {
  jest.clearAllMocks()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('Android photo saving without broad library access', () => {
  it.each([30, 32, 33, 34, 36])('needs no permission on API %s', async api => {
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(api)
    const request = jest.spyOn(PermissionsAndroid, 'request')

    expect(await requestPhotoSavePermission()).toBe(true)
    await savePhotoToLibrary('/cache/qr.png')

    expect(request).not.toHaveBeenCalled()
    expect(Asset.create).toHaveBeenCalledWith('file:///cache/qr.png')
    expect(LegacyMediaLibrary.requestPermissionsAsync).not.toHaveBeenCalled()
    expect(LegacyMediaLibrary.saveToLibraryAsync).not.toHaveBeenCalled()
  })

  it('writes into the Mu album without finding or enumerating existing albums', async () => {
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(33)

    await savePhotoToLibrary('file:///cache/image.jpg', 'mu')

    expect(Album.create).toHaveBeenCalledWith('mu', ['file:///cache/image.jpg'])
    expect(Album.get).not.toHaveBeenCalled()
    expect(Album.getAll).not.toHaveBeenCalled()
    expect(Asset.create).not.toHaveBeenCalled()
  })

  it.each([24, 28, 29])(
    'only requests legacy write access on API %s',
    async api => {
      jest.spyOn(Platform, 'Version', 'get').mockReturnValue(api)
      const request = jest
        .spyOn(PermissionsAndroid, 'request')
        .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED)

      expect(await requestPhotoSavePermission()).toBe(true)
      await savePhotoToLibrary('/cache/image.jpg', 'mu')

      expect(request).toHaveBeenCalledWith(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      )
      expect(LegacyMediaLibrary.saveToLibraryAsync).toHaveBeenCalledWith(
        'file:///cache/image.jpg',
      )
      expect(LegacyMediaLibrary.requestPermissionsAsync).not.toHaveBeenCalled()
      expect(Album.create).not.toHaveBeenCalled()
      expect(Asset.create).not.toHaveBeenCalled()
    },
  )

  it.each(['denied', 'never_ask_again'] as const)(
    'reports legacy write permission %s without saving',
    async status => {
      jest.spyOn(Platform, 'Version', 'get').mockReturnValue(29)
      jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(status)

      expect(await requestPhotoSavePermission()).toBe(false)
      expect(LegacyMediaLibrary.saveToLibraryAsync).not.toHaveBeenCalled()
    },
  )

  it('propagates a write failure without retrying and creating duplicate media', async () => {
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(33)
    jest.mocked(Album.create).mockRejectedValueOnce(new Error('Disk full'))

    await expect(savePhotoToLibrary('/cache/image.jpg', 'mu')).rejects.toThrow(
      'Disk full',
    )
    expect(Asset.create).not.toHaveBeenCalled()
    expect(LegacyMediaLibrary.saveToLibraryAsync).not.toHaveBeenCalled()
  })
})
