import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {ListSparkle_Stroke2_Corner0_Rounded as FeedsIcon} from '#/components/icons/ListSparkle'
import {PlusSmall_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {Text} from '#/components/Typography'
import {type ArticleSize} from './curation'

/**
 * A spot with no story in it, in the editor of a section that does not fill
 * itself: the faint shape of a story, with what can go there over it. With a
 * fine pointer the actions show on hover or focus; touch and native screens
 * keep them visible.
 */
export function EmptySlot({
  position,
  size,
  card = false,
  postsOnly = false,
  disabled,
  onAddStory,
  onAddFeeds,
}: {
  /** Its place in the section, from 0. */
  position: number
  size: ArticleSize
  /** A carousel card: narrow, the picture above. */
  card?: boolean
  /** For a carousel, which holds posts only. */
  postsOnly?: boolean
  disabled: boolean
  /** Opens the picker of existing posts, feeds and starter packs for this spot. */
  onAddStory: () => void
  /** Puts a featured-feeds card here. */
  onAddFeeds?: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const aspectRatio = card
    ? 16 / 10
    : size === 'big'
      ? 16 / 9
      : size === 'medium'
        ? 3 / 2
        : 16 / 10
  const spot = position + 1
  const action = [t.atoms.bg, a.border, t.atoms.border_contrast_low]
  return (
    <View
      testID="frontpageEmptySlot"
      style={[
        a.relative,
        a.gap_md,
        a.p_md,
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_medium,
        {borderStyle: 'dashed'},
      ]}>
      <View
        style={[a.w_full, a.rounded_sm, t.atoms.bg_contrast_25, {aspectRatio}]}
      />
      <View style={[a.gap_xs]}>
        <View
          style={[
            a.rounded_xs,
            t.atoms.bg_contrast_50,
            {height: 14, width: '70%'},
          ]}
        />
        <View
          style={[
            a.rounded_xs,
            t.atoms.bg_contrast_25,
            {height: 10, width: '45%'},
          ]}
        />
      </View>
      <Text style={[a.text_xs, a.font_semi_bold, t.atoms.text_contrast_medium]}>
        <Trans>Spot {spot} – empty</Trans>
      </Text>
      <View
        testID="frontpageEmptySlotActions"
        pointerEvents="box-none"
        style={[
          a.absolute,
          a.inset_0,
          a.align_center,
          a.justify_center,
          a.gap_sm,
          a.p_md,
        ]}>
        <Button
          testID="fillEmptySlotWithStory"
          label={
            postsOnly
              ? l`Add a post to spot ${spot}`
              : l`Add a post, feed or starter pack to spot ${spot}`
          }
          size="small"
          color="secondary"
          disabled={disabled}
          style={action}
          onPress={onAddStory}>
          <ButtonIcon icon={PlusIcon} />
          <ButtonText>
            {postsOnly ? <Trans>Add a post</Trans> : <Trans>Add a story</Trans>}
          </ButtonText>
        </Button>
        {!postsOnly && onAddFeeds && (
          <Button
            testID="fillEmptySlotWithFeeds"
            label={l`Feature several feeds in spot ${spot}`}
            size="small"
            color="secondary"
            disabled={disabled}
            style={action}
            onPress={onAddFeeds}>
            <ButtonIcon icon={FeedsIcon} />
            <ButtonText>
              <Trans>Feature feeds</Trans>
            </ButtonText>
          </Button>
        )}
      </View>
    </View>
  )
}
