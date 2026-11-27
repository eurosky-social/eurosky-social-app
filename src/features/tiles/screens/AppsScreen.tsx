import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Apps_Stroke2_Corner0_Rounded as AppsIcon} from '#/components/icons/Apps'
import {CircleInfo_Stroke2_Corner0_Rounded as InfoIcon} from '#/components/icons/CircleInfo'
import * as Layout from '#/components/Layout'
import {Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {useTileAuthor} from '../author'
import {TileIcon} from '../components/TileIcon'
import {TileInfoDialog} from '../components/TileInfoDialog'
import {parseTileUri} from '../detect'
import {
  installedTiles,
  type TileInstall,
  useTileInstallsQuery,
  useTileRecordQuery,
} from '../installs'
import {makeTileAppLink} from '../links'

const ICON_SIZE = 64
/** The width a cell's link and name get: the icon, and room either side for the name. */
const LABEL_WIDTH = ICON_SIZE + 24
/** How far the info button sits over the icon's top right corner. */
const BADGE_OVERLAP = 10

/**
 * The Apps tab: the tiles the account has installed, laid out like the apps
 * on a phone: a grid of icons, each with its name under it (the manifest's
 * `short_name` when it has one), the latest installed first. An icon opens
 * the tile on a page of its own (`TileAppScreen`); the little info button on
 * its top right corner opens the sheet with the rest of what there is to
 * know, and the buttons to uninstall the tile or to post it.
 */
export function AppsScreen(
  _props: NativeStackScreenProps<CommonNavigatorParams, 'Apps'>,
) {
  return (
    <Layout.Screen testID="appsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans context="screen title: the tiles the user has installed">
              Apps
            </Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <InstalledTiles />
      </Layout.Content>
    </Layout.Screen>
  )
}

function InstalledTiles() {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const {data, isLoading, isError, refetch} = useTileInstallsQuery()
  // Four across, like a phone's home screen; one more where there is room.
  const columns = gtMobile ? 5 : 4

  if (isLoading) {
    return (
      <View style={[a.p_2xl, a.align_center]}>
        <Loader size="lg" />
      </View>
    )
  }

  if (isError || !data) {
    return (
      <View style={[a.p_2xl, a.align_center, a.gap_md]}>
        <Text style={[a.text_md, a.text_center]}>
          <Trans>Your apps could not be loaded.</Trans>
        </Text>
        <Button
          label={l`Try again`}
          size="small"
          color="secondary"
          onPress={() => void refetch()}>
          <ButtonText>
            <Trans>Try again</Trans>
          </ButtonText>
        </Button>
      </View>
    )
  }

  const installs = installedTiles(data)

  if (installs.length === 0) {
    return (
      <View style={[a.px_2xl, a.py_5xl, a.align_center, a.gap_md]}>
        <AppsIcon size="3xl" style={t.atoms.text_contrast_low} />
        <Text style={[a.text_lg, a.font_semi_bold, a.text_center]}>
          <Trans>No apps yet</Trans>
        </Text>
        <Text
          style={[
            a.text_md,
            a.leading_snug,
            a.text_center,
            t.atoms.text_contrast_medium,
            {maxWidth: 360},
          ]}>
          <Trans>
            A tile is a small app that plays inside a post. When you come across
            one you want to keep, press the install button under the post and it
            will be here.
          </Trans>
        </Text>
      </View>
    )
  }

  return (
    <View style={[a.flex_row, a.flex_wrap, a.px_sm, a.py_xl]}>
      {installs.map(install => (
        <InstalledTile
          key={install.tile.uri}
          install={install}
          width={`${100 / columns}%`}
        />
      ))}
    </View>
  )
}

function InstalledTile({
  install,
  width,
}: {
  install: TileInstall
  width: `${number}%`
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogControl()
  const {
    data: record,
    isError,
    isLoading,
  } = useTileRecordQuery(install.tile.uri)
  const author = useTileAuthor(install.tile)
  // An install always names a tile by DID: `parseTileInstall` sees to it.
  const parsed = parseTileUri(install.tile.uri)!
  const manifest = record?.manifest
  const name = manifest?.short_name || manifest?.name || l`Tile`

  return (
    <View style={[a.align_center, a.py_md, {width}]}>
      <View style={[a.align_center, {width: LABEL_WIDTH, maxWidth: '100%'}]}>
        <Link
          to={makeTileAppLink(
            {did: parsed.repo, handle: author?.profile.handle},
            parsed.rkey,
          )}
          label={l`Open ${name}`}
          style={[a.w_full]}>
          {({hovered, pressed}) => (
            // A link lays its children out in a row; the column is in here.
            <View style={[a.w_full, a.align_center, a.gap_xs]}>
              <TileIcon
                record={record}
                author={author}
                loading={isLoading}
                size={ICON_SIZE}
                style={[
                  (hovered || pressed) && t.atoms.border_contrast_high,
                  isError && {opacity: 0.4},
                ]}
              />
              <Text
                emoji
                numberOfLines={1}
                style={[
                  a.text_xs,
                  a.leading_snug,
                  a.text_center,
                  isError && t.atoms.text_contrast_medium,
                ]}>
                {isError ? l`Unavailable` : name}
              </Text>
            </View>
          )}
        </Link>
        {/*
         * A sibling of the link, not inside it: it is a button of its own.
         * It sits on the icon's top right corner, the way a badge does, with
         * a ring in the page's colour to set it off from the icon under it.
         */}
        <Button
          label={l`About ${name}`}
          size="tiny"
          shape="round"
          color="secondary"
          onPress={() => control.open()}
          style={[
            a.absolute,
            a.border,
            {
              top: -BADGE_OVERLAP,
              right: (LABEL_WIDTH - ICON_SIZE) / 2 - BADGE_OVERLAP,
              borderWidth: 2,
              borderColor: t.atoms.bg.backgroundColor,
            },
          ]}>
          <ButtonIcon icon={InfoIcon} />
        </Button>
      </View>
      <TileInfoDialog control={control} uri={install.tile.uri} />
    </View>
  )
}
