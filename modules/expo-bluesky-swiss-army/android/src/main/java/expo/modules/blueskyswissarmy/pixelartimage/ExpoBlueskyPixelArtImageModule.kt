package expo.modules.blueskyswissarmy.pixelartimage

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoBlueskyPixelArtImageModule : Module() {
  override fun definition() =
    ModuleDefinition {
      Name("ExpoBlueskyPixelArtImage")

      View(PixelArtImageView::class) {
        Prop("uri") { view: PixelArtImageView, uri: String? ->
          view.setSource(uri)
        }

        // Accepted for parity with the iOS view; Android handles inverted
        // colors at the window level.
        Prop("accessibilityIgnoresInvertColors") { _: PixelArtImageView, _: Boolean ->
        }
      }
    }
}
