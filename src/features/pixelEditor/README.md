# Pixel editor

Reusable drawing tools extracted from the retired Halloween costume studio.
There is deliberately no production entry point: no route, app-root provider,
profile integration, repository writes, composer integration, or global storage
schema dependency.

## Pieces

- `model.ts`: versioned `Drawing` data, validation, palette management, brush
  stamps, flood fill, and SVG paths. `drawingSchema` accepts v1 32x32 art and
  upgrades it losslessly to the current v2 64x64 format.
- `useDrawing`: transient drawing state, tools, undo/redo, gesture transactions,
  dirty tracking, and optional photo sampling/color-history callbacks.
- `DrawingWorkspace`: tools, color/brush popovers, and an optional avatar-photo
  background. This UI still has a circular avatar preview; it is not yet a
  general-purpose image editor.
- `DrawingSurface`: native/web pointer, keyboard, pinch, zoom, and pan handling.
- `PixelLayer`: SVG rendering of a drawing.
- `photoPixels` / `usePhotoSampler`: original-photo loading and eyedropper support.
- `renderDrawing`: flatten art over an optional square photo into a 512x512 PNG.
  Without a photo, export uses a neutral background. A failed photo load rejects
  rather than silently dropping the background.
- `createDrawingImageFile`: a temporary native file or web object URL. The caller
  must call `dispose()` once finished with the returned URI.

## Reconnecting later

A host creates or validates the initial drawing, calls `useDrawing`, and passes
that controller to `DrawingWorkspace` as its `drawing` prop. The current data is
`editor.drawing`; call `editor.end()` before exporting to finish any active
stroke. The host owns navigation, discard/clear confirmation, storage, recent
colors, image lifecycle, and any upload/publication flow. Remount when changing
accounts or replacing the initial drawing.

Use `active={false}` when the host is unfocused to stop workspace gestures.
Recent colors are supplied through `recentColors`; collect committed colors via
`useDrawing`'s `onColorUsed` callback. No account or persistence provider is needed.
Photo URLs must permit pixel reads (CORS on web).

Existing public costume avatars, posts, and custom records are not changed by
removing the seasonal feature. Legacy local data is no longer consumed, but the
drawing schema remains compatible if a future host imports it explicitly.

```sh
pnpm test --runInBand src/features/pixelEditor
```
