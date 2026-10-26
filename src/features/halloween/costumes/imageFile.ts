import * as FileSystem from 'expo-file-system/legacy'
import {toBase64} from '@atproto/lex'
import {nanoid} from 'nanoid/non-secure'

/** Retain until the collection prompt closes or the composer takes ownership. */
export async function createCostumeImageFile(bytes: Uint8Array) {
  const uri = `${FileSystem.cacheDirectory}costume-${nanoid()}.png`
  await FileSystem.writeAsStringAsync(uri, toBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  })
  return {
    uri,
    dispose: () => {
      void FileSystem.deleteAsync(uri, {idempotent: true})
    },
  }
}
