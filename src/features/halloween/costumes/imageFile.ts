import {File, Paths} from 'expo-file-system'
import {nanoid} from 'nanoid/non-secure'

/** Retain until the collection prompt closes or the composer takes ownership. */
export async function createCostumeImageFile(bytes: Uint8Array) {
  /* Use the current scoped filesystem API, not legacy iOS path permissions. */
  const file = new File(Paths.cache, `costume-${nanoid()}.png`)
  const dispose = () => {
    if (file.exists) file.delete()
  }
  file.create({intermediates: true})
  try {
    await file.write(bytes)
  } catch (error) {
    dispose()
    throw error
  }
  return {uri: file.uri, dispose}
}
