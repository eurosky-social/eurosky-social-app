import {useState} from 'react'
import {Pressable, View} from 'react-native'
import {Image} from 'expo-image'
import {type AtUriString, type DidString} from '@atproto/syntax'
import {Trans, useLingui} from '@lingui/react/macro'
import {useInfiniteQuery, useQuery} from '@tanstack/react-query'
import chunk from 'lodash.chunk'

import {POST_TOMBSTONE, usePostShadow} from '#/state/cache/post-shadow'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {STALE} from '#/state/queries'
import {usePreferencesQuery} from '#/state/queries/preferences'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient, useSession} from '#/state/session'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {PlusSmall_Stroke2_Corner0_Rounded as Plus} from '#/components/icons/Plus'
import {Loader} from '#/components/Loader'
import {ContentHider} from '#/components/moderation/ContentHider'
import {Text} from '#/components/Typography'
import {app} from '#/lexicons'
import {articleLinkKey} from './articleLinks'
import {type EditorialArticle} from './articles'
import {referenceKind} from './curation'
import {
  type EditorialItem,
  feedItem,
  isResourceItem,
  pickerArticles,
  starterPackItem,
} from './items'
import {articleModeration} from './moderation'
import {resourceModeration} from './ResourceSlot'

type Kind = 'posts' | 'feeds' | 'starterPacks'
type Page = {
  posts?: app.bsky.feed.defs.FeedViewPost[]
  feeds?: app.bsky.feed.defs.GeneratorView[]
  starterPacks?: app.bsky.graph.defs.StarterPackViewBasic[]
  cursor?: string
}

export function InsertSlotButton({
  onPress,
  beside = false,
  inline = false,
  disabled = false,
}: {
  onPress: () => void
  beside?: boolean
  inline?: boolean
  disabled?: boolean
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  return (
    <View
      pointerEvents="box-none"
      style={
        inline
          ? [a.align_center, a.py_md]
          : [
              a.absolute,
              {zIndex: 11},
              beside
                ? {left: -39, top: '50%', marginTop: -14}
                : {left: '50%', top: -26, marginLeft: -14},
            ]
      }>
      <Button
        testID="insertFrontpageSlot"
        label={l`Add existing post, feed or starter pack here`}
        color="secondary"
        size="small"
        shape="round"
        disabled={disabled}
        onPress={onPress}
        style={[
          t.atoms.bg,
          a.border,
          t.atoms.border_contrast_low,
          {width: 28, height: 28},
        ]}>
        <ButtonIcon icon={Plus} />
      </Button>
    </View>
  )
}

export function SlotPicker({
  control,
  did,
  pinned,
  automatic,
  postsOnly = false,
  onSplit,
  onSelect,
}: {
  control: Dialog.DialogControlProps
  did: DidString
  /** Pinned on the page already, so not offered again. */
  pinned: EditorialItem[]
  /** On the page automatically; picking one pins it at the chosen place. */
  automatic: string[]
  /** For a carousel, which holds posts only. */
  postsOnly?: boolean
  /** Offered between two stories of a section: ends it there, the stories below moving into a new one. */
  onSplit?: () => void
  onSelect: (item: EditorialItem) => void
}) {
  return (
    <Dialog.Outer control={control} nativeOptions={{fullHeight: true}}>
      <Dialog.Handle />
      <SlotPickerInner
        control={control}
        did={did}
        pinned={pinned}
        automatic={automatic}
        postsOnly={postsOnly}
        onSplit={onSplit}
        onSelect={onSelect}
      />
    </Dialog.Outer>
  )
}

function SlotPickerInner({
  control,
  did,
  pinned: pinnedSlots,
  automatic,
  postsOnly = false,
  onSplit,
  onSelect,
}: Parameters<typeof SlotPicker>[0]) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [kind, setKind] = useState<Kind>('posts')
  const [filter, setFilter] = useState('')
  const opts = useModerationOpts()
  const client = useAppviewClient()
  const {currentAccount} = useSession()
  const preferences = usePreferencesQuery()
  const pinnedUris = (preferences.data?.savedFeeds ?? [])
    .filter(
      value =>
        value.pinned &&
        value.type === 'feed' &&
        referenceKind(value.value) === 'feed',
    )
    .map(value => value.value)
  const pinned = useQuery({
    queryKey: createQueryKey('editorialPinnedFeeds', {
      uris: pinnedUris,
      viewer: currentAccount?.did,
    }),
    staleTime: STALE.MINUTES.ONE,
    enabled:
      kind === 'feeds' && !!pinnedUris.length && currentAccount?.did === did,
    queryFn: async () =>
      (
        await Promise.all(
          chunk(pinnedUris, 25).map(uris =>
            client.call(app.bsky.feed.getFeedGenerators, {
              feeds: uris as AtUriString[],
            }),
          ),
        )
      ).flatMap(page => page.feeds),
  })
  const query = useInfiniteQuery({
    queryKey: createQueryKey('editorialSlotPicker', {
      did,
      kind,
      viewer: currentAccount?.did,
    }),
    initialPageParam: undefined as string | undefined,
    staleTime: STALE.MINUTES.ONE,
    enabled: !!opts,
    async queryFn({pageParam}): Promise<Page> {
      if (kind === 'posts') {
        const result = await client.call(app.bsky.feed.getAuthorFeed, {
          actor: did,
          filter: 'posts_no_replies',
          limit: 30,
          cursor: pageParam,
        })
        return {posts: result.feed, cursor: result.cursor}
      }
      if (kind === 'feeds') {
        const result = await client.call(app.bsky.feed.getActorFeeds, {
          actor: did,
          limit: 30,
          cursor: pageParam,
        })
        return {feeds: result.feeds, cursor: result.cursor}
      }
      const result = await client.call(app.bsky.graph.getActorStarterPacks, {
        actor: did,
        limit: 30,
        cursor: pageParam,
      })
      return {starterPacks: result.starterPacks, cursor: result.cursor}
    },
    getNextPageParam: page => page.cursor,
  })
  const candidates: EditorialItem[] = opts
    ? [
        ...(kind === 'feeds' ? (pinned.data ?? []) : []).map(feedItem),
        ...(query.data?.pages ?? []).flatMap(page => [
          ...pickerArticles(page.posts ?? [], did, opts),
          ...(page.feeds ?? [])
            .filter(feed => feed.creator.did === did)
            .map(feedItem),
          ...(page.starterPacks ?? [])
            .filter(pack => pack.creator.did === did)
            .flatMap(pack => {
              const value = starterPackItem(pack)
              return value ? [value] : []
            }),
        ]),
      ]
    : []
  const seen = new Set<string>()
  const needle = filter.trim().toLocaleLowerCase()
  const matches = candidates.filter(item => {
    if (seen.has(item.item.uri)) return false
    seen.add(item.item.uri)
    return (
      !needle ||
      `${item.title} ${!isResourceItem(item) ? item.description : (item.feed?.description ?? '')}`
        .toLocaleLowerCase()
        .includes(needle)
    )
  })
  const labels: Record<Kind, string> = {
    posts: l`Posts`,
    feeds: l`Feeds`,
    starterPacks: l`Starter packs`,
  }
  return (
    <Dialog.ScrollableInner
      label={l`Add to front page`}
      style={web({maxWidth: 560})}>
      <View testID="frontpageSlotPicker" style={[a.gap_md]}>
        <Text style={[a.text_2xl, a.font_bold]}>
          <Trans>Add to front page</Trans>
        </Text>
        {onSplit && (
          <View
            style={[
              a.flex_row,
              a.flex_wrap,
              a.align_center,
              a.justify_between,
              a.gap_md,
              a.p_md,
              a.rounded_md,
              t.atoms.bg_contrast_25,
            ]}>
            <Text
              style={[
                a.flex_1,
                a.text_sm,
                t.atoms.text_contrast_medium,
                {minWidth: 180},
              ]}>
              <Trans>
                Or end the section here: the stories below move into a new
                section.
              </Trans>
            </Text>
            <Button
              testID="splitFrontpageSection"
              label={l`Split into a new section here`}
              size="small"
              color="secondary"
              onPress={() => control.close(onSplit)}>
              <ButtonText>
                <Trans>Split into new section</Trans>
              </ButtonText>
            </Button>
          </View>
        )}
        <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
          {(postsOnly
            ? (['posts'] as const)
            : (['posts', 'feeds', 'starterPacks'] as const)
          ).map(value => (
            <Button
              key={value}
              label={labels[value]}
              size="small"
              color={kind === value ? 'primary' : 'secondary'}
              accessibilityState={{selected: kind === value}}
              onPress={() => {
                setKind(value)
                setFilter('')
              }}>
              <ButtonText>{labels[value]}</ButtonText>
            </Button>
          ))}
        </View>
        <TextField.Root>
          <Dialog.Input
            testID="filterFrontpageSlots"
            label={l`Filter loaded items`}
            placeholder={l`Filter loaded items`}
            value={filter}
            onChangeText={setFilter}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </TextField.Root>
        {query.isPending ? (
          <Loader size="lg" />
        ) : (
          <View>
            {matches.map(item => (
              <PickerRow
                key={item.item.uri}
                item={item}
                pinned={
                  isResourceItem(item) &&
                  item.kind === 'feed' &&
                  pinnedUris.includes(item.item.uri)
                }
                automatic={automatic.includes(item.item.uri)}
                included={pinnedSlots.some(
                  value =>
                    value.item.uri === item.item.uri ||
                    (!!item.url &&
                      !!value.url &&
                      articleLinkKey(value.url) === articleLinkKey(item.url)),
                )}
                onSelect={() => control.close(() => onSelect(item))}
              />
            ))}
            {!matches.length && !query.isError && (
              <Text style={[a.py_xl, t.atoms.text_contrast_medium]}>
                {needle
                  ? l`No matches in the loaded items.`
                  : l`No items found.`}
              </Text>
            )}
          </View>
        )}
        {kind === 'feeds' && pinned.isFetching && <Loader size="sm" />}
        {kind === 'feeds' && (preferences.isError || pinned.isError) && (
          <Button
            label={l`Retry loading pinned feeds`}
            size="small"
            color="secondary"
            onPress={() =>
              void Promise.all([preferences.refetch(), pinned.refetch()])
            }>
            <ButtonText>
              <Trans>Retry loading pinned feeds</Trans>
            </ButtonText>
          </Button>
        )}
        {query.isError && (
          <Text accessibilityRole="alert">
            <Trans>Couldn’t load items. Try again.</Trans>
          </Text>
        )}
        {(query.hasNextPage || query.isError) && (
          <Button
            label={query.isError ? l`Try again` : l`Load older items`}
            size="small"
            color="secondary"
            disabled={query.isFetching}
            onPress={() =>
              void (query.isError ? query.refetch() : query.fetchNextPage())
            }>
            <ButtonText>
              {query.isFetching
                ? l`Loading…`
                : query.isError
                  ? l`Try again`
                  : l`Load older items`}
            </ButtonText>
          </Button>
        )}
      </View>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}

function PickerRow({
  item,
  included,
  automatic,
  pinned,
  onSelect,
}: {
  item: EditorialItem
  included: boolean
  automatic: boolean
  pinned: boolean
  onSelect: () => void
}) {
  const opts = useModerationOpts()
  if (!isResourceItem(item))
    return (
      <PostPickerRow
        item={item}
        included={included}
        automatic={automatic}
        onSelect={onSelect}
      />
    )
  const modui = opts ? resourceModeration(item, opts) : undefined
  if (modui?.filter) return null
  return (
    <ContentHider modui={modui}>
      <PickerRowBody
        title={item.title}
        image={item.feed?.avatar}
        pinned={pinned}
        included={included}
        onSelect={onSelect}
      />
    </ContentHider>
  )
}

function PostPickerRow({
  item,
  included,
  automatic,
  onSelect,
}: {
  item: EditorialArticle
  included: boolean
  automatic: boolean
  onSelect: () => void
}) {
  const opts = useModerationOpts()
  const post = usePostShadow(item.item.post)
  const modui = articleModeration(item, opts)
  if (post === POST_TOMBSTONE || modui.filter) return null
  return (
    <ContentHider modui={modui}>
      <PickerRowBody
        title={item.title}
        image={item.image}
        included={included}
        automatic={automatic}
        onSelect={onSelect}
      />
    </ContentHider>
  )
}

function PickerRowBody({
  title,
  image,
  included,
  automatic = false,
  pinned = false,
  onSelect,
}: {
  title: string
  image?: string
  pinned?: boolean
  included: boolean
  /** On the page automatically: it can be picked, to pin it here. */
  automatic?: boolean
  onSelect: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <Pressable
      testID="frontpagePickerItem"
      accessibilityRole="button"
      accessibilityLabel={
        included
          ? l`${title}, already pinned on the front page`
          : automatic
            ? l`Pin ${title} here`
            : l`Add ${title}`
      }
      accessibilityHint={
        included
          ? undefined
          : automatic
            ? l`Pins this automatic story at the selected position`
            : l`Inserts this item at the selected position`
      }
      disabled={included}
      onPress={onSelect}
      style={({pressed}) => [
        a.flex_row,
        a.align_center,
        a.gap_md,
        a.py_md,
        a.border_b,
        t.atoms.border_contrast_low,
        pressed && t.atoms.bg_contrast_25,
        included && {opacity: 0.5},
      ]}>
      {!!image && (
        <Image
          source={{uri: image}}
          accessibilityIgnoresInvertColors
          style={{width: 64, height: 48}}
          contentFit="cover"
        />
      )}
      <View style={[a.flex_1, a.gap_xs]}>
        <Text emoji style={[a.font_semi_bold]} numberOfLines={2}>
          {title}
        </Text>
        {(included || automatic || pinned) && (
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            {included ? (
              <Trans>Pinned on the front page</Trans>
            ) : automatic ? (
              <Trans>Automatic on the front page – pick to pin it here</Trans>
            ) : (
              <Trans comment="A feed the user has pinned in their own feeds">
                Pinned
              </Trans>
            )}
          </Text>
        )}
      </View>
    </Pressable>
  )
}
