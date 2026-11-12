import {useState} from 'react'
import {View} from 'react-native'
import {type AtUriString, type DidString} from '@atproto/syntax'
import {moderateFeedGenerator} from '@bsky/sdk/moderation'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useQuery} from '@tanstack/react-query'
import chunk from 'lodash.chunk'

import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {STALE} from '#/state/queries'
import {usePreferencesQuery} from '#/state/queries/preferences'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient, useSession} from '#/state/session'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as FeedCard from '#/components/FeedCard'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {ListSparkle_Stroke2_Corner0_Rounded as FeedsIcon} from '#/components/icons/ListSparkle'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {app} from '#/lexicons'
import {
  type FeaturedFeeds,
  MAX_FEATURED_FEEDS,
  MAX_SECTION_TITLE,
  referenceKind,
} from './curation'
import {type FeaturedItem} from './items'
import {StepHeading} from './StepHeading'

export type FeaturedValue = {title?: string; feeds: string[]}

/**
 * A card of several feeds in one slot: a heading, then each feed with its
 * avatar, name, creator and the usual pin button, opening the feed. Feeds the
 * reader's moderation hides are left out.
 */
export function FeaturedFeedsSlot({
  item,
  controls,
}: {
  item: FeaturedItem
  controls?: React.ReactNode
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const client = useAppviewClient()
  const {currentAccount} = useSession()
  const opts = useModerationOpts()
  const uris = item.featured.feeds
  const query = useQuery({
    queryKey: createQueryKey('editorialFeaturedFeeds', {
      uris,
      viewer: currentAccount?.did,
    }),
    staleTime: STALE.MINUTES.FIVE,
    queryFn: async () =>
      (
        await client.call(app.bsky.feed.getFeedGenerators, {
          feeds: uris as AtUriString[],
        })
      ).feeds,
  })
  const feeds = uris.flatMap(uri => {
    const view = query.data?.find(feed => feed.uri === uri)
    if (!view) return []
    if (opts && moderateFeedGenerator(view, opts).ui('contentList').filter)
      return []
    return [view]
  })
  return (
    <View
      testID="editorialFeaturedFeeds"
      style={[a.relative, a.gap_md, !!controls && {paddingTop: 56}]}>
      {controls}
      <View
        style={[
          a.flex_row,
          a.align_center,
          a.gap_sm,
          a.pb_sm,
          {borderBottomWidth: 3, borderColor: t.atoms.text.color},
        ]}>
        <FeedsIcon size="md" fill={t.atoms.text.color} />
        <Text
          emoji
          accessibilityRole="header"
          numberOfLines={2}
          style={[
            a.flex_1,
            a.text_xl,
            a.font_bold,
            t.atoms.text,
            {letterSpacing: -0.5},
          ]}>
          {item.featured.title ?? l`Featured feeds`}
        </Text>
      </View>
      {query.isPending ? (
        <View style={[a.gap_md]}>
          {uris.map(uri => (
            <FeedCard.Header key={uri}>
              <FeedCard.AvatarPlaceholder />
              <FeedCard.TitleAndBylinePlaceholder creator />
            </FeedCard.Header>
          ))}
        </View>
      ) : query.isError ? (
        <View style={[a.gap_sm, a.align_start]}>
          <Text>
            <Trans>Couldn’t load these feeds.</Trans>
          </Text>
          <Button
            label={l`Try again`}
            size="small"
            color="secondary"
            onPress={() => void query.refetch()}>
            <ButtonText>
              <Trans>Try again</Trans>
            </ButtonText>
          </Button>
        </View>
      ) : feeds.length ? (
        <View style={[a.gap_md]}>
          {feeds.map(view => (
            <FeedCard.Link key={view.uri} view={view}>
              <FeedCard.Outer>
                <FeedCard.Header>
                  <FeedCard.Avatar src={view.avatar} />
                  <FeedCard.TitleAndByline
                    title={view.displayName}
                    creator={view.creator}
                    uri={view.uri}
                  />
                  <FeedCard.SaveButton view={view} pin />
                </FeedCard.Header>
              </FeedCard.Outer>
            </FeedCard.Link>
          ))}
        </View>
      ) : (
        <Text style={[t.atoms.text_contrast_medium]}>
          <Trans>None of these feeds is available.</Trans>
        </Text>
      )}
    </View>
  )
}

/**
 * The step of the add dialog that chooses the feeds of a featured-feeds card,
 * and its title: the editor's pinned feeds and the account's own feeds, plus
 * whatever the card holds already.
 */
export function FeaturedFeedsForm({
  control,
  did,
  initial,
  onBack,
  onSave,
}: {
  control: Dialog.DialogControlProps
  did: DidString
  /** The card being edited; a new card when unset. */
  initial?: FeaturedFeeds
  /** Returns to choosing what fills the slot. */
  onBack?: () => void
  onSave: (value: FeaturedValue) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const client = useAppviewClient()
  const {currentAccount} = useSession()
  const opts = useModerationOpts()
  const preferences = usePreferencesQuery()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [selected, setSelected] = useState<string[]>(initial?.feeds ?? [])
  const [filter, setFilter] = useState('')
  const pinnedUris = (preferences.data?.savedFeeds ?? [])
    .filter(
      feed =>
        feed.pinned &&
        feed.type === 'feed' &&
        referenceKind(feed.value) === 'feed',
    )
    .map(feed => feed.value)
  const known = [...new Set([...pinnedUris, ...(initial?.feeds ?? [])])]
  const candidates = useQuery({
    queryKey: createQueryKey('editorialFeaturedCandidates', {
      did,
      known,
      viewer: currentAccount?.did,
    }),
    staleTime: STALE.MINUTES.ONE,
    async queryFn() {
      const [resolved, own] = await Promise.all([
        Promise.all(
          chunk(known, 25).map(uris =>
            client.call(app.bsky.feed.getFeedGenerators, {
              feeds: uris as AtUriString[],
            }),
          ),
        ),
        client.call(app.bsky.feed.getActorFeeds, {actor: did, limit: 50}),
      ])
      const seen = new Set<string>()
      return [...resolved.flatMap(page => page.feeds), ...own.feeds].filter(
        feed => !seen.has(feed.uri) && !!seen.add(feed.uri),
      )
    },
  })
  const needle = filter.trim().toLocaleLowerCase()
  const feeds = (candidates.data ?? []).filter(
    feed =>
      !(opts && moderateFeedGenerator(feed, opts).ui('contentList').filter) &&
      (!needle ||
        `${feed.displayName} ${feed.description ?? ''} ${feed.creator.handle}`
          .toLocaleLowerCase()
          .includes(needle)),
  )
  const heading = initial ? l`Edit featured feeds` : l`Feature feeds`
  const count = plural(selected.length, {
    one: '# feed selected',
    other: '# feeds selected',
  })
  function submit() {
    if (!selected.length) return
    control.close(() =>
      onSave({title: title.trim() || undefined, feeds: selected}),
    )
  }
  return (
    <Dialog.ScrollableInner label={heading} style={web({maxWidth: 560})}>
      <View testID="featuredFeedsForm" style={[a.gap_md]}>
        <StepHeading title={heading} kind={l`Featured feeds`} onBack={onBack} />
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>
            One card shows the feeds you choose here, in this order, with a pin
            button for readers.
          </Trans>
        </Text>
        <View>
          <TextField.LabelText>
            <Trans>Title (optional)</Trans>
          </TextField.LabelText>
          <TextField.Root>
            <Dialog.Input
              testID="featuredFeedsTitle"
              label={l`Card title`}
              placeholder={l`Featured feeds`}
              value={title}
              onChangeText={setTitle}
              maxLength={MAX_SECTION_TITLE}
            />
          </TextField.Root>
        </View>
        <TextField.Root>
          <Dialog.Input
            testID="filterFeaturedFeeds"
            label={l`Filter feeds`}
            placeholder={l`Filter feeds`}
            value={filter}
            onChangeText={setFilter}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </TextField.Root>
        <Text
          style={[a.text_xs, a.font_semi_bold, t.atoms.text_contrast_medium]}>
          {l`${count} – up to ${MAX_FEATURED_FEEDS}`}
        </Text>
        {candidates.isPending ? (
          <Loader size="lg" />
        ) : candidates.isError ? (
          <View style={[a.gap_sm, a.align_start]}>
            <Text accessibilityRole="alert">
              <Trans>Couldn’t load feeds. Try again.</Trans>
            </Text>
            <Button
              label={l`Try again`}
              size="small"
              color="secondary"
              onPress={() => void candidates.refetch()}>
              <ButtonText>
                <Trans>Try again</Trans>
              </ButtonText>
            </Button>
          </View>
        ) : feeds.length ? (
          <Toggle.Group
            label={l`Feeds to feature`}
            type="checkbox"
            values={selected}
            maxSelections={MAX_FEATURED_FEEDS}
            onChange={values =>
              /* Keep the order they were chosen in, which is the card's order. */
              setSelected([
                ...selected.filter(uri => values.includes(uri)),
                ...values.filter(uri => !selected.includes(uri)),
              ])
            }>
            <View>
              {feeds.map(feed => (
                <Toggle.Item
                  key={feed.uri}
                  testID="featuredFeedOption"
                  name={feed.uri}
                  label={feed.displayName}
                  style={[
                    a.flex_row,
                    a.align_center,
                    a.gap_md,
                    a.py_md,
                    a.border_b,
                    t.atoms.border_contrast_low,
                  ]}>
                  <Toggle.Checkbox />
                  <FeedCard.Avatar src={feed.avatar} size={32} />
                  <FeedCard.TitleAndByline
                    title={feed.displayName}
                    creator={feed.creator}
                  />
                </Toggle.Item>
              ))}
            </View>
          </Toggle.Group>
        ) : (
          <Text style={[a.py_xl, t.atoms.text_contrast_medium]}>
            {needle ? (
              <Trans>No feeds match.</Trans>
            ) : (
              <Trans>
                No feeds to choose from yet. Pin feeds in the app, or create
                one, and they appear here.
              </Trans>
            )}
          </Text>
        )}
        <Button
          testID="saveFeaturedFeeds"
          label={initial ? l`Save card` : l`Add card`}
          color="primary"
          size="large"
          disabled={!selected.length}
          onPress={submit}>
          <ButtonText>
            {initial ? <Trans>Save card</Trans> : <Trans>Add card</Trans>}
          </ButtonText>
        </Button>
      </View>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}
