package expo.modules.blueskyswissarmy.pixelartimage

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.net.Uri
import expo.modules.interfaces.imageloader.ImageLoaderInterface
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

/**
 * Draws a sprite sheet with nearest-neighbour sampling, including when an
 * ancestor view scales it. expo-image (the previous Android renderer) samples
 * bilinearly, so at fractional scales/densities the row above the clipped
 * frame bleeds into it and shows up as a stray pixel line above the sprite.
 */
class PixelArtImageView(
  context: Context,
  appContext: AppContext,
) : ExpoView(context, appContext) {
  private var source: String? = null
  private var bitmap: Bitmap? = null
  private var loadId = 0

  // Nearest-neighbour sampling; the hardware renderer honours this under
  // ancestor transforms as well, so scaled ancestors stay crisp.
  private val paint = Paint().apply {
    isFilterBitmap = false
    isAntiAlias = false
    isDither = false
  }
  private val dstRect = RectF()

  init {
    // ViewGroup defaults to WILL_NOT_DRAW, which would skip onDraw entirely.
    setWillNotDraw(false)
  }

  fun setSource(uri: String?) {
    if (uri == source) return
    source = uri
    val id = ++loadId
    bitmap?.recycle()
    bitmap = null
    invalidate()
    if (uri.isNullOrEmpty()) return

    val parsed = runCatching { Uri.parse(uri) }.getOrNull()
    if (parsed?.scheme == null) {
      // Release build: resolveAssetSource returns the bare drawable/raw
      // resource name of the bundled sheet. Decode it at full size.
      val decoded = decodeLocalResource(uri)
      if (id == loadId) {
        bitmap = decoded
        invalidate()
      } else {
        decoded?.recycle()
      }
    } else {
      // Dev-server/file/data URIs go through expo's shared image loader. The
      // "manipulation" variant never downsamples, keeping sheet pixels intact.
      appContext.service<ImageLoaderInterface>()?.loadImageForManipulationFromURL(
        uri,
        object : ImageLoaderInterface.ResultListener {
          override fun onSuccess(loaded: Bitmap) {
            if (id == loadId) {
              bitmap?.recycle()
              bitmap = loaded
              invalidate()
            } else {
              loaded.recycle()
            }
          }

          override fun onFailure(cause: Throwable?) {
            if (id == loadId) {
              bitmap = null
              invalidate()
            }
          }
        },
      )
    }
  }

  private fun decodeLocalResource(name: String): Bitmap? {
    val res = context.resources
    val pkg = context.packageName
    // Images bundle into drawable, other assets into raw.
    val id = res.getIdentifier(name, "drawable", pkg).takeIf { it != 0 }
      ?: res.getIdentifier(name, "raw", pkg)
    if (id == 0) return null
    val options = BitmapFactory.Options().apply {
      inPreferredConfig = Bitmap.Config.ARGB_8888
    }
    return BitmapFactory.decodeResource(res, id, options)
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val bmp = bitmap ?: return
    if (width == 0 || height == 0) return
    // Stretch to the view bounds (contentFit "fill").
    dstRect.set(0f, 0f, width.toFloat(), height.toFloat())
    canvas.drawBitmap(bmp, null, dstRect, paint)
  }

  override fun onDetachedFromWindow() {
    bitmap?.recycle()
    bitmap = null
    super.onDetachedFromWindow()
  }
}
