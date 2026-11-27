import {useEffect, useRef} from 'react'
import {type SizeLimits} from '@dasl/tile-lexicon'
import {type Tile} from '@dasl/tile-loader'
import {tileLinks} from '@dasl/tile-loader/link'
import {tileSize, type TileSizeControl} from '@dasl/tile-loader/size'

import {useGlobalDialogsControlContext} from '#/components/dialogs/Context'

/**
 * A loaded tile, running in the page: the one place the web build puts a
 * tile's frame in the document, shared by the post embed and the page an
 * installed tile runs on.
 *
 * The loader hands back a DOM iframe (the dock, which frames the tile's own
 * origin), so it is mounted into a plain div. The frame fills that div, whose
 * height React keeps in step with the width, so a resize never remounts (and
 * so reloads) the tile. Unmounting closes the tile: its runtime gets a moment
 * to unregister its worker and have its origin wiped, where the frame is
 * still in the document to do it, and the loader lets go of the frame either
 * way, so that nothing of a tile that was shown and put away is kept.
 *
 * The size protocol (https://dasl.ing/tp-size.html) runs over the same
 * frame. React owns the box, so the loader only passes on what the tile asks
 * for (`apply: false`, `onAsk`); the height that comes of it is the parent's
 * to decide, and the loader tells the tile the size it really has whenever
 * the box changes.
 */
export function TileFrame({
  tile,
  title,
  height,
  limits,
  onAsk,
}: {
  tile: Tile
  /** The frame's accessible name. */
  title: string
  height: number
  /** mu's limits on the tile's size, which its requests are answered with. */
  limits: SizeLimits
  /** The running tile asks for a height, in CSS pixels. */
  onAsk: (height: number) => void
}) {
  const {linkWarningDialogControl} = useGlobalDialogsControlContext()
  /*
   * The latest of what the frame's callbacks use sits in refs, so that the
   * effect that mounts the frame (and would reload the tile if it reran)
   * depends on the tile alone.
   */
  const openLinkDialogRef = useRef(linkWarningDialogControl.open)
  const onAskRef = useRef(onAsk)
  useEffect(() => {
    openLinkDialogRef.current = linkWarningDialogControl.open
    onAskRef.current = onAsk
  })
  const hostRef = useRef<HTMLDivElement>(null)
  const sizerRef = useRef<TileSizeControl | null>(null)
  const {minWidth, maxWidth, minHeight, maxHeight} = limits

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const frame = tile.renderContent()
    frame.style.height = '100%'
    frame.title = title
    /*
     * A credentialless frame (Chromium) gets a cookie jar and storage of its
     * own, emptied with the page: the tile sees none of the cookies of
     * mu.social, whose site its origin shares, and any it sets, for whatever
     * domain, stay in there. Other browsers ignore the attribute.
     */
    ;(frame as HTMLIFrameElement & {credentialless?: boolean}).credentialless =
      true
    host.replaceChildren(frame)
    const sizer = tileSize(tile, frame, {
      apply: false,
      onRequest: want => {
        if (want.height) onAskRef.current(want.height)
      },
    })
    sizerRef.current = sizer
    /*
     * A tile opens no window and navigates nothing but itself. A link out of
     * it is a request (https://dasl.ing/tp-link.html), and ours to open or
     * not: the tile chose the address, so the user sees it first, in the
     * dialog mu shows for any link it does not vouch for, and opens it from
     * there. A request nobody clicked for is refused. The tile is not told
     * what the user decided.
     */
    const links = tileLinks(tile, {
      open: (url, {activated}) => {
        if (!activated) return false
        openLinkDialogRef.current({displayText: '', href: url.href})
      },
    })
    return () => {
      sizerRef.current = null
      sizer.stop()
      links.stop()
      void tile.close()
    }
  }, [tile, title])

  /*
   * The limits follow the column and the window, so the tile is told of them
   * whenever either changes (and when it first runs): they are what its
   * requests are answered with.
   */
  useEffect(() => {
    sizerRef.current?.setLimits({minWidth, maxWidth, minHeight, maxHeight})
  }, [tile, title, minWidth, maxWidth, minHeight, maxHeight])

  return <div ref={hostRef} style={{width: '100%', height}} />
}
