import {useState} from 'react'
import {useWindowDimensions, View} from 'react-native'
import {useReducedMotion} from 'react-native-reanimated'
import {Image} from 'expo-image'
import {type ModerationUI} from '@bsky/sdk/moderation'
import {useLingui} from '@lingui/react/macro'

import {useModerationCauseDescription} from '#/lib/moderation/useModerationCauseDescription'
import {useAutoplayDisabled} from '#/state/preferences'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Image_Stroke2_Corner2_Rounded as ImagesIcon} from '#/components/icons/Image'
import {Play_Filled_Corner2_Rounded as PlayIcon} from '#/components/icons/Play'
import {VideoEmbed} from '#/components/Post/Embed/VideoEmbed'
import {Text} from '#/components/Typography'
import {type PostArticle} from '#/features/articles/articles'
import {type app} from '#/lexicons'
import {type CardKind} from '../model'
import {type CardSize} from '../slotting'
import {COMPACT_THUMB_WIDTH, LEAD_MEDIA_MAX_HEIGHT, mediaRatio} from './styles'

const ON_MEDIA = '#fff'
const BADGE_BG = 'rgba(0,0,0,0.72)'

function mediaCount(article: PostArticle) {
  const media = article.media
  if (media?.type === 'images') return media.view.images.length
  if (media?.type === 'gallery') return media.view.items.length
  return 1
}

/**
 * Card picture. Decorative for assistive technology, since the card link's
 * name carries the story; only the moderation Show button is interactive. A
 * Lead video plays muted in place unless autoplay is off or the reader prefers
 * reduced motion; it never takes taps, which open the post.
 */
export function Media({
  article,
  kind,
  size,
  moderation,
  post,
}: {
  article: PostArticle
  kind: CardKind
  size: CardSize
  moderation?: ModerationUI
  post?: app.bsky.feed.defs.PostView
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {height} = useWindowDimensions()
  const [revealed, setRevealed] = useState(false)
  const cause = useModerationCauseDescription(moderation?.blurs[0])
  const blurred = !!moderation?.blur && !revealed
  const compact = size === 'compact'
  const isLead =
    size === 'lead' || size === 'leadTablet' || size === 'leadPhone'
  const playable = kind === 'video' || kind === 'youtube'
  const count = kind === 'gallery' ? mediaCount(article) : 0
  const autoplayDisabled = useAutoplayDisabled()
  const reducedMotion = useReducedMotion()
  const autoplay =
    isLead &&
    !blurred &&
    !autoplayDisabled &&
    !reducedMotion &&
    article.media?.type === 'video' &&
    kind === 'video'
  if (!article.image) return null
  return (
    <View
      testID={blurred ? 'newsCardMediaBlurred' : 'newsCardMediaFrame'}
      pointerEvents={blurred ? 'box-none' : 'none'}
      style={[
        a.relative,
        a.overflow_hidden,
        a.rounded_xs,
        t.atoms.bg_contrast_25,
        compact ? {width: COMPACT_THUMB_WIDTH} : a.w_full,
      ]}>
      <View
        testID="newsCardMedia"
        pointerEvents="none"
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          a.w_full,
          {aspectRatio: mediaRatio(kind, size)},
          isLead && {maxHeight: height * LEAD_MEDIA_MAX_HEIGHT},
        ]}>
        <Image
          source={{uri: article.image}}
          accessibilityIgnoresInvertColors
          contentFit="cover"
          blurRadius={blurred ? 40 : undefined}
          transition={150}
          style={[a.absolute, a.inset_0]}
        />
        {autoplay && article.media?.type === 'video' && (
          <View aria-hidden style={[a.absolute, a.inset_0]}>
            <VideoEmbed embed={article.media.view} post={post} immersive />
          </View>
        )}
        {!blurred && !autoplay && (playable || count > 1) && (
          <View
            testID="newsCardBadge"
            style={[
              a.absolute,
              a.flex_row,
              a.align_center,
              a.gap_xs,
              a.rounded_full,
              compact ? a.p_xs : [a.py_xs, a.px_sm],
              {backgroundColor: BADGE_BG, bottom: 8},
              count > 1 ? {right: 8} : {left: 8},
            ]}>
            {playable ? (
              <PlayIcon size="xs" fill={ON_MEDIA} />
            ) : (
              <ImagesIcon size="xs" fill={ON_MEDIA} />
            )}
            {!compact && (
              <Text style={[a.text_xs, a.font_semi_bold, {color: ON_MEDIA}]}>
                {playable ? l`Video` : `1/${count}`}
              </Text>
            )}
          </View>
        )}
      </View>
      {blurred && (
        <View
          style={[
            a.absolute,
            a.inset_0,
            a.align_center,
            a.justify_center,
            a.gap_sm,
            a.p_md,
            {backgroundColor: 'rgba(0,0,0,0.35)'},
          ]}>
          {!compact && (
            <Text
              style={[
                a.text_sm,
                a.font_semi_bold,
                a.text_center,
                {color: ON_MEDIA},
              ]}>
              {cause.name}
            </Text>
          )}
          <Button
            testID="newsCardMediaShow"
            label={l`Show media`}
            size="tiny"
            color="secondary_inverted"
            onPress={() => setRevealed(true)}>
            <ButtonText>{l`Show`}</ButtonText>
          </Button>
        </View>
      )}
    </View>
  )
}
