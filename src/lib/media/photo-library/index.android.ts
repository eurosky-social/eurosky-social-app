import {PermissionsAndroid, Platform} from 'react-native'
import {Album, Asset} from 'expo-media-library'
import {saveToLibraryAsync} from 'expo-media-library/legacy'

import {photoFileUri} from './uri'

/**
 * Expo uses scoped MediaStore inserts on Android 11+, which need no library
 * permission. Its Android 10-and-older writer still needs legacy write access.
 */
export async function requestPhotoSavePermission(): Promise<boolean> {
  if (Number(Platform.Version) >= 30) return true

  return (
    (await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    )) === PermissionsAndroid.RESULTS.GRANTED
  )
}

/**
 * Only insert app-created files. Never enumerate, migrate, or read the user's
 * existing library. Album.create with file paths writes into the named folder
 * and resolves the album from the newly inserted, app-owned media.
 */
export async function savePhotoToLibrary(uri: string, albumName?: string) {
  const fileUri = photoFileUri(uri)
  if (Number(Platform.Version) < 30) {
    await saveToLibraryAsync(fileUri)
    return
  }

  if (albumName) {
    await Album.create(albumName, [fileUri])
  } else {
    await Asset.create(fileUri)
  }
}
