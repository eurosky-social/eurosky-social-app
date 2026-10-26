import ExpoModulesCore

public class ExpoBlueskyPixelArtImageModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoBlueskyPixelArtImage")

    View(PixelArtImageView.self) {
      Prop("uri") { (view: PixelArtImageView, uri: URL?) in
        view.setSource(uri)
      }
    }
  }
}

/**
 * Keeps the original sheet pixels intact, including when an ancestor scales it.
 * expo-image uses trilinear filtering on iOS and has no nearest-neighbor prop.
 */
final class PixelArtImageView: ExpoView {
  private let imageLayer = CALayer()
  private var source: URL?
  private var loadID = UUID()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    imageLayer.magnificationFilter = .nearest
    imageLayer.minificationFilter = .nearest
    imageLayer.contentsGravity = .resize
    layer.addSublayer(imageLayer)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    imageLayer.frame = bounds
    CATransaction.commit()
  }

  func setSource(_ url: URL?) {
    guard url != source else { return }
    source = url
    let requestID = UUID()
    loadID = requestID
    imageLayer.contents = nil
    guard let url else { return }

    // Expo's loader handles both bundled file URLs and Metro's development URLs.
    appContext?.imageLoader?.loadImage(for: url) { [weak self] _, image in
      DispatchQueue.main.async { [weak self] in
        guard let self, self.loadID == requestID else { return }
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        self.imageLayer.contents = image?.cgImage
        CATransaction.commit()
      }
    }
  }
}
