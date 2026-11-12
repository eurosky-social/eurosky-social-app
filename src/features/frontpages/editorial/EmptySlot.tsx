import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Hashtag_Stroke2_Corner0_Rounded as FeedIcon} from '#/components/icons/Hashtag'
import {ListSparkle_Stroke2_Corner0_Rounded as FeedsIcon} from '#/components/icons/ListSparkle'
import {Newspaper_Stroke2_Corner2_Rounded as PostIcon} from '#/components/icons/Newspaper'
import {StarterPack_Stroke2_Corner0_Rounded as StarterPackIcon} from '#/components/icons/StarterPack'
import {Text} from '#/components/Typography'
import {type ArticleSize} from './curation'
import {type SlotStep} from './SlotPicker'

/**
 * A spot with no story in it, in the editor of a section that does not fill
 * itself: the faint shape of a story, with the components that can go there
 * over it, each opening the add dialog at its own step. With a fine pointer
 * the buttons show on hover or focus; touch and native screens keep them
 * visible.
 */
export function EmptySlot({
  position,
  size,
  card = false,
  postsOnly = false,
  disabled,
  onAdd,
}: {
  /** Its place in the section, from 0. */
  position: number
  size: ArticleSize
  /** A carousel card: narrow, the picture above. */
  card?: boolean
  /** For a carousel, which holds posts only. */
  postsOnly?: boolean
  disabled: boolean
  /** Opens the add dialog for this spot at a component's step. */
  onAdd: (step: Exclude<SlotStep, 'choose'>) => void
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
  const options: {
    step: Exclude<SlotStep, 'choose'>
    testID: string
    icon: typeof PostIcon
    title: string
  }[] = postsOnly
    ? [
        {
          step: 'posts',
          testID: 'fillEmptySlotWithPost',
          icon: PostIcon,
          title: l`Post`,
        },
      ]
    : [
        {
          step: 'posts',
          testID: 'fillEmptySlotWithPost',
          icon: PostIcon,
          title: l`Post`,
        },
        {
          step: 'feeds',
          testID: 'fillEmptySlotWithFeed',
          icon: FeedIcon,
          title: l`Feed`,
        },
        {
          step: 'starterPacks',
          testID: 'fillEmptySlotWithStarterPack',
          icon: StarterPackIcon,
          title: l`Starter pack`,
        },
        {
          step: 'featured',
          testID: 'fillEmptySlotWithFeaturedFeeds',
          icon: FeedsIcon,
          title: l`Featured feeds`,
        },
      ]
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
          a.flex_row,
          a.flex_wrap,
          a.align_center,
          a.justify_center,
          a.gap_sm,
          a.p_md,
          {alignContent: 'center'},
        ]}>
        {options.map(option => (
          <Button
            key={option.step}
            testID={option.testID}
            label={l`${option.title}: add one to spot ${spot}`}
            size="small"
            color="secondary"
            disabled={disabled}
            style={action}
            onPress={() => onAdd(option.step)}>
            <ButtonIcon icon={option.icon} />
            <ButtonText>{option.title}</ButtonText>
          </Button>
        ))}
      </View>
    </View>
  )
}
