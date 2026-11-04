/** The caller owns the object URL and must dispose it after use. */
export function createDrawingImageFile(bytes: Uint8Array) {
  const uri = URL.createObjectURL(
    new Blob([Uint8Array.from(bytes)], {type: 'image/png'}),
  )
  return Promise.resolve({uri, dispose: () => URL.revokeObjectURL(uri)})
}
