import {useCallback} from 'react'
import {useLingui} from '@lingui/react/macro'
import {useQueryClient} from '@tanstack/react-query'

import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {logger} from '#/logger'
import {useAppviewClient, useRequireAuth} from '#/state/session'
import * as Toast from '#/components/Toast'
import {fetchIsTrustedTile} from './author'
import {UntrustedTileInstallError, useTileInstall} from './installs'
import {fetchTilesPaused} from './policy'
import {type TileRef} from './record'

/**
 * Installing and uninstalling a tile from a button: `useTileInstall` with the
 * sign-in prompt and the toasts every such button shares (the one on a tile
 * post, the ones on the Apps screen and on a tile's own page).
 */
export function useTileInstallToggle(tile: TileRef | string | undefined) {
  const {t: l} = useLingui()
  const requireAuth = useRequireAuth()
  const {uri, installed, pending, install, uninstall} = useTileInstall(tile)

  const onInstall = useCallback(async () => {
    try {
      await install()
      Toast.show(l`Installed. You'll find it under Apps.`, {type: 'success'})
    } catch (e) {
      if (e instanceof UntrustedTileInstallError) {
        Toast.show(
          l`This tile can't be installed: its author isn't verified.`,
          {type: 'warning'},
        )
        return
      }
      logger.warn('tiles: could not install tile', {safeMessage: e, uri})
      Toast.show(l`Could not install this tile.`, {type: 'error'})
    }
  }, [install, l, uri])

  const onUninstall = useCallback(async () => {
    try {
      await uninstall()
      Toast.show(l`Uninstalled.`)
    } catch (e) {
      logger.warn('tiles: could not uninstall tile', {safeMessage: e, uri})
      Toast.show(l`Could not uninstall this tile.`, {type: 'error'})
    }
  }, [uninstall, l, uri])

  /** Installs, or uninstalls when already installed; asks to sign in first. */
  const toggle = useCallback(() => {
    requireAuth(() => {
      if (pending || installed === undefined) return
      void (installed ? onUninstall() : onInstall())
    })
  }, [requireAuth, pending, installed, onInstall, onUninstall])

  return {
    uri,
    installed,
    pending,
    install: onInstall,
    uninstall: onUninstall,
    toggle,
  }
}

/**
 * Opens the composer on a new post with a tile attached as its card, the way
 * pasting the tile's address does. The same checks apply as when attaching
 * by hand (`attach.ts`): none while tiles are paused, and none by an
 * unverified author, since neither would play.
 */
export function usePostTile(): (uri: string) => Promise<void> {
  const {t: l} = useLingui()
  const queryClient = useQueryClient()
  const appviewClient = useAppviewClient()
  const requireAuth = useRequireAuth()
  const {openComposer} = useOpenComposer()
  return useCallback(
    async (uri: string) => {
      if (await fetchTilesPaused(queryClient)) {
        Toast.show(l`Tiles are paused right now, so one can't be posted.`, {
          type: 'error',
        })
        return
      }
      if (!(await fetchIsTrustedTile(queryClient, appviewClient, uri))) {
        Toast.show(
          l`Only tiles published by verified accounts can be posted.`,
          {type: 'error'},
        )
        return
      }
      requireAuth(() => openComposer({externalUri: uri, logContext: 'Other'}))
    },
    [l, queryClient, appviewClient, requireAuth, openComposer],
  )
}
