import {useQuery} from '@tanstack/react-query'

import {videoDurationQueryKey} from './queryKeys'
import {usePlaybackDuration} from './usePlaybackSecond'

/*
 * A video's length, for drawing where people commented along it before (or
 * without) playing it. Bluesky's video views carry no duration, so it is read
 * from the video's HLS playlist: the main playlist names one playlist per
 * quality, and that one lists the segments with their lengths. Both are
 * small and cached by the video service for 30 days.
 */

/**
 * The playlist that lists the segments: the first variant named in
 * `master`, resolved next to `masterUrl`, or `masterUrl` itself when it
 * lists segments already.
 */
export function variantPlaylistUrl(
  master: string,
  masterUrl: string,
): string | undefined {
  if (master.includes('#EXTINF')) return masterUrl
  const lines = master.split(/\r?\n/).map(line => line.trim())
  const info = lines.findIndex(line => line.startsWith('#EXT-X-STREAM-INF'))
  if (info < 0) return undefined
  const uri = lines.slice(info + 1).find(line => line && !line.startsWith('#'))
  if (!uri) return undefined
  if (/^https?:\/\//.test(uri)) return uri
  // `URL` with a base isn't fully available on React Native.
  const base = masterUrl.split(/[?#]/)[0]
  return base.slice(0, base.lastIndexOf('/') + 1) + uri
}

/**
 * The length of a finished playlist in seconds: its segments added up, or
 * `undefined` for a live or empty one.
 */
export function playlistSeconds(media: string): number | undefined {
  if (!media.includes('#EXT-X-ENDLIST')) return undefined
  let seconds = 0
  for (const match of media.matchAll(/#EXTINF:\s*([\d.]+)/g)) {
    seconds += Number(match[1])
  }
  return seconds > 0 ? seconds : undefined
}

/** Reads a video's length from its playlist, in at most two requests. */
export async function fetchVideoDuration(
  playlistUrl: string,
  fetchText: (url: string) => Promise<string>,
): Promise<number | undefined> {
  const master = await fetchText(playlistUrl)
  const variantUrl = variantPlaylistUrl(master, playlistUrl)
  if (!variantUrl) return undefined
  const media =
    variantUrl === playlistUrl ? master : await fetchText(variantUrl)
  return playlistSeconds(media)
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} for a video playlist`)
  return res.text()
}

/**
 * The length of the video of `postUri`: as a player reported it, else read
 * from its `playlist` (only when `enabled`).
 */
export function useVideoDuration({
  postUri,
  playlist,
  enabled = true,
}: {
  postUri: string
  playlist: string | undefined
  enabled?: boolean
}): number | undefined {
  const played = usePlaybackDuration(postUri)
  const {data} = useQuery({
    queryKey: videoDurationQueryKey(playlist ?? ''),
    enabled: enabled && !played && !!playlist,
    // a video's length doesn't change
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: () => fetchVideoDuration(playlist!, fetchText),
  })
  return played ?? data
}
