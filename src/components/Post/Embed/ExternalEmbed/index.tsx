import {useCallback, useMemo} from 'react'
import {Pressable, type StyleProp, View, type ViewStyle} from 'react-native'
import {BlurView} from 'expo-blur'
import {Image} from 'expo-image'
import {type AppBskyEmbedExternal, AtUri} from '@atproto/api'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'

import {type ResolvedDocumentRecord} from '#/lib/api/resolve'
import {parseAltFromGIFDescription} from '#/lib/gif-alt-text'
import {useHaptics} from '#/lib/haptics'
import {shareUrl} from '#/lib/sharing'
import {parseEmbedPlayerFromUrl} from '#/lib/strings/embed-player'
import {toNiceDomain} from '#/lib/strings/url-helpers'
import {useExternalEmbedsPrefs} from '#/state/preferences'
import {atoms as a, useTheme} from '#/alf'
import {ArrowShareRight_Stroke2_Corner2_Rounded as ArrowShareRightIcon} from '#/components/icons/ArrowShareRight'
import {Clock_Stroke2_Corner0_Rounded as ClockIcon} from '#/components/icons/Clock'
import {Earth_Stroke2_Corner0_Rounded as Globe} from '#/components/icons/Globe'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
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

function parseInlineSiteData(source: unknown): StandardSiteData | null {
  if (!source || typeof source !== 'object') return null
  const e = source as Record<string, unknown>
  const kind = typeof e.kind === 'string' ? e.kind : undefined
  if (!kind) return null
  const src =
    e.source && typeof e.source === 'object'
      ? (e.source as Record<string, unknown>)
      : undefined
  return {
    publishedAt: typeof e.publishedAt === 'string' ? e.publishedAt : undefined,
    source: nsidAuthority(kind),
    publication: src
      ? {
          name: typeof src.name === 'string' ? src.name : undefined,
          description:
            typeof src.description === 'string' ? src.description : undefined,
          icon: typeof src.icon === 'string' ? src.icon : undefined,
        }
      : undefined,
  }
}

export const ExternalEmbed = ({
  link,
  document,
  rawExternal,
  onOpen,
  style,
  hideAlt,
}: {
  link: AppBskyEmbedExternal.ViewExternal
  document?: ResolvedDocumentRecord
  rawExternal?: AppBskyEmbedExternal.External
  onOpen?: () => void
  style?: StyleProp<ViewStyle>
  hideAlt?: boolean
}) => {
  const {_, i18n} = useLingui()
  const t = useTheme()
  const playHaptic = useHaptics()
  const externalEmbedPrefs = useExternalEmbedsPrefs()
  const niceUrl = toNiceDomain(link.uri)
  const imageUri = link.thumb
  const embedPlayerParams = useMemo(() => {
    const params = parseEmbedPlayerFromUrl(link.uri)

    if (params && externalEmbedPrefs?.[params.source] !== 'hide') {
      return params
    }
  }, [link.uri, externalEmbedPrefs])
  const hasMedia = Boolean(imageUri || embedPlayerParams)

  const standardSiteData = document
    ? parseStandardSiteData(document)
    : parseInlineSiteData(rawExternal ?? link)

  console.log('DEBUG >>>', 'standardSiteData', standardSiteData)

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
            a.relative,
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
          {imageUri && !embedPlayerParams ? (
            <>
              {standardSiteData ? (
                <BlurView
                  style={[
                    a.absolute,
                    a.z_50,
                    a.flex_row,
                    a.align_center,
                    a.rounded_full,
                    a.border,
                    t.atoms.border_contrast_low,
                    {
                      left: 16,
                      top: 16,
                    },
                  ]}>
                  <View
                    style={[
                      a.flex_row,
                      a.align_center,
                      a.rounded_full,
                      {
                        backgroundColor: 'rgba(255,255,255,0.5)',
                      },
                    ]}>
                    <View
                      style={[
                        a.p_xs,
                        a.rounded_full,
                        {
                          backgroundColor: 'rgb(28, 31, 38',
                        },
                      ]}>
                      <Globe style={[{color: 'black'}]} size="lg" />
                    </View>
                    <Text
                      style={[
                        a.pl_sm,
                        a.pr_md,
                        a.text_sm,
                        a.font_semi_bold,
                        {
                          color: 'black',
                        },
                      ]}>
                      Powered by {standardSiteData?.source}
                    </Text>
                  </View>
                </BlurView>
              ) : null}
              <Image
                style={[a.aspect_card]}
                source={{
                  uri: imageUri,
                }}
                accessibilityIgnoresInvertColors
                loading="lazy"
              />
            </>
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
              {standardSiteData ? (
                <View style={[a.flex_row, a.align_center, a.pb_md]}>
                  <Text
                    style={[
                      a.text_xs,
                      a.font_medium,
                      t.atoms.text_contrast_medium,
                    ]}>
                    {i18n.date(standardSiteData?.publishedAt, {
                      dateStyle: 'medium',
                    })}
                  </Text>
                  <ArrowShareRightIcon
                    style={[a.mx_xs, t.atoms.text_contrast_medium]}
                    size="sm"
                  />
                  <Text
                    style={[
                      a.text_xs,
                      a.font_medium,
                      t.atoms.text_contrast_medium,
                    ]}>
                    12 shares
                  </Text>
                  <ClockIcon
                    style={[a.mx_xs, t.atoms.text_contrast_medium]}
                    size="sm"
                  />
                  <Text
                    style={[
                      a.text_xs,
                      a.font_medium,
                      t.atoms.text_contrast_medium,
                    ]}>
                    12 min
                  </Text>
                </View>
              ) : null}
              {standardSiteData ? (
                <View
                  style={[
                    a.rounded_md,
                    a.flex_row,
                    a.align_center,
                    a.justify_between,
                    a.p_md,
                    a.mb_md,
                    {
                      backgroundColor: '#63302e',
                    },
                  ]}>
                  {standardSiteData?.publication?.icon ? (
                    <Image
                      accessibilityIgnoresInvertColors
                      source={{uri: standardSiteData?.publication?.icon}}
                      style={[
                        a.rounded_sm,
                        {
                          height: 32,
                          width: 32,
                        },
                      ]}
                    />
                  ) : null}
                  <View>
                    <Text
                      style={[
                        a.font_semi_bold,
                        a.text_sm,
                        t.atoms.text_inverted,
                      ]}>
                      {standardSiteData?.publication?.name}
                    </Text>
                    <Text style={[a.mt_xs, a.text_xs, t.atoms.text_inverted]}>
                      by @{toNiceDomain(link.uri)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    style={[
                      a.flex_row,
                      a.align_center,
                      a.px_md,
                      a.py_sm,
                      a.rounded_sm,
                      {
                        backgroundColor: t.palette.contrast_50,
                      },
                    ]}
                    onPress={() => {}}>
                    <Text style={[a.font_semi_bold, a.text_sm, t.atoms.text]}>
                      Subscribe
                    </Text>
                    <PlusIcon style={[a.ml_2xs, t.atoms.text]} size="sm" />
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      )}
    </Link>
  )
}
