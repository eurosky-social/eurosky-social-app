import {memo} from 'react'
import {type Insets} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {type Shadow} from '#/state/cache/post-shadow'
import {useTheme} from '#/alf'
import {CircleCheck_Stroke2_Corner0_Rounded as InstalledIcon} from '#/components/icons/Circle'
import {Download_Stroke2_Corner0_Rounded as InstallIcon} from '#/components/icons/Download'
import {
  PostControlButton,
  PostControlButtonIcon,
} from '#/components/PostControls/PostControlButton'
import {type app} from '#/lexicons'
import {useTileInstallToggle} from '../actions'
import {getTileRef, type TileRef} from '../record'

/**
 * The install button of a tile post, next to the bookmark: nothing at all on
 * a post that carries no tile. It installs the tile, not the post, so every
 * post of the same tile shows the same state: an arrow into a tray until the
 * tile is installed, a check in the brand colour once it is. Pressing it
 * again uninstalls.
 */
export const TileInstallButton = memo(function TileInstallButton({
  post,
  big,
  hitSlop,
}: {
  post: Shadow<app.bsky.feed.defs.PostView>
  big?: boolean
  hitSlop?: Insets
}): React.ReactNode {
  const tile = getTileRef(post)
  if (!tile) return null
  return <TileInstallControl tile={tile} big={big} hitSlop={hitSlop} />
})

function TileInstallControl({
  tile,
  big,
  hitSlop,
}: {
  tile: TileRef
  big?: boolean
  hitSlop?: Insets
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {installed, toggle} = useTileInstallToggle(tile)

  return (
    <PostControlButton
      testID="postTileInstallBtn"
      big={big}
      active={!!installed}
      activeColor={t.palette.primary_500}
      label={installed ? l`Uninstall this tile` : l`Install this tile`}
      onPress={toggle}
      hitSlop={hitSlop}>
      <PostControlButtonIcon icon={installed ? InstalledIcon : InstallIcon} />
    </PostControlButton>
  )
}
