import {createContext, useContext, useMemo} from 'react'
import {AtUri} from '@atproto/syntax'

import {type app} from '#/lexicons'

/** The post a URL asked to open with its tile playing: `/profile/<name>/post/<rkey>?tile=activate`. */
type Target = {name: string; rkey: string}

const TileAutoplayContext = createContext<Target | undefined>(undefined)
TileAutoplayContext.displayName = 'TileAutoplayContext'

/**
 * Set up by the thread screen when its URL carries `?tile=activate`, so that
 * the embed of the post the URL names skips its card and loads the tile
 * straight away. Nothing else in the thread is affected.
 */
export function TileAutoplayProvider({
  name,
  rkey,
  children,
}: {
  /** The post's author as the URL names them, or undefined when not asked. */
  name: string | undefined
  rkey: string
  children: React.ReactNode
}) {
  const value = useMemo(() => (name ? {name, rkey} : undefined), [name, rkey])
  return (
    <TileAutoplayContext.Provider value={value}>
      {children}
    </TileAutoplayContext.Provider>
  )
}

/** Whether this post is the one the URL asked to open playing. */
export function useTileAutoplay(
  post: app.bsky.feed.defs.PostView | undefined,
): boolean {
  const target = useContext(TileAutoplayContext)
  if (!target || !post) return false
  if (new AtUri(post.uri).rkey !== target.rkey) return false
  const name = target.name.toLowerCase()
  return post.author.did === name || post.author.handle.toLowerCase() === name
}
