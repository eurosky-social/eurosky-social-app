import {useEffect, useRef} from 'react'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {IS_WEB} from '#/env'
import {MEDIA_TIME_ENABLED} from './config'
import {queueSeek, seekIfVisible} from './playback'
import {parseMediaTimeParam} from './record'

/**
 * Handles the `t` parameter of a thread link (`…/post/<rkey>?t=41`), as
 * written in comments' time links. On web the thread's own player jumps
 * there once it mounts; on iOS and Android the full-screen player opens.
 * Runs once per screen.
 */
export function useMediaTimeParam({
  postUri,
  name,
  rkey,
  t,
}: {
  postUri: string
  name: string
  rkey: string
  t: string | undefined
}) {
  const navigation = useNavigation<NavigationProp>()
  const handled = useRef(false)

  useEffect(() => {
    if (!MEDIA_TIME_ENABLED || handled.current) return
    const seconds = parseMediaTimeParam(t)
    if (seconds === undefined) return
    handled.current = true
    if (IS_WEB) {
      if (!seekIfVisible(postUri, seconds)) {
        queueSeek(postUri, seconds)
      }
    } else {
      navigation.navigate('PostVideo', {name, rkey, t: String(seconds)})
    }
  }, [navigation, postUri, name, rkey, t])
}
