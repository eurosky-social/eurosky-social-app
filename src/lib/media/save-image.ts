import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'

import * as Toast from '#/components/Toast'
import {IS_NATIVE} from '#/env'
import {saveImageToMediaLibrary} from './manip'
import {requestPhotoSavePermission} from './photo-library'

/** Save downloaded images without requesting library read access on Android. */
export function useSaveImageToMediaLibrary() {
  const {_} = useLingui()
  return async (uri: string) => {
    if (!IS_NATIVE) {
      throw new Error('useSaveImageToMediaLibrary is native only')
    }

    try {
      if (!(await requestPhotoSavePermission())) {
        Toast.show(
          _(
            msg`Images cannot be saved unless permission is granted to access your photo library.`,
          ),
          {type: 'error'},
        )
        return
      }
      await saveImageToMediaLibrary({uri})
      Toast.show(_(msg`Image saved`))
    } catch (e: any) {
      Toast.show(_(msg`Failed to save image: ${String(e)}`), {type: 'error'})
    }
  }
}
