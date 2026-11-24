import {useState} from 'react'

import {MEDIA_TIME_ENABLED} from './config'
import {
  getMediaTimeLinkGraphemes,
  getOwnVideoEmbed,
  MAX_MEDIA_TIME_SECONDS,
} from './record'

/** How far one tap on the composer's minus or plus buttons moves the time. */
export const MEDIA_TIME_NUDGE_SECONDS = 5

export type ComposerMediaTimeState = ReturnType<typeof useComposerMediaTime>

/**
 * Composer state for linking a reply to a second of the video it replies to.
 * `value` is the second to publish, or `undefined` when the reply is about
 * the whole video. `reservedGraphemes` is what the time link adds to the
 * first post's length.
 */
export function useComposerMediaTime(initialSeconds: number | undefined) {
  const [seconds, setSeconds] = useState(initialSeconds ?? 0)
  const [attached, setAttached] = useState(true)
  const available = MEDIA_TIME_ENABLED && initialSeconds !== undefined
  const value = available && attached ? seconds : undefined

  return {
    available,
    attached,
    seconds,
    value,
    reservedGraphemes:
      value === undefined ? 0 : getMediaTimeLinkGraphemes(value),
    nudge: (delta: number) => {
      setSeconds(prev =>
        Math.min(MAX_MEDIA_TIME_SECONDS, Math.max(0, prev + delta)),
      )
    },
    detach: () => setAttached(false),
    reattach: () => {
      setSeconds(initialSeconds ?? 0)
      setAttached(true)
    },
  }
}

/**
 * Fills in the second for a reply opened while the replied-to post's video
 * was being watched, unless the caller already decided.
 */
export function resolveComposerMediaTime({
  explicit,
  replyTo,
  getWatchedSeconds,
}: {
  explicit: number | undefined
  replyTo:
    {uri: string; embed?: Parameters<typeof getOwnVideoEmbed>[0]} | undefined
  getWatchedSeconds: (postUri: string) => number | undefined
}): number | undefined {
  if (!MEDIA_TIME_ENABLED || !replyTo) return undefined
  const video = getOwnVideoEmbed(replyTo.embed)
  if (!video || video.presentation === 'gif') return undefined
  return explicit ?? getWatchedSeconds(replyTo.uri)
}
