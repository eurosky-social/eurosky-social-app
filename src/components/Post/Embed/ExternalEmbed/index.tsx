import {useCallback, useMemo} from 'react'
import {type StyleProp, View, type ViewStyle} from 'react-native'
import {Image} from 'expo-image'
import {type AppBskyEmbedExternal, AtUri} from '@atproto/api'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'

import {type ResolvedDocumentRecord} from '#/lib/api/resolve'
import {parseAltFromGIFDescription} from '#/lib/gif-alt-text'
import {useHaptics} from '#/lib/haptics'
import {useGetTimeAgo} from '#/lib/hooks/useTimeAgo'
import {shareUrl} from '#/lib/sharing'
import {parseEmbedPlayerFromUrl} from '#/lib/strings/embed-player'
import {toNiceDomain} from '#/lib/strings/url-helpers'
import {useExternalEmbedsPrefs} from '#/state/preferences'
import {atoms as a, useTheme} from '#/alf'
import {Divider} from '#/components/Divider'
import {GradientFill} from '#/components/GradientFill'
import {Earth_Stroke2_Corner0_Rounded as Globe} from '#/components/icons/Globe'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {IS_NATIVE} from '#/env'
import {ExternalGif} from './ExternalGif'
import {ExternalPlayer} from './ExternalPlayer'
import {GifEmbed} from './Gif'

type StandardSiteData = {
  title?: string
  description?: string
  publishedAt?: string
  source: string
  publication?: {
    name?: string
    description?: string
    url?: string
    icon?: string
    accentColor?: string
  }
}

function parseStandardSiteData(
  document: ResolvedDocumentRecord,
): StandardSiteData | null {
  const value = document.value
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const pub = document.publication?.value as Record<string, unknown> | undefined
  return {
    title: typeof v.title === 'string' ? v.title : undefined,
    description: typeof v.description === 'string' ? v.description : undefined,
    publishedAt: typeof v.publishedAt === 'string' ? v.publishedAt : undefined,
    source: nsidAuthority(new AtUri(document.uri).collection),
    publication: pub
      ? {
          name: typeof pub.name === 'string' ? pub.name : undefined,
          description:
            typeof pub.description === 'string' ? pub.description : undefined,
          url: typeof pub.url === 'string' ? pub.url : undefined,
          icon: typeof pub.icon === 'string' ? pub.icon : undefined,
          accentColor:
            typeof (pub.basicTheme as Record<string, unknown> | undefined)
              ?.accent === 'string'
              ? ((pub.basicTheme as Record<string, unknown>).accent as string)
              : undefined,
        }
      : undefined,
  }
}

function nsidAuthority(nsid: string): string {
  const parts = nsid.split('.')
  return parts.slice(0, -1).reverse().join('.')
}

export const ExternalEmbed = ({
  link,
  document,
  onOpen,
  style,
  hideAlt,
}: {
  link: AppBskyEmbedExternal.ViewExternal
  document?: ResolvedDocumentRecord
  onOpen?: () => void
  style?: StyleProp<ViewStyle>
  hideAlt?: boolean
}) => {
  const {_} = useLingui()
  const t = useTheme()
  const playHaptic = useHaptics()
  const externalEmbedPrefs = useExternalEmbedsPrefs()
  const niceUrl = toNiceDomain(link.uri)
  const getTimeAgo = useGetTimeAgo()
  const imageUri = link.thumb
  const embedPlayerParams = useMemo(() => {
    const params = parseEmbedPlayerFromUrl(link.uri)

    if (params && externalEmbedPrefs?.[params.source] !== 'hide') {
      return params
    }
  }, [link.uri, externalEmbedPrefs])
  const hasMedia = Boolean(imageUri || embedPlayerParams)

  const standardSiteData = document ? parseStandardSiteData(document) : null

  const timeAgo = standardSiteData?.publishedAt
    ? getTimeAgo(standardSiteData.publishedAt, new Date())
    : null

  const onPress = useCallback(() => {
    playHaptic('Light')
    onOpen?.()
  }, [playHaptic, onOpen])

  const onShareExternal = useCallback(() => {
    if (link.uri && IS_NATIVE) {
      playHaptic('Heavy')
      shareUrl(link.uri)
    }
  }, [link.uri, playHaptic])

  if (
    embedPlayerParams?.source === 'tenor' ||
    embedPlayerParams?.source === 'klipy'
  ) {
    const parsedAlt = parseAltFromGIFDescription(link.description)
    return (
      <View style={style}>
        <GifEmbed
          params={embedPlayerParams}
          thumb={link.thumb}
          altText={parsedAlt.alt}
          isPreferredAltText={parsedAlt.isPreferred}
          hideAlt={hideAlt}
        />
      </View>
    )
  }

  let heading: React.ReactNode = null
  if (standardSiteData) {
    const accentColor = standardSiteData.publication?.accentColor
    const iconUri = standardSiteData.publication?.icon
    heading = (
      <>
        <View
          style={[
            a.flex_row,
            a.align_center,
            a.p_sm,
            accentColor ? {backgroundColor: accentColor} : undefined,
          ]}>
          {accentColor ? (
            <GradientFill
              gradient={{
                values: [
                  // @ts-expect-error Just for demonstration purposes.
                  [0, '#fff'],
                  // @ts-expect-error Just for demonstration purposes.
                  [0.5, '#fff'],
                  // @ts-expect-error Just for demonstration purposes.
                  [1, accentColor],
                ],
                // @ts-expect-error Just for demonstration purposes.
                hover_value: '#fff',
              }}
            />
          ) : null}
          {iconUri ? (
            <Image
              accessibilityIgnoresInvertColors
              source={{uri: iconUri}}
              style={[
                a.rounded_full,
                a.mr_xs,
                {
                  height: 24,
                  width: 24,
                },
              ]}
            />
          ) : null}
          <Text
            numberOfLines={1}
            style={[a.text_sm, a.font_semi_bold, a.leading_snug, t.atoms.text]}>
            {standardSiteData.publication?.name || standardSiteData.title}
          </Text>
          {timeAgo ? (
            <>
              <Text> </Text>
              <Text
                numberOfLines={1}
                style={[
                  a.text_xs,
                  a.leading_snug,
                  t.atoms.text_contrast_medium,
                ]}>
                &middot; {timeAgo}
              </Text>
            </>
          ) : null}
        </View>
        <Divider />
      </>
    )
  }

  return (
    <Link
      label={link.title || _(msg`Open link to ${niceUrl}`)}
      to={link.uri}
      shouldProxy={true}
      onPress={onPress}
      onLongPress={onShareExternal}>
      {({hovered}) => (
        <View
          style={[
            a.transition_color,
            a.flex_col,
            a.rounded_md,
            a.overflow_hidden,
            a.w_full,
            a.border,
            style,
            hovered
              ? t.atoms.border_contrast_high
              : t.atoms.border_contrast_low,
          ]}>
          {heading}
          {imageUri && !embedPlayerParams ? (
            <Image
              style={[a.aspect_card]}
              source={{uri: imageUri}}
              accessibilityIgnoresInvertColors
              loading="lazy"
            />
          ) : undefined}

          {embedPlayerParams?.isGif ? (
            <ExternalGif link={link} params={embedPlayerParams} />
          ) : embedPlayerParams ? (
            <ExternalPlayer link={link} params={embedPlayerParams} />
          ) : undefined}

          <View
            style={[
              a.flex_1,
              a.pt_sm,
              {gap: 3},
              hasMedia && a.border_t,
              hovered
                ? t.atoms.border_contrast_high
                : t.atoms.border_contrast_low,
            ]}>
            <View style={[{gap: 3}, a.pb_xs, a.px_md]}>
              {!embedPlayerParams?.isGif && !embedPlayerParams?.dimensions && (
                <Text
                  emoji
                  numberOfLines={3}
                  style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
                  {standardSiteData?.title || link.title || link.uri}
                </Text>
              )}
              {standardSiteData?.description || link.description ? (
                <Text
                  emoji
                  numberOfLines={link.thumb ? 2 : 4}
                  style={[a.text_sm, a.leading_snug]}>
                  {standardSiteData?.description || link.description}
                </Text>
              ) : undefined}
            </View>
            <View style={[a.px_md]}>
              <Divider />
              <View
                style={[
                  a.flex_row,
                  a.align_center,
                  a.justify_between,
                  a.gap_2xs,
                  a.pb_sm,
                  {
                    paddingTop: 6, // off menu
                  },
                ]}>
                <View style={[a.flex_row, a.align_center]}>
                  <Globe
                    size="xs"
                    style={[
                      a.mr_2xs,
                      a.transition_color,
                      hovered
                        ? t.atoms.text_contrast_medium
                        : t.atoms.text_contrast_low,
                    ]}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      a.transition_color,
                      a.text_xs,
                      a.leading_snug,
                      hovered
                        ? t.atoms.text_contrast_high
                        : t.atoms.text_contrast_medium,
                    ]}>
                    {toNiceDomain(link.uri)}
                  </Text>
                </View>
                {standardSiteData ? (
                  <View>
                    <Text
                      numberOfLines={1}
                      style={[
                        a.text_xs,
                        a.leading_snug,
                        t.atoms.text_contrast_medium,
                      ]}>
                      {standardSiteData.source}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      )}
    </Link>
  )
}
