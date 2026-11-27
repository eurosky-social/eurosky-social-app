import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useQuery, useQueryClient} from '@tanstack/react-query'

import {useSetTitle} from '#/lib/hooks/useSetTitle'
import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {logger} from '#/logger'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Download_Stroke2_Corner0_Rounded as InstallIcon} from '#/components/icons/Download'
import {PaperPlane_Stroke2_Corner0_Rounded as PostIcon} from '#/components/icons/PaperPlane'
import {Trash_Stroke2_Corner0_Rounded as UninstallIcon} from '#/components/icons/Trash'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {usePostTile, useTileInstallToggle} from '../actions'
import {fetchIsTrustedTile, useTileAuthor} from '../author'
import {TileAuthorRow} from '../components/TileAuthor'
import {TileRunner} from '../components/TileRunner'
import {useTileRecordQuery} from '../installs'
import {tileUriFromAppRoute} from '../links'
import {useTilesPolicy} from '../policy'
import {type TileRecord} from '../resolve'

/** The author row's height: its 42px avatar and the padding around it. */
const AUTHOR_HEIGHT = 42 + 2 * a.py_md.paddingTop

/**
 * A tile running by itself, at `/<author>/app/<rkey>`: where an installed
 * tile opens from the Apps tab. There is no post here, but the page is laid
 * out like one: the tile's author above it, where a post's would be, and
 * under it, where a post has its controls, two buttons, icons alone, to
 * write a post that embeds the tile and to install or uninstall it. The page can be
 * reached for any tile, installed or not.
 *
 * The same rules decide whether the tile runs as in a post: not while tiles
 * are paused, and only if its author is one of our verified accounts, which
 * is checked afresh every time the page is opened.
 */
export function TileAppScreen({
  route,
}: NativeStackScreenProps<CommonNavigatorParams, 'TileApp'>) {
  const {t: l} = useLingui()
  const {name, rkey} = route.params
  const uri = tileUriFromAppRoute(name, rkey)
  const {data: record, isLoading, isError} = useTileRecordQuery(uri)
  const title = record?.manifest.name || record?.manifest.short_name || l`Tile`
  useSetTitle(record ? title : undefined)

  return (
    <Layout.Screen testID="tileAppScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>{title}</Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        {isLoading ? (
          <View style={[a.p_2xl, a.align_center]}>
            <Loader size="lg" />
          </View>
        ) : isError || !record ? (
          <Notice>
            <NoticeText>
              <Trans>
                This tile can't be found. Its author may have removed it.
              </Trans>
            </NoticeText>
          </Notice>
        ) : (
          <TileApp key={record.ref.uri} record={record} title={title} />
        )}
      </Layout.Content>
    </Layout.Screen>
  )
}

function TileApp({record, title}: {record: TileRecord; title: string}) {
  const {t: l} = useLingui()
  const appviewClient = useAppviewClient()
  const queryClient = useQueryClient()
  const policy = useTilesPolicy()
  const uri = record.ref.uri
  const author = useTileAuthor(record.ref)
  const {installed, pending, toggle} = useTileInstallToggle(record.ref)
  const postTile = usePostTile()
  const [error, setError] = useState(false)
  // Bumped by "Try again", so the runner mounts afresh.
  const [attempt, setAttempt] = useState(0)

  /*
   * Whether the author is verified is asked every time the page is opened,
   * like the click on a tile post's card does, before anything of the tile
   * is loaded. A cached verdict from an earlier visit lets nothing run.
   */
  const trust = useQuery({
    queryKey: createQueryKey('tile-may-run', {uri}),
    queryFn: () => fetchIsTrustedTile(queryClient, appviewClient, uri),
    staleTime: 0,
  })
  const trusted = trust.isFetchedAfterMount ? trust.data : undefined

  const onError = (message: string) => {
    logger.warn('tiles: could not load tile', {safeMessage: message, uri})
    setError(true)
  }

  return (
    <View>
      {/*
       * Above the tile, where a post names its author. The row keeps its
       * height while the profile loads, so the tile does not jump.
       */}
      <View style={[a.flex_row, a.px_lg, a.py_md, {minHeight: AUTHOR_HEIGHT}]}>
        {author && <TileAuthorRow author={author} />}
      </View>
      {!policy.enabled ? (
        <Notice>
          <NoticeText>
            {policy.message ? (
              <Trans>Tiles are paused for now: {policy.message}</Trans>
            ) : (
              <Trans>Tiles are paused for now.</Trans>
            )}
          </NoticeText>
        </Notice>
      ) : trusted === undefined ? (
        <View style={[a.p_2xl, a.align_center]}>
          <Loader size="lg" />
        </View>
      ) : !trusted ? (
        <Notice>
          <NoticeText>
            <Trans>
              This tile can't be played here: its author isn't verified.
            </Trans>
          </NoticeText>
        </Notice>
      ) : error ? (
        <Notice
          action={
            <Button
              label={l`Try again`}
              size="small"
              color="secondary"
              onPress={() => {
                setError(false)
                setAttempt(n => n + 1)
              }}>
              <ButtonText>
                <Trans>Try again</Trans>
              </ButtonText>
            </Button>
          }>
          <NoticeText>
            <Trans>Could not load this tile.</Trans>
          </NoticeText>
        </Notice>
      ) : (
        <TileRunner
          key={`${uri}#${attempt}`}
          uri={uri}
          title={title}
          onError={onError}
        />
      )}

      {/* Under the tile, where a post has its controls. */}
      <View style={[a.flex_row, a.justify_end, a.gap_sm, a.px_lg, a.py_md]}>
        <Button
          label={l`Post ${title}`}
          size="large"
          shape="round"
          color="secondary"
          onPress={() => void postTile(uri)}>
          <ButtonIcon icon={PostIcon} />
        </Button>
        <Button
          testID="tileAppInstallBtn"
          label={installed ? l`Uninstall ${title}` : l`Install ${title}`}
          size="large"
          shape="round"
          color={installed ? 'negative_subtle' : 'primary'}
          disabled={pending}
          onPress={toggle}>
          <ButtonIcon icon={installed ? UninstallIcon : InstallIcon} />
        </Button>
      </View>
    </View>
  )
}

/** A message where the tile would be, with room for a button under it. */
function Notice({
  children,
  action,
}: {
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <View style={[a.px_2xl, a.py_5xl, a.align_center, a.gap_md]}>
      {children}
      {action}
    </View>
  )
}

function NoticeText({children}: {children: React.ReactNode}) {
  const t = useTheme()
  return (
    <Text
      style={[
        a.text_md,
        a.leading_snug,
        a.text_center,
        t.atoms.text_contrast_medium,
      ]}>
      {children}
    </Text>
  )
}
