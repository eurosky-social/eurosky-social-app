import * as MediaLibrary from 'expo-media-library/legacy'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'

import {useCameraPermission} from '#/lib/hooks/usePermissions'
import {
  requestPhotoSavePermission,
  savePhotoToLibrary,
} from '#/lib/media/photo-library'
import {openCamera} from '#/lib/media/picker'
import {logger} from '#/logger'
import {createComposerImage} from '#/state/gallery'
import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {Camera_Stroke2_Corner0_Rounded as Camera} from '#/components/icons/Camera'
import {IS_ANDROID, IS_NATIVE, IS_WEB_MOBILE} from '#/env'
import {type OpenCameraBtnProps} from './OpenCameraBtn.shared'

export function OpenCameraBtn({disabled, onAdd}: OpenCameraBtnProps) {
  const {_} = useLingui()
  const {requestCameraAccessIfNeeded} = useCameraPermission()
  const [mediaPermissionRes, requestMediaPermission] =
    MediaLibrary.usePermissions({
      granularPermissions: ['photo'],
      get: !IS_ANDROID,
    })
  const t = useTheme()

  const mediaGranted = mediaPermissionRes?.granted
  const mediaCanAskAgain = mediaPermissionRes?.canAskAgain

  /*
   * No useCallback: with the diagnostics above resolved this component compiles,
   * so React Compiler memoizes it, and the hand-written deps were what it could
   * not preserve.
   */
  const onPressTakePicture = async () => {
    try {
      if (!(await requestCameraAccessIfNeeded())) {
        return
      }
      if (!IS_ANDROID && !mediaGranted) {
        if (mediaCanAskAgain) {
          await requestMediaPermission()
        }
      }

      const img = await openCamera({
        aspect: [1, 1],
      })
      if (!img) {
        return
      }

      if (IS_ANDROID) {
        /* Saving a gallery copy must never prevent attaching the capture. */
        try {
          if (await requestPhotoSavePermission()) {
            await savePhotoToLibrary(img.path)
          }
        } catch (error) {
          logger.warn('Failed to save camera photo', {error})
        }
      } else if (mediaPermissionRes) {
        await MediaLibrary.createAssetAsync(img.path)
      }

      const res = await createComposerImage(img)

      onAdd([res])
    } catch (err: any) {
      // ignore
      logger.warn('Error using camera', {error: err})
    }
  }

  const shouldShowCameraButton = IS_NATIVE || IS_WEB_MOBILE
  if (!shouldShowCameraButton) {
    return null
  }

  return (
    <Button
      testID="openCameraButton"
      onPress={onPressTakePicture}
      label={_(msg`Camera`)}
      accessibilityHint={_(msg`Opens camera on device`)}
      style={a.p_sm}
      variant="ghost"
      shape="round"
      color="primary"
      disabled={disabled}>
      <Camera size="lg" style={disabled && t.atoms.text_contrast_low} />
    </Button>
  )
}
