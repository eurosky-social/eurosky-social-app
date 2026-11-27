import {type StyleProp, View, type ViewStyle} from 'react-native'
import {Image} from 'expo-image'
import {moderateProfile} from '@bsky/sdk/moderation'

import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Window_Stroke2_Corner2_Rounded as PlaceholderIcon} from '#/components/icons/Window'
import {type TileAuthor} from '../author'
import {tileIconUrl} from '../manifest'
import {type TileRecord} from '../resolve'

/**
 * A tile's icon, as an app icon: a rounded square, from the manifest's
 * `icons`. A tile that declares none goes by its author's avatar, cut to the
 * same shape (and blurred or left out as moderation says, like any avatar);
 * with no avatar either, a plain square with the generic tile mark on it.
 */
export function TileIcon({
  record,
  author,
  loading = false,
  size = 64,
  style,
}: {
  /** The tile's record, once known. */
  record?: TileRecord
  /** The tile's author, once known: their avatar stands in for a missing icon. */
  author?: TileAuthor
  /**
   * The record is still on its way: the square stays empty, so that an
   * avatar does not flash where the tile's own icon is about to be.
   */
  loading?: boolean
  size?: number
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const moderationOpts = useModerationOpts()
  const url = record
    ? tileIconUrl(record.manifest, record.pds, record.did)
    : undefined
  const avatar = author?.profile.avatar
  const moderation =
    author && moderationOpts
      ? moderateProfile(author.profile, moderationOpts)
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
      ) : loading ? null : avatar ? (
        <UserAvatar
          type="user"
          shape="square"
          size={size}
          avatar={avatar}
          moderation={moderation?.ui('avatar')}
          noBorder
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
