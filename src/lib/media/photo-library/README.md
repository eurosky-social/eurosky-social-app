# Saving photos without reading the library

Use `requestPhotoSavePermission()` before a user-initiated native save, then
`savePhotoToLibrary(localUri, albumName?)`. These helpers accept both bare local
paths (ViewShot) and `file://` URIs (camera/downloads).

- **Android 11 / API 30 and newer:** the current Expo Media Library `Asset` and
  `Album` APIs insert app-owned media via scoped MediaStore. No library permission
  is queried or requested. A named album is created from the new file paths,
  without looking up or migrating existing albums. Repeated saves use the same
  folder. A failed named-album save is not retried as a second insertion, since
  the first insertion may already have succeeded.
- **Android 10 / API 29 and older:** Expo still uses its legacy filesystem writer.
  Request only `WRITE_EXTERNAL_STORAGE`, and use the legacy `saveToLibraryAsync`
  writer without reading the asset back. These devices save to the default
  gallery location rather than managing the Mu album. The media-library config
  plugin retains `requestLegacyExternalStorage` for Android 10 compatibility.
- **iOS:** retain the legacy add-only permission and `saveToLibraryAsync` behavior.
  Do not replace this with `createAssetAsync`, which reads the saved asset back
  and can require more than add-only permission.

Selection is separate from saving. Android uploads use `expo-image-picker` with
`legacy: false`; the system photo picker (or document-picker fallback) grants
access to selected files only. The permission hooks skip both initial permission
queries and requests on Android. iOS and web retain their existing selection
behavior.

`app.config.js` blocks `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`,
`READ_MEDIA_VISUAL_USER_SELECTED`, `READ_EXTERNAL_STORAGE`, and
`ACCESS_MEDIA_LOCATION`, including declarations contributed by dependencies.
After a native rebuild, verify the merged APK/AAB manifest, not just the Expo
config. This cannot be fixed by an OTA update or a Play Console form alone.

## Device checks before public rollout

- Select one/multiple photos, a GIF, and a video in the composer.
- Cancel the picker and reopen it; check selection limits and mixed-media errors.
- Select/crop an avatar and banner, including the onboarding avatar.
- Take a camera photo. A declined/failed gallery save must not prevent attaching
  the camera capture to the post.
- Save a post image twice; verify the Mu album on API 30+.
- Save an invite QR card and both starter-pack share images.
- Repeat with photo/video library permission ungranted, and after upgrading a
  previously installed version that requested broad permissions.
- On API 29 or older, verify legacy write permission approval and denial.

Unit tests cover picker options, skipped Android permission queries/requests,
API-level save paths, denied legacy writes, URI normalization, iOS add-only
behavior, and camera cancellation/save failures. Real-device checks are still
needed; mocked native APIs do not prove MediaStore behavior on every Android
version/vendor.
