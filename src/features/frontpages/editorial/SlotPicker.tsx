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
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronIcon} from '#/components/icons/Chevron'
import {Hashtag_Stroke2_Corner0_Rounded as FeedIcon} from '#/components/icons/Hashtag'
import {ListSparkle_Stroke2_Corner0_Rounded as FeedsIcon} from '#/components/icons/ListSparkle'
import {Newspaper_Stroke2_Corner2_Rounded as PostIcon} from '#/components/icons/Newspaper'
import {PlusSmall_Stroke2_Corner0_Rounded as Plus} from '#/components/icons/Plus'
import {StarterPack_Stroke2_Corner0_Rounded as StarterPackIcon} from '#/components/icons/StarterPack'
import {Loader} from '#/components/Loader'
import {ContentHider} from '#/components/moderation/ContentHider'
import {Text} from '#/components/Typography'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {articleLinkKey} from './articleLinks'
import {type EditorialArticle} from './articles'
import {type FeaturedFeeds, referenceKind} from './curation'
import {FeaturedFeedsForm, type FeaturedValue} from './FeaturedFeeds'
import {
  type EditorialItem,
  feedItem,
  isArticleItem,
  isResourceItem,
  pickerArticles,
  type ResourceItem,
  starterPackItem,
} from './items'
import {articleModeration} from './moderation'
import {resourceModeration} from './ResourceSlot'
import {StepHeading} from './StepHeading'

/**
 * Where the add dialog opens: at the choice of what fills the slot, or
 * straight at one component's own step, when the spot's button or the slot's
 * pencil already said which.
 */
export type SlotStep =
  'choose' | 'posts' | 'feeds' | 'starterPacks' | 'featured'

/** Where the post step looks for posts. */
type PostSource =
  | {type: 'own'}
  | {type: 'feed'; feed?: app.bsky.feed.defs.GeneratorView}
  | {type: 'starterPack'; pack?: bsky.starterPack.AnyStarterPackView}

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

/**
 * Adds something to a spot, in two steps: which component, then that
 * component's own picker. A post is one of the account's posts, or a post
 * found in a feed or a starter pack; a feed and a starter pack are shown as
 * cards of their own; featured feeds are several feeds in one card. Each step
 * has a way back to the choice, except when a carousel leaves only posts.
 */
export function SlotPicker({
  control,
  did,
  pinned,
  automatic,
  postsOnly = false,
  start,
  openKey,
  featured,
  onSplit,
  onSelect,
  onSaveFeatured,
}: {
  control: Dialog.DialogControlProps
  did: DidString
  /** Pinned on the page already, so not offered again. */
  pinned: EditorialItem[]
  /** On the page automatically; picking one pins it at the chosen place. */
  automatic: string[]
  /** For a carousel, which holds posts only. */
  postsOnly?: boolean
  /** The step the dialog opens at. */
  start: SlotStep
  /** Changes with every opening, so the dialog starts over. */
  openKey: number
  /** The featured-feeds card being edited in place. */
  featured?: FeaturedFeeds
  /** Offered between two stories of a section: ends it there, the stories below moving into a new one. */
  onSplit?: () => void
  onSelect: (item: EditorialItem) => void
  onSaveFeatured: (value: FeaturedValue) => void
}) {
  return (
    <Dialog.Outer control={control} nativeOptions={{fullHeight: true}}>
      <Dialog.Handle />
      <SlotDialogSteps
        key={openKey}
        control={control}
        did={did}
        pinned={pinned}
        automatic={automatic}
        postsOnly={postsOnly}
        start={start}
        featured={featured}
        onSplit={onSplit}
        onSelect={onSelect}
        onSaveFeatured={onSaveFeatured}
      />
    </Dialog.Outer>
  )
}

function SlotDialogSteps({
  control,
  did,
  pinned,
  automatic,
  postsOnly = false,
  start,
  featured,
  onSplit,
  onSelect,
  onSaveFeatured,
}: Omit<Parameters<typeof SlotPicker>[0], 'openKey'>) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [step, setStep] = useState<SlotStep>(postsOnly ? 'posts' : start)
  const back = postsOnly ? undefined : () => setStep('choose')
  const select = (item: EditorialItem) => control.close(() => onSelect(item))
  if (step === 'featured')
    return (
      <FeaturedFeedsForm
        control={control}
        did={did}
        initial={featured}
        onBack={back}
        onSave={onSaveFeatured}
      />
    )
  if (step === 'posts')
    return (
      <PostPicker
        control={control}
        did={did}
        pinned={pinned}
        automatic={automatic}
        postsOnly={postsOnly}
        onBack={back}
        onSplit={postsOnly ? onSplit : undefined}
        onSelect={select}
      />
    )
  if (step === 'feeds' || step === 'starterPacks')
    return (
      <Dialog.ScrollableInner
        label={step === 'feeds' ? l`Add a feed` : l`Add a starter pack`}
        style={web({maxWidth: 560})}>
        <View testID="frontpageSlotPicker" style={[a.gap_md]}>
          <StepHeading
            title={step === 'feeds' ? l`Add a feed` : l`Add a starter pack`}
            kind={step === 'feeds' ? l`Feed` : l`Starter pack`}
            onBack={back}
          />
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            {step === 'feeds' ? (
              <Trans>
                The feed's card, with its two latest posts, goes in the spot.
              </Trans>
            ) : (
              <Trans>
                The starter pack's people, or its latest posts, go in the spot.
              </Trans>
            )}
          </Text>
          <ResourceList
            kind={step === 'feeds' ? 'feed' : 'starterPack'}
            did={did}
            pinned={pinned}
            onPick={select}
          />
        </View>
        <Dialog.Close />
      </Dialog.ScrollableInner>
    )
  return <ChooseKind control={control} onSplit={onSplit} onChoose={setStep} />
}

/** The first step: which component goes in the spot. */
function ChooseKind({
  control,
  onSplit,
  onChoose,
}: {
  control: Dialog.DialogControlProps
  onSplit?: () => void
  onChoose: (step: 'posts' | 'feeds' | 'starterPacks' | 'featured') => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const options = [
    {
      step: 'posts' as const,
      testID: 'chooseFrontpagePost',
      icon: PostIcon,
      title: l`Post`,
      description: l`One of your posts, or a post from a feed or a starter pack`,
    },
    {
      step: 'feeds' as const,
      testID: 'chooseFrontpageFeed',
      icon: FeedIcon,
      title: l`Feed`,
      description: l`A feed's card, with its latest posts`,
    },
    {
      step: 'starterPacks' as const,
      testID: 'chooseFrontpageStarterPack',
      icon: StarterPackIcon,
      title: l`Starter pack`,
      description: l`A starter pack's people, or its latest posts`,
    },
    {
      step: 'featured' as const,
      testID: 'chooseFrontpageFeaturedFeeds',
      icon: FeedsIcon,
      title: l`Featured feeds`,
      description: l`Several feeds together in one card`,
    },
  ]
  return (
    <Dialog.ScrollableInner
      label={l`Add to front page`}
      style={web({maxWidth: 560})}>
      <View testID="frontpageSlotKinds" style={[a.gap_md]}>
        <StepHeading title={l`Add to front page`} />
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>Choose how to fill this slot.</Trans>
        </Text>
        <View style={[a.gap_sm]}>
          {options.map(option => (
            <Pressable
              key={option.step}
              testID={option.testID}
              accessibilityRole="button"
              accessibilityLabel={option.title}
              accessibilityHint={option.description}
              onPress={() => onChoose(option.step)}
              style={({pressed}) => [
                a.flex_row,
                a.align_center,
                a.gap_md,
                a.p_md,
                a.rounded_md,
                a.border,
                t.atoms.border_contrast_low,
                pressed && t.atoms.bg_contrast_25,
              ]}>
              <option.icon size="lg" fill={t.atoms.text.color} />
              <View style={[a.flex_1, a.gap_2xs]}>
                <Text style={[a.text_md, a.font_semi_bold]}>
                  {option.title}
                </Text>
                <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                  {option.description}
                </Text>
              </View>
              <ChevronIcon
                size="sm"
                fill={t.atoms.text_contrast_medium.color}
              />
            </Pressable>
          ))}
        </View>
        {onSplit && <SplitRow control={control} onSplit={onSplit} />}
      </View>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}

/** Ends the section at the insertion point instead, the stories below moving into a new one. */
function SplitRow({
  control,
  onSplit,
}: {
  control: Dialog.DialogControlProps
  onSplit: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
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
          Or end the section here: the stories below move into a new section.
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
  )
}

/** The feeds the editor has pinned in the app, to offer among the feeds. */
function usePinnedFeedUris() {
  const preferences = usePreferencesQuery()
  return (preferences.data?.savedFeeds ?? [])
    .filter(
      value =>
        value.pinned &&
        value.type === 'feed' &&
        referenceKind(value.value) === 'feed',
    )
    .map(value => value.value)
}

/**
 * The feeds, or the starter packs, to pick from: for feeds, the editor's
 * pinned feeds and the account's own; for starter packs, the account's own.
 * Picking one adds it as a component, or chooses it as a place to find posts.
 */
function ResourceList({
  kind,
  did,
  pinned: pinnedSlots,
  choosing = false,
  onPick,
}: {
  kind: 'feed' | 'starterPack'
  did: DidString
  /** Pinned on the page already, so not offered again; empty when only choosing a source. */
  pinned: EditorialItem[]
  /** Picking one chooses it as a place to find posts, rather than adding it. */
  choosing?: boolean
  onPick: (item: ResourceItem) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [filter, setFilter] = useState('')
  const client = useAppviewClient()
  const {currentAccount} = useSession()
  const pinnedUris = usePinnedFeedUris()
  const pinnedFeeds = useQuery({
    queryKey: createQueryKey('editorialPinnedFeeds', {
      uris: pinnedUris,
      viewer: currentAccount?.did,
    }),
    staleTime: STALE.MINUTES.ONE,
    enabled: kind === 'feed' && !!pinnedUris.length,
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
    async queryFn({pageParam}): Promise<Page> {
      if (kind === 'feed') {
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
  const candidates: ResourceItem[] = [
    ...(kind === 'feed' ? (pinnedFeeds.data ?? []) : []).map(feedItem),
    ...(query.data?.pages ?? []).flatMap(page => [
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
  const seen = new Set<string>()
  const needle = filter.trim().toLocaleLowerCase()
  const matches = candidates.filter(item => {
    if (seen.has(item.item.uri)) return false
    seen.add(item.item.uri)
    return (
      !needle ||
      `${item.title} ${item.feed?.description ?? ''}`
        .toLocaleLowerCase()
        .includes(needle)
    )
  })
  return (
    <View style={[a.gap_md]}>
      <TextField.Root>
        <Dialog.Input
          testID="filterFrontpageSlots"
          label={kind === 'feed' ? l`Filter feeds` : l`Filter starter packs`}
          placeholder={
            kind === 'feed' ? l`Filter feeds` : l`Filter starter packs`
          }
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
                item.kind === 'feed' && pinnedUris.includes(item.item.uri)
              }
              automatic={false}
              included={pinnedSlots.some(
                value => value.item.uri === item.item.uri,
              )}
              choosing={choosing}
              onSelect={() => onPick(item)}
            />
          ))}
          {!matches.length && !query.isError && (
            <Text style={[a.py_xl, t.atoms.text_contrast_medium]}>
              {needle
                ? l`No matches in the loaded items.`
                : kind === 'feed'
                  ? l`No feeds yet. Pin feeds in the app, or create one.`
                  : l`No starter packs yet.`}
            </Text>
          )}
        </View>
      )}
      {kind === 'feed' && pinnedFeeds.isFetching && <Loader size="sm" />}
      {kind === 'feed' && pinnedFeeds.isError && (
        <Button
          label={l`Retry loading pinned feeds`}
          size="small"
          color="secondary"
          onPress={() => void pinnedFeeds.refetch()}>
          <ButtonText>
            <Trans>Retry loading pinned feeds</Trans>
          </ButtonText>
        </Button>
      )}
      <LoadMore query={query} />
    </View>
  )
}

/** The post step: the account's posts, or the posts of a feed or a starter pack it picks first. */
function PostPicker({
  control,
  did,
  pinned: pinnedSlots,
  automatic,
  postsOnly = false,
  onBack,
  onSplit,
  onSelect,
}: {
  control: Dialog.DialogControlProps
  did: DidString
  pinned: EditorialItem[]
  automatic: string[]
  postsOnly?: boolean
  onBack?: () => void
  onSplit?: () => void
  onSelect: (item: EditorialItem) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [source, setSource] = useState<PostSource>({type: 'own'})
  const labels: Record<PostSource['type'], string> = {
    own: l`Your posts`,
    feed: l`From a feed`,
    starterPack: l`From a starter pack`,
  }
  const list =
    source.type === 'feed'
      ? source.feed && {feed: source.feed.uri}
      : source.type === 'starterPack'
        ? source.pack &&
          bsky.matches(app.bsky.graph.starterpack, source.pack.record)
          ? {list: source.pack.record.list}
          : undefined
        : {author: did}
  const chosen =
    source.type === 'feed'
      ? source.feed?.displayName
      : source.type === 'starterPack' &&
          source.pack &&
          bsky.matches(app.bsky.graph.starterpack, source.pack.record)
        ? source.pack.record.name
        : undefined
  return (
    <Dialog.ScrollableInner label={l`Add a post`} style={web({maxWidth: 560})}>
      <View testID="frontpageSlotPicker" style={[a.gap_md]}>
        <StepHeading
          title={l`Add a post`}
          kind={postsOnly ? undefined : l`Post`}
          onBack={onBack}
        />
        {onSplit && <SplitRow control={control} onSplit={onSplit} />}
        <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
          {(['own', 'feed', 'starterPack'] as const).map(type => (
            <Button
              key={type}
              testID={`frontpagePostSource-${type}`}
              label={labels[type]}
              size="small"
              color={source.type === type ? 'primary' : 'secondary'}
              accessibilityState={{selected: source.type === type}}
              onPress={() => setSource({type})}>
              <ButtonText>{labels[type]}</ButtonText>
            </Button>
          ))}
        </View>
        {list ? (
          <>
            {!!chosen && (
              <View style={[a.flex_row, a.align_center, a.gap_sm]}>
                <Text style={[a.flex_1, a.text_sm, a.font_semi_bold]}>
                  {source.type === 'feed'
                    ? l`Posts from ${chosen}`
                    : l`Posts by the people in ${chosen}`}
                </Text>
                <Button
                  testID="changeFrontpagePostSource"
                  label={
                    source.type === 'feed'
                      ? l`Choose another feed`
                      : l`Choose another starter pack`
                  }
                  size="small"
                  color="secondary"
                  onPress={() => setSource({type: source.type})}>
                  <ButtonText>
                    <Trans>Change</Trans>
                  </ButtonText>
                </Button>
              </View>
            )}
            <PostList
              key={JSON.stringify(list)}
              did={did}
              source={list}
              pinned={pinnedSlots}
              automatic={automatic}
              onSelect={onSelect}
            />
          </>
        ) : (
          <>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              {source.type === 'feed' ? (
                <Trans>Choose a feed to find posts in.</Trans>
              ) : (
                <Trans>Choose a starter pack to find its people's posts.</Trans>
              )}
            </Text>
            <ResourceList
              kind={source.type === 'feed' ? 'feed' : 'starterPack'}
              did={did}
              pinned={[]}
              choosing
              onPick={item =>
                setSource(
                  item.kind === 'feed'
                    ? {type: 'feed', feed: item.feed}
                    : {type: 'starterPack', pack: item.starterPack},
                )
              }
            />
          </>
        )}
      </View>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}

/** Original posts from one place: the account's own, a feed's, or a starter pack's list. */
function PostList({
  did,
  source,
  pinned: pinnedSlots,
  automatic,
  onSelect,
}: {
  did: DidString
  source: {author: DidString} | {feed: string} | {list: string}
  pinned: EditorialItem[]
  automatic: string[]
  onSelect: (item: EditorialItem) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [filter, setFilter] = useState('')
  const opts = useModerationOpts()
  const client = useAppviewClient()
  const {currentAccount} = useSession()
  const query = useInfiniteQuery({
    queryKey: createQueryKey('editorialSlotPicker', {
      did,
      source,
      viewer: currentAccount?.did,
    }),
    initialPageParam: undefined as string | undefined,
    staleTime: STALE.MINUTES.ONE,
    enabled: !!opts,
    async queryFn({pageParam}): Promise<Page> {
      if ('author' in source) {
        const result = await client.call(app.bsky.feed.getAuthorFeed, {
          actor: source.author,
          filter: 'posts_no_replies',
          limit: 30,
          cursor: pageParam,
        })
        return {posts: result.feed, cursor: result.cursor}
      }
      if ('feed' in source) {
        const result = await client.call(app.bsky.feed.getFeed, {
          feed: source.feed as AtUriString,
          limit: 30,
          cursor: pageParam,
        })
        return {posts: result.feed, cursor: result.cursor}
      }
      const result = await client.call(app.bsky.feed.getListFeed, {
        list: source.list as AtUriString,
        limit: 30,
        cursor: pageParam,
      })
      return {posts: result.feed, cursor: result.cursor}
    },
    getNextPageParam: page => page.cursor,
  })
  const candidates = opts
    ? (query.data?.pages ?? []).flatMap(page =>
        pickerArticles(
          page.posts ?? [],
          'author' in source ? source.author : undefined,
          opts,
        ),
      )
    : []
  const seen = new Set<string>()
  const needle = filter.trim().toLocaleLowerCase()
  const matches = candidates.filter(item => {
    if (seen.has(item.item.uri)) return false
    seen.add(item.item.uri)
    return (
      !needle ||
      `${item.title} ${item.description}`.toLocaleLowerCase().includes(needle)
    )
  })
  return (
    <View style={[a.gap_md]}>
      <TextField.Root>
        <Dialog.Input
          testID="filterFrontpageSlots"
          label={l`Filter loaded posts`}
          placeholder={l`Filter loaded posts`}
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
              pinned={false}
              automatic={automatic.includes(item.item.uri)}
              included={pinnedSlots.some(
                value =>
                  value.item.uri === item.item.uri ||
                  (!!item.url &&
                    !!value.url &&
                    articleLinkKey(value.url) === articleLinkKey(item.url)),
              )}
              onSelect={() => onSelect(item)}
            />
          ))}
          {!matches.length && !query.isError && (
            <Text style={[a.py_xl, t.atoms.text_contrast_medium]}>
              {needle ? l`No matches in the loaded posts.` : l`No posts found.`}
            </Text>
          )}
        </View>
      )}
      <LoadMore query={query} />
    </View>
  )
}

/** Loads the next page of a picker's list, or retries it. */
function LoadMore({
  query,
}: {
  query: {
    isError: boolean
    isFetching: boolean
    hasNextPage: boolean
    refetch: () => unknown
    fetchNextPage: () => unknown
  }
}) {
  const {t: l} = useLingui()
  return (
    <>
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
    </>
  )
}

function PickerRow({
  item,
  included,
  automatic,
  pinned,
  choosing = false,
  onSelect,
}: {
  item: EditorialItem
  included: boolean
  automatic: boolean
  pinned: boolean
  /** Picking it chooses where to look for posts, rather than adding it. */
  choosing?: boolean
  onSelect: () => void
}) {
  const opts = useModerationOpts()
  if (isArticleItem(item))
    return (
      <PostPickerRow
        item={item}
        included={included}
        automatic={automatic}
        onSelect={onSelect}
      />
    )
  /* A featured-feeds card is made in its own dialog, never picked. */
  if (!isResourceItem(item)) return null
  const modui = opts ? resourceModeration(item, opts) : undefined
  if (modui?.filter) return null
  return (
    <ContentHider modui={modui}>
      <PickerRowBody
        title={item.title}
        image={item.feed?.avatar}
        pinned={pinned}
        included={included}
        choosing={choosing}
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
  choosing = false,
  onSelect,
}: {
  title: string
  image?: string
  pinned?: boolean
  included: boolean
  /** On the page automatically: it can be picked, to pin it here. */
  automatic?: boolean
  /** Picking it chooses where to look for posts, rather than adding it. */
  choosing?: boolean
  onSelect: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <Pressable
      testID="frontpagePickerItem"
      accessibilityRole="button"
      accessibilityLabel={
        choosing
          ? l`Choose ${title}`
          : included
            ? l`${title}, already pinned on the front page`
            : automatic
              ? l`Pin ${title} here`
              : l`Add ${title}`
      }
      accessibilityHint={
        choosing
          ? l`Shows its posts to pick from`
          : included
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
