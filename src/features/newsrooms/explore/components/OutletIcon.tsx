import {useState} from 'react'
import {View} from 'react-native'
import {Image} from 'expo-image'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {useSiteIconQuery} from '../../queries'
import {type ExploreOutlet} from '../cluster'

/**
 * Icon URLs that failed to load this session. Shared so the next bubble for the
 * same outlet goes straight to what works instead of failing the same way.
 */
const failedIcons = new Set<string>()

/**
 * An outlet's mark, as close to its own logo as can be found: its Bluesky
 * avatar, else the icon its site declares, else the site's `/favicon.ico`,
 * else its initial. Most outlets a labeler-backed source names have no Bluesky
 * account, so the site's own icon is what keeps them recognizable.
 */
export function OutletIcon({
  outlet,
  profile,
  size = 18,
}: {
  outlet: ExploreOutlet
  profile?: app.bsky.actor.defs.ProfileViewDetailed
  size?: number
}) {
  const t = useTheme()
  const [, setFailures] = useState(0)
  const avatar = profile?.avatar
  const {data: siteIcon, isLoading} = useSiteIconQuery({
    site: outlet.site,
    enabled: !avatar,
  })

  const candidates = [
    avatar,
    siteIcon,
    outlet.site ? `https://${outlet.site}/favicon.ico` : undefined,
  ].filter((url): url is string => !!url && !failedIcons.has(url))
  /* Wait for the declared icon rather than flashing the favicon guess first. */
  const source = !avatar && isLoading ? undefined : candidates[0]
  const name = outlet.name || outlet.id

  if (!source) {
    return (
      <View
        style={[
          a.align_center,
          a.justify_center,
          a.rounded_full,
          t.atoms.bg_contrast_50,
          {width: size, height: size},
        ]}>
        <Text
          style={[
            a.font_bold,
            t.atoms.text_contrast_medium,
            {fontSize: Math.round(size * 0.55), lineHeight: size},
          ]}>
          {name.charAt(0).toUpperCase()}
        </Text>
      </View>
    )
  }

  return (
    <Image
      accessibilityIgnoresInvertColors
      source={{uri: source}}
      onError={() => {
        failedIcons.add(source)
        setFailures(count => count + 1)
      }}
      style={[
        a.rounded_full,
        t.atoms.bg_contrast_25,
        {width: size, height: size},
      ]}
      contentFit="cover"
    />
  )
}
