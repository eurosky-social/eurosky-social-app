import * as MediaLibrary from 'expo-media-library/legacy'

import {photoFileUri} from './uri'

/** Preserve iOS add-only authorization for explicitly saving generated images. */
export async function requestPhotoSavePermission(): Promise<boolean> {
  return (await MediaLibrary.requestPermissionsAsync(true)).granted
}

/** Save without reading the created asset back (important for iOS add-only access). */
export async function savePhotoToLibrary(uri: string, _albumName?: string) {
  await MediaLibrary.saveToLibraryAsync(photoFileUri(uri))
}
