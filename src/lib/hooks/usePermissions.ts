import {Linking} from 'react-native'
import {useCameraPermissions as useExpoCameraPermissions} from 'expo-camera'
import * as MediaLibrary from 'expo-media-library/legacy'

import {Alert} from '#/view/com/util/Alert'
import {BRAND} from '#/config/brand'
import {IS_ANDROID, IS_WEB} from '#/env'

const openPermissionAlert = (perm: string) => {
  Alert.alert(
    'Permission needed',
    `${BRAND.name} does not have permission to access your ${perm}.`,
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {text: 'Open Settings', onPress: () => Linking.openSettings()},
    ],
  )
}

export function usePhotoLibraryPermission() {
  const [res, requestPermission] = MediaLibrary.usePermissions({
    granularPermissions: ['photo'],
    get: !IS_ANDROID,
  })
  const requestPhotoAccessIfNeeded = async () => {
    /* System pickers grant access to selected files, not the whole library. */
    if (IS_ANDROID || IS_WEB) {
      return true
    }

    if (res?.granted) {
      return true
    } else if (!res || res.status === 'undetermined' || res?.canAskAgain) {
      const {canAskAgain, granted, status} = await requestPermission()

      if (!canAskAgain && status === 'undetermined') {
        openPermissionAlert('photo library')
      }

      return granted
    } else {
      openPermissionAlert('photo library')
      return false
    }
  }
  return {requestPhotoAccessIfNeeded}
}

export function useVideoLibraryPermission() {
  const [res, requestPermission] = MediaLibrary.usePermissions({
    granularPermissions: ['video'],
    get: !IS_ANDROID,
  })
  const requestVideoAccessIfNeeded = async () => {
    /* System pickers grant access to selected files, not the whole library. */
    if (IS_ANDROID || IS_WEB) {
      return true
    }

    if (res?.granted) {
      return true
    } else if (!res || res.status === 'undetermined' || res?.canAskAgain) {
      const {canAskAgain, granted, status} = await requestPermission()

      if (!canAskAgain && status === 'undetermined') {
        openPermissionAlert('video library')
      }

      return granted
    } else {
      openPermissionAlert('video library')
      return false
    }
  }
  return {requestVideoAccessIfNeeded}
}

export function useCameraPermission() {
  const [res, requestPermission] = useExpoCameraPermissions()

  const requestCameraAccessIfNeeded = async () => {
    if (res?.granted) {
      return true
    } else if (!res || res?.status === 'undetermined' || res?.canAskAgain) {
      const updatedRes = await requestPermission()
      return updatedRes?.granted
    } else {
      openPermissionAlert('camera')
      return false
    }
  }

  return {requestCameraAccessIfNeeded}
}
