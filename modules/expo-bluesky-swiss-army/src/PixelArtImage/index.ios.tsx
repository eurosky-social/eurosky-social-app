import {Image, type StyleProp, type ViewStyle} from 'react-native'
import {type ImageProps} from 'expo-image'
import {requireNativeViewManager} from 'expo-modules-core'

const NativeView: React.ComponentType<{
  uri: string
  style?: StyleProp<ViewStyle>
  accessibilityIgnoresInvertColors?: boolean
}> = requireNativeViewManager('ExpoBlueskyPixelArtImage')

/** Bundled sprite sheets rendered without iOS image interpolation. */
export function PixelArtImage({
  source,
  style,
  accessibilityIgnoresInvertColors,
}: Pick<ImageProps, 'style' | 'accessibilityIgnoresInvertColors'> & {
  source: Parameters<typeof Image.resolveAssetSource>[0]
  contentFit?: 'fill'
}) {
  const asset = Image.resolveAssetSource(source)
  return (
    <NativeView
      uri={asset?.uri ?? ''}
      style={style}
      accessibilityIgnoresInvertColors={accessibilityIgnoresInvertColors}
    />
  )
}
