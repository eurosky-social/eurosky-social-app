import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {useEnableMinimalShellMode} from '#/state/shell/minimal-mode'
import {atoms as a} from '#/alf'
import {BrandLogo} from '#/components/icons/BrandLogo'
import {type OsoPillKind, useOsoPill} from '#/features/osoNav/pills'
import {OSO_COLORS} from './theme'
import {type OsoTile, OsoTileGrid} from './TileGrid'

export type OsoLandingDestination =
  'news' | 'events' | 'explore' | 'feeds' | 'chats' | 'notifications'

/**
 * Full-screen chooser that is Oso's home page. No navigation chrome: it offers
 * every left menu destination as a tile, and the app continues from there as
 * usual.
 */
export function OsoLanding({
  onSelect,
}: {
  onSelect: (destination: OsoLandingDestination) => void
}) {
  const {t: l} = useLingui()
  useEnableMinimalShellMode()

  /*
   * Every tile takes its label and colours from the matching left menu
   * button, so the two always agree.
   */
  const news = useMenuTile(
    'news',
    'osoLandingNews',
    l`Opens the news page`,
    () => onSelect('news'),
  )
  const events = useMenuTile(
    'events',
    'osoLandingEvents',
    l`Opens the events page`,
    () => onSelect('events'),
  )
  const explore = useMenuTile(
    'explore',
    'osoLandingExplore',
    l`Opens the explore page`,
    () => onSelect('explore'),
  )
  const feeds = useMenuTile(
    'feeds',
    'osoLandingFeeds',
    l`Opens your feeds`,
    () => onSelect('feeds'),
  )
  const chats = useMenuTile(
    'chat',
    'osoLandingChats',
    l`Opens your chats`,
    () => onSelect('chats'),
  )
  const notifications = useMenuTile(
    'notifications',
    'osoLandingNotifications',
    l`Opens your notifications`,
    () => onSelect('notifications'),
  )

  return (
    <View
      testID="osoLanding"
      style={[
        a.util_screen_outer,
        a.flex_1,
        a.justify_center,
        a.align_center,
        a.px_xl,
        a.gap_4xl,
        {paddingBottom: '10vh', backgroundColor: OSO_COLORS.navy},
      ]}>
      <BrandLogo variant="mark" size={161} fill="#FFFFFF" />
      <OsoTileGrid
        holeColor={OSO_COLORS.navy}
        tiles={[news, events, explore]}
        moreTiles={[feeds, chats, notifications]}
      />
    </View>
  )
}

function useMenuTile(
  kind: OsoPillKind,
  testID: string,
  hint: string,
  onPress: () => void,
): OsoTile {
  const pill = useOsoPill(kind)
  return {
    testID,
    label: pill.label,
    hint,
    onPress,
    colors: {background: pill.background, text: pill.color},
  }
}
