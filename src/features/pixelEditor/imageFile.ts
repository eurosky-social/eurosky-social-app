import * as FileSystem from 'expo-file-system/legacy'
import {toBase64} from '@atproto/lex'
import {nanoid} from 'nanoid/non-secure'

/** The caller owns the temporary PNG and must dispose it after use. */
export async function createDrawingImageFile(bytes: Uint8Array) {
  const uri = `${FileSystem.cacheDirectory}drawing-${nanoid()}.png`
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
