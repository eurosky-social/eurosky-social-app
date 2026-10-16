import {useState} from 'react'
import {Pressable, View} from 'react-native'
import {Image} from 'expo-image'
import {Trans, useLingui} from '@lingui/react/macro'

import {IMAGE_SIZE_CONFIG_2K_1MB} from '#/lib/constants'
import {usePhotoLibraryPermission} from '#/lib/hooks/usePermissions'
import {compressIfNeeded} from '#/lib/media/manip'
import {openCropper, openPicker} from '#/lib/media/picker'
import {isCancelledError} from '#/lib/strings/errors'
import {logger} from '#/logger'
import {
  type ComposerImage,
  compressImage,
  createComposerImage,
} from '#/state/gallery'
import {EditImageDialog} from '#/view/com/composer/photos/EditImageDialog'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {useSheetWrapper} from '#/components/Dialog/sheet-wrapper'
import {Image_Stroke2_Corner2_Rounded as ImageIcon} from '#/components/icons/Image'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {IS_NATIVE} from '#/env'
import {type EventFormImage} from './form'

/** Matches `Event.Banner`, so the crop is what the feed shows. */
const ASPECT_RATIO = 16 / 9

/**
 * The event's cover image. Picks from the library, crops to the banner's
 * aspect ratio and compresses, like the profile banner picker.
 */
export function EventImageField({
  image,
  onChange,
}: {
  image?: EventFormImage
  onChange: (image: EventFormImage | undefined) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {requestPhotoAccessIfNeeded} = usePhotoLibraryPermission()
  const sheetWrapper = useSheetWrapper()
  const editImageDialogControl = useDialogControl()
  const [rawImage, setRawImage] = useState<ComposerImage>()

  const onPick = async () => {
    if (!(await requestPhotoAccessIfNeeded())) return
    const [item] = await sheetWrapper(openPicker())
    if (!item) return

    try {
      if (IS_NATIVE) {
        const cropped = await openCropper({
          imageUri: item.path,
          aspectRatio: ASPECT_RATIO,
        })
        const compressed = await compressIfNeeded(
          cropped,
          IMAGE_SIZE_CONFIG_2K_1MB,
        )
        onChange({uri: compressed.path, upload: compressed})
      } else {
        // Web crops in a dialog, which reports back through onCropped.
        setRawImage(await createComposerImage(item))
        editImageDialogControl.open()
      }
    } catch (e) {
      if (!isCancelledError(e)) {
        logger.error('Failed to pick event image', {safeMessage: e})
        Toast.show(l`Couldn’t use that image`, {type: 'error'})
      }
    }
  }

  const onCropped = async (cropped: ComposerImage) => {
    try {
      const compressed = await compressImage(cropped, IMAGE_SIZE_CONFIG_2K_1MB)
      onChange({uri: compressed.path, upload: compressed})
    } catch (e) {
      logger.error('Failed to compress event image', {safeMessage: e})
      Toast.show(l`Couldn’t use that image`, {type: 'error'})
    }
  }

  return (
    <>
      {image ? (
        <View style={[a.relative]}>
          <Image
            source={{uri: image.uri}}
            accessibilityIgnoresInvertColors
            style={[
              a.w_full,
              a.rounded_md,
              t.atoms.bg_contrast_25,
              {aspectRatio: ASPECT_RATIO},
            ]}
          />
          <View style={[a.absolute, a.flex_row, a.gap_xs, {top: 8, right: 8}]}>
            <Button
              label={l`Change image`}
              onPress={() => void onPick()}
              size="small"
              color="secondary"
              shape="round"
              testID="eventImageChangeBtn">
              <ButtonIcon icon={PencilIcon} />
            </Button>
            <Button
              label={l`Remove image`}
              onPress={() => onChange(undefined)}
              size="small"
              color="secondary"
              shape="round"
              testID="eventImageRemoveBtn">
              <ButtonIcon icon={TrashIcon} />
            </Button>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={l`Add a cover image`}
          accessibilityHint={l`Opens your photo library`}
          onPress={() => void onPick()}
          testID="eventImageAddBtn"
          style={[
            a.w_full,
            a.align_center,
            a.justify_center,
            a.gap_xs,
            a.rounded_md,
            a.border,
            t.atoms.bg_contrast_25,
            t.atoms.border_contrast_low,
            {aspectRatio: ASPECT_RATIO, borderStyle: 'dashed'},
          ]}>
          <ImageIcon size="xl" style={t.atoms.text_contrast_medium} />
          <Text
            style={[a.text_md, a.font_medium, t.atoms.text_contrast_medium]}>
            <Trans>Add a cover image</Trans>
          </Text>
        </Pressable>
      )}

      <EditImageDialog
        control={editImageDialogControl}
        image={rawImage}
        onChange={cropped => void onCropped(cropped)}
        aspectRatio={ASPECT_RATIO}
      />
    </>
  )
}
