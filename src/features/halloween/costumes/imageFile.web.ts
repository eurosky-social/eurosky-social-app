/** Object URLs stay alive while the prompt or composer needs the image. */
export function createCostumeImageFile(bytes: Uint8Array) {
  const uri = URL.createObjectURL(
    new Blob([Uint8Array.from(bytes)], {type: 'image/png'}),
  )
  return Promise.resolve({uri, dispose: () => URL.revokeObjectURL(uri)})
}
