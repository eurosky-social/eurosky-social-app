import {type StyleProp, View, type ViewStyle} from 'react-native'
import {Image} from 'expo-image'

import {atoms as a, useTheme} from '#/alf'
import {Window_Stroke2_Corner2_Rounded as PlaceholderIcon} from '#/components/icons/Window'
import {tileIconUrl} from '../manifest'
import {type TileRecord} from '../resolve'

/**
 * A tile's icon, as an app icon: a rounded square, from the manifest's
 * `icons`. A tile that declares none, or whose record is not known yet, gets
 * a plain square with the generic tile mark on it.
 */
export function TileIcon({
  record,
  size = 64,
  style,
}: {
  /** The tile's record, once known. */
  record?: TileRecord
  size?: number
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const url = record
    ? tileIconUrl(record.manifest, record.pds, record.did)
    : undefined
  return (
    <View
      style={[
        a.align_center,
        a.justify_center,
        a.overflow_hidden,
        a.border,
        t.atoms.bg_contrast_25,
        t.atoms.border_contrast_low,
        {width: size, height: size, borderRadius: Math.round(size * 0.22)},
        style,
      ]}>
      {url ? (
        <Image
          source={{uri: url}}
          style={{width: size, height: size}}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <PlaceholderIcon
          width={Math.round(size * 0.5)}
          style={t.atoms.text_contrast_medium}
        />
      )}
    </View>
  )
}
