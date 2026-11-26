import {useContext, useEffect, useRef} from 'react'
import {NavigationContext} from '@react-navigation/native'

import {MEDIA_TIME_ENABLED} from './config'
import {registerSeekTarget} from './playback'

/**
 * Hand-off between the web video card (always mounted) and its inner player
 * (mounted only while near the screen). A jump that arrives while the inner
 * player is not mounted waits in `pending`.
 */
export type MediaTimeSeekBridge = React.RefObject<{
  seek: ((seconds: number) => void) | null
  pause: (() => void) | null
  pending: number | undefined
}>

/**
 * Registers the web video card of `postUri` as a jump target. A jump scrolls
 * the card into view and is passed to the inner player, or kept until it
 * mounts; a pause is passed on if the player is mounted. Returns the bridge
 * to hand to the inner player.
 */
export function useMediaTimeWebCard({
  postUri,
  containerRef,
}: {
  postUri: string | undefined
  containerRef: React.RefObject<HTMLElement | null>
}): MediaTimeSeekBridge {
  const bridge: MediaTimeSeekBridge = useRef({
    seek: null,
    pause: null,
    pending: undefined,
  })
  const navigation = useContext(NavigationContext)

  useEffect(() => {
    if (!MEDIA_TIME_ENABLED || !postUri) return
    return registerSeekTarget(postUri, {
      seek: seconds => {
        containerRef.current?.scrollIntoView?.({
          block: 'center',
          behavior: 'smooth',
        })
        if (bridge.current.seek) {
          bridge.current.seek(seconds)
        } else {
          bridge.current.pending = seconds
        }
      },
      pause: () => bridge.current.pause?.(),
      isActive: () => navigation?.isFocused() ?? true,
    })
  }, [postUri, containerRef, navigation])

  return bridge
}

/**
 * Connects the inner web player to its card's bridge: jumps to a second,
 * makes this the active video with sound on, and plays; or pauses.
 */
export function useMediaTimeWebSeek({
  bridge,
  videoRef,
  lastKnownTime,
  setActive,
  setFocused,
}: {
  bridge: MediaTimeSeekBridge | undefined
  videoRef: React.RefObject<HTMLVideoElement | null>
  lastKnownTime: React.RefObject<number | undefined>
  setActive: () => void
  setFocused: (focused: boolean) => void
}) {
  useEffect(() => {
    if (!bridge) return
    const seek = (seconds: number) => {
      const video = videoRef.current
      if (!video) return
      lastKnownTime.current = seconds
      setActive()
      setFocused(true)
      seekWhenReady(video, seconds)
      const playing = video.play() as Promise<void> | undefined
      playing?.catch(() => {})
    }
    const pause = () => videoRef.current?.pause()
    bridge.current.seek = seek
    bridge.current.pause = pause
    const pending = bridge.current.pending
    if (pending !== undefined) {
      bridge.current.pending = undefined
      seek(pending)
    }
    return () => {
      if (bridge.current.seek === seek) {
        bridge.current.seek = null
      }
      if (bridge.current.pause === pause) {
        bridge.current.pause = null
      }
    }
  }, [bridge, videoRef, lastKnownTime, setActive, setFocused])
}

/** `HTMLMediaElement.HAVE_METADATA`, without needing the DOM global. */
const HAVE_METADATA = 1

/**
 * Sets the playback position, waiting for the video's metadata if needed:
 * before that, browsers ignore or reset `currentTime`.
 */
export function seekWhenReady(
  video: Pick<
    HTMLVideoElement,
    'readyState' | 'currentTime' | 'addEventListener'
  >,
  seconds: number,
) {
  if (video.readyState >= HAVE_METADATA) {
    video.currentTime = seconds
    return
  }
  video.addEventListener(
    'loadedmetadata',
    () => {
      video.currentTime = seconds
    },
    {once: true},
  )
}
