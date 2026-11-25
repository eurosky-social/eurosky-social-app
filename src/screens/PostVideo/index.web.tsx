import {useEffect} from 'react'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import * as Layout from '#/components/Layout'

/**
 * On web the thread's own player jumps to the time, so this route only
 * forwards to the thread and keeps the `t` parameter.
 */
export function PostVideoScreen({
  route,
  navigation,
}: NativeStackScreenProps<CommonNavigatorParams, 'PostVideo'>) {
  const {name, rkey, t} = route.params
  useEffect(() => {
    navigation.replace('PostThread', {name, rkey, t})
  }, [navigation, name, rkey, t])
  return <Layout.Screen testID="postVideoScreen" />
}
