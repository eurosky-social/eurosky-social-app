/** ViewShot may return a bare path, while the camera already returns a URI. */
export function photoFileUri(uri: string): string {
  return uri.startsWith('/') ? `file://${uri}` : uri
}
