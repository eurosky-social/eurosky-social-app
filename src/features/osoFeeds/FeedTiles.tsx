import {Pressable, View} from 'react-native'
import {Image} from 'expo-image'

import {atoms as a, useTheme, web} from '#/alf'
import {CheckThick_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {Hashtag_Stroke2_Corner0_Rounded as HashtagIcon} from '#/components/icons/Hashtag'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {OSO_COLORS} from '#/features/osoLanding/theme'

/** Feeds sit four to a row. */
const COLUMNS = 4
const GAP = 12
const BADGE = 26

export type OsoFeedTileAction = 'add' | 'added' | 'remove'

/**
 * A row-wrapping grid of feed tiles, four to a row.
 */
export function OsoFeedTileGrid({children}: {children: React.ReactNode}) {
  return (
    <View
      style={[a.flex_row, a.flex_wrap, a.px_lg, {marginHorizontal: -GAP / 2}]}>
      {children}
    </View>
  )
}

/**
 * One feed as a tile: its avatar as a square picture with the name under it,
 * opening the feed when pressed. `action` adds a round button in the top
 * right corner: a plus to add the feed, a tick once added, a minus to remove.
 */
export function OsoFeedTile({
  name,
  avatar,
  href,
  action,
  onAction,
  actionLabel,
}: {
  name: string
  avatar?: string
  href: string
  action?: OsoFeedTileAction
  onAction?: () => void
  actionLabel?: string
}) {
  const t = useTheme()

  return (
    <View
      style={[
        {width: `${100 / COLUMNS}%`, padding: GAP / 2},
        a.align_center,
        a.gap_xs,
      ]}>
      <View style={[a.w_full, a.relative]}>
        <Link to={href} label={name} style={[a.w_full, a.rounded_md]}>
          {avatar ? (
            <Image
              accessibilityIgnoresInvertColors
              source={{uri: avatar}}
              contentFit="cover"
              style={[
                a.w_full,
                a.rounded_md,
                t.atoms.bg_contrast_25,
                {aspectRatio: 1},
              ]}
            />
          ) : (
            <View
              style={[
                a.w_full,
                a.rounded_md,
                a.align_center,
                a.justify_center,
                {aspectRatio: 1, backgroundColor: OSO_COLORS.navy},
              ]}>
              <HashtagIcon size="xl" fill={OSO_COLORS.white} />
            </View>
          )}
        </Link>
        {action && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel ?? name}
            accessibilityHint=""
            disabled={action === 'added'}
            onPress={onAction}
            style={[
              a.absolute,
              a.rounded_full,
              a.align_center,
              a.justify_center,
              {
                top: -BADGE / 3,
                right: -BADGE / 3,
                width: BADGE,
                height: BADGE,
                borderWidth: 2,
                borderColor: t.atoms.bg.backgroundColor,
                backgroundColor:
                  action === 'remove'
                    ? OSO_COLORS.red
                    : action === 'added'
                      ? OSO_COLORS.green
                      : OSO_COLORS.navy,
              },
              web({cursor: action === 'added' ? 'default' : 'pointer'}),
            ]}>
            {action === 'add' ? (
              <PlusIcon size="xs" fill={OSO_COLORS.white} />
            ) : action === 'added' ? (
              <CheckIcon size="xs" fill={OSO_COLORS.navy} />
            ) : (
              // A minus: there is no minus icon in the set.
              <View
                style={{
                  width: 10,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: OSO_COLORS.white,
                }}
              />
            )}
          </Pressable>
        )}
      </View>
      <Text
        emoji
        numberOfLines={2}
        style={[a.text_xs, a.font_semi_bold, a.text_center, a.leading_snug]}>
        {name}
      </Text>
    </View>
  )
}
