import {View} from 'react-native'
import {Image} from 'expo-image'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Download_Stroke2_Corner0_Rounded as InstallIcon} from '#/components/icons/Download'
import {PaperPlane_Stroke2_Corner0_Rounded as PostIcon} from '#/components/icons/PaperPlane'
import {Play_Filled_Corner0_Rounded as OpenIcon} from '#/components/icons/Play'
import {Trash_Stroke2_Corner0_Rounded as UninstallIcon} from '#/components/icons/Trash'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {usePostTile, useTileInstallToggle} from '../actions'
import {useTileAuthor} from '../author'
import {parseTileUri} from '../detect'
import {useTileRecordQuery} from '../installs'
import {tileScreenshotUrl} from '../manifest'
import {TileAuthorRow} from './TileAuthor'
import {TileIcon} from './TileIcon'

/**
 * Everything about a tile that the grid of apps has no room for: its icon
 * and name, a screenshot, the whole description, and who made it, with the
 * buttons to open it, to post it as a post's embed, and to install or
 * uninstall it: icons alone, each named for a screen reader. Opened from the info button of an installed tile, and from
 * the tile's own page.
 */
export function TileInfoDialog({
  control,
  uri,
  canOpen = true,
}: {
  control: Dialog.DialogOuterProps['control']
  /** The tile's at-URI. */
  uri: string
  /** Whether to offer to open the tile; not on the page it is already open on. */
  canOpen?: boolean
}) {
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <TileInfo uri={uri} canOpen={canOpen} />
    </Dialog.Outer>
  )
}

function TileInfo({uri, canOpen}: {uri: string; canOpen: boolean}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const navigation = useNavigation<NavigationProp>()
  const {data: record, isLoading, isError} = useTileRecordQuery(uri)
  const author = useTileAuthor(uri)
  const {installed, pending, toggle} = useTileInstallToggle(uri)
  const postTile = usePostTile()
  const parsed = parseTileUri(uri)
  const manifest = record?.manifest
  const name = manifest?.name || manifest?.short_name || l`Tile`
  const screenshot = record
    ? tileScreenshotUrl(record.manifest, record.pds, record.did)
    : undefined

  const onOpen = () => {
    if (!parsed) return
    control.close(() => {
      navigation.navigate('TileApp', {
        name: author?.profile.handle ?? parsed.repo,
        rkey: parsed.rkey,
      })
    })
  }

  const onPost = () => {
    control.close(() => void postTile(record?.ref.uri ?? uri))
  }

  return (
    <Dialog.ScrollableInner
      label={l`About ${name}`}
      style={web({maxWidth: 500})}>
      <View style={[a.gap_lg, a.w_full]}>
        <View style={[a.flex_row, a.align_center, a.gap_md]}>
          <TileIcon
            record={record}
            author={author}
            loading={isLoading}
            size={56}
          />
          <View style={[a.flex_1]}>
            <Text emoji style={[a.text_2xl, a.font_bold, a.leading_snug]}>
              {name}
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View style={[a.py_xl, a.align_center]}>
            <Loader size="lg" />
          </View>
        ) : isError || !record ? (
          <Text
            style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
            <Trans>
              This tile can't be found any more. Its author may have removed it.
            </Trans>
          </Text>
        ) : (
          <>
            {screenshot && (
              <Image
                source={{uri: screenshot}}
                style={[
                  a.w_full,
                  a.aspect_card,
                  a.rounded_md,
                  a.border,
                  t.atoms.border_contrast_low,
                  t.atoms.bg_contrast_25,
                ]}
                contentFit="contain"
                accessibilityIgnoresInvertColors
                accessibilityLabel={l`Screenshot of ${name}`}
                accessibilityHint=""
              />
            )}
            {manifest?.description ? (
              <Text emoji selectable style={[a.text_md, a.leading_snug]}>
                {manifest.description}
              </Text>
            ) : null}
          </>
        )}

        {author && (
          <View style={[a.flex_row]}>
            <TileAuthorRow author={author} onPress={() => control.close()} />
          </View>
        )}

        <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
          {canOpen && record && (
            <Button
              label={l`Open ${name}`}
              size="large"
              shape="round"
              color="primary"
              onPress={onOpen}>
              <ButtonIcon icon={OpenIcon} />
            </Button>
          )}
          {record && (
            <Button
              label={l`Post ${name}`}
              size="large"
              shape="round"
              color="secondary"
              onPress={onPost}>
              <ButtonIcon icon={PostIcon} />
            </Button>
          )}
          {installed !== undefined && (installed || record) && (
            <Button
              label={installed ? l`Uninstall ${name}` : l`Install ${name}`}
              size="large"
              shape="round"
              color={installed ? 'negative_subtle' : 'secondary'}
              disabled={pending}
              onPress={toggle}>
              <ButtonIcon icon={installed ? UninstallIcon : InstallIcon} />
            </Button>
          )}
        </View>
      </View>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}
