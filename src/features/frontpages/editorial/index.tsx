import {useEffect, useState} from 'react'
import {View} from 'react-native'
import Animated, {useAnimatedStyle} from 'react-native-reanimated'
import {type AtUriString} from '@atproto/syntax'
import {moderateProfile, type ModerationOpts} from '@bsky/sdk/moderation'
import {Trans, useLingui} from '@lingui/react/macro'

import {HITSLOP_20} from '#/lib/constants'
import {useSetTitle} from '#/lib/hooks/useSetTitle'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useProfileShadow} from '#/state/cache/profile-shadow'
import {usePostFeedQuery} from '#/state/queries/post-feed'
import {useSession} from '#/state/session'
import {useShellLayout} from '#/state/shell/shell-layout'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as Layout from '#/components/Layout'
import {Link} from '#/components/Link'
import {ScreenHider} from '#/components/moderation/ScreenHider'
import * as ProfileCard from '#/components/ProfileCard'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {VerificationCheckButton} from '#/components/verification/VerificationCheckButton'
import {
  ExploreColumn,
  ExploreSpreadBorders,
  useExploreSpread,
} from '#/features/news/explore/components/ExploreColumn'
import {ExploreSkeleton} from '#/features/news/explore/components/ExploreSkeleton'
import {type app} from '#/lexicons'
import {Article} from './Article'
import {ArticleGrid, ArticleGridItem} from './ArticleGrid'
import {type EditorialArticle, editorialArticles} from './articles'
import {
  articleSize,
  curateItems,
  type Curation,
  defaultCuration,
  hidePost,
  insertItem,
  referenceKind,
  reorderPosts,
  restorePost,
  setArticleSize,
  setIncludeLatest,
  setStarterPackView,
  starterPackView,
} from './curation'
import {defaultLayout} from './defaultLayout'
import {
  ArticleControls,
  EditorToolbar,
  StarterPackViewPicker,
  UnshownPosts,
} from './Editor'
import {EditorVisibility} from './EditorVisibility'
import {type EditorialItem, isResourceItem, starterPackItem} from './items'
import {articleModeration} from './moderation'
import {CurationConflictError, type CurationSnapshot} from './records'
import {resourceModeration, ResourceSlot} from './ResourceSlot'
import {InsertSlotButton, SlotPicker} from './SlotPicker'
import {
  SortableStories,
  SortableStory,
  StoryDragHandle,
} from './SortableStories'
import {
  useEditorialCurationQuery,
  useEditorialPostsQuery,
  useEditorialStarterPacksQuery,
  useSaveEditorialCurationMutation,
} from './state'

/** The publication's editorial front page; account profiles remain ordinary profiles. */
export function EditorialFrontpage({
  profile: unshadowedProfile,
  moderationOpts,
  publicationName,
  intro,
  outro,
}: {
  profile: app.bsky.actor.defs.ProfileViewDetailed
  moderationOpts: ModerationOpts
  publicationName?: string
  intro?: React.ReactNode
  outro?: React.ReactNode
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const profile = useProfileShadow(unshadowedProfile)
  const moderation = moderateProfile(profile, moderationOpts)
  const {wide} = useExploreSpread()
  const {footerHeight} = useShellLayout()
  const scrollStyle = useAnimatedStyle(() => ({
    marginBottom: footerHeight.get(),
  }))
  const query = usePostFeedQuery(
    `author|${profile.did}|posts_no_replies`,
    undefined,
    {enabled: !profile.viewer?.blocking && !profile.viewer?.blockedBy},
  )
  const {currentAccount} = useSession()
  const isOwner = currentAccount?.did === profile.did
  const [draft, setDraft] = useState<{
    source: CurationSnapshot
    curation: Curation
    added?: EditorialItem[]
  }>()
  const [editError, setEditError] = useState<string>()
  const [conflict, setConflict] = useState(false)
  const pickerControl = Dialog.useDialogControl()
  const [insertionBefore, setInsertionBefore] = useState<string | null>(null)
  const editing = !!draft
  const blocked = !!profile.viewer?.blocking || !!profile.viewer?.blockedBy
  const published = useEditorialCurationQuery(profile.did, !blocked)
  const save = useSaveEditorialCurationMutation(profile.did)
  const storedCuration =
    (editing ? draft.curation : published.data?.curation) ?? defaultCuration()
  const automatic = published.isSuccess && published.data.cid === null
  const starterPacks = useEditorialStarterPacksQuery(
    profile.did,
    !blocked && automatic,
  )
  const feedArticles = editorialArticles(
    query.data?.pages.flatMap(page => page.slices) ?? [],
    profile.did,
  )
  const addedPosts = editing
    ? (draft.added ?? []).filter(
        (value): value is EditorialArticle => !isResourceItem(value),
      )
    : []
  const savedPosts = useEditorialPostsQuery(
    profile.did,
    [
      ...storedCuration.order,
      ...(storedCuration.leadPost ? [storedCuration.leadPost] : []),
      ...(editing ? storedCuration.hidden : []),
    ].filter(
      uri =>
        referenceKind(uri) === 'article' &&
        ![...feedArticles, ...addedPosts].some(
          article => article.item.uri === uri,
        ),
    ),
    !blocked && published.isSuccess,
  )
  const allArticles = [
    ...new Map(
      [...feedArticles, ...savedPosts.articles, ...addedPosts].map(article => [
        article.item.uri,
        article,
      ]),
    ).values(),
  ].filter(article => !articleModeration(article, moderationOpts).filter)
  const suggestedPack = automatic
    ? starterPacks.data?.starterPacks
        .filter(pack => pack.creator.did === profile.did)
        .map(starterPackItem)
        .find(
          pack => !!pack && !resourceModeration(pack, moderationOpts)?.filter,
        )
    : undefined
  const automaticLayout = defaultLayout(allArticles, suggestedPack ?? undefined)
  const curation = editing
    ? draft.curation
    : automatic
      ? automaticLayout
      : storedCuration
  const resources = curation.order.flatMap(uri => {
    const kind = referenceKind(uri)
    if (kind !== 'feed' && kind !== 'starterPack') return []
    const added = editing
      ? draft.added?.find(
          value => value.item.uri === uri && isResourceItem(value),
        )
      : undefined
    return [
      added ??
        (suggestedPack?.item.uri === uri ? suggestedPack : undefined) ?? {
          kind,
          item: {uri: uri as AtUriString},
          title: kind === 'feed' ? l`Feed` : l`Starter pack`,
        },
    ]
  })
  const articles = curateItems<EditorialItem>(
    [...allArticles, ...resources],
    curation,
  )
  const visibleUris = articles.map(article => article.item.uri)
  const unshown = editing
    ? [
        ...new Set([
          ...curation.hidden.filter(uri => referenceKind(uri) === 'article'),
          ...allArticles
            .filter(article => !visibleUris.includes(article.item.uri))
            .map(article => article.item.uri),
        ]),
      ].map(uri => ({
        uri,
        article: allArticles.find(article => article.item.uri === uri),
      }))
    : []
  const loading =
    query.isPending ||
    published.isPending ||
    savedPosts.isPending ||
    (automatic && !editing && starterPacks.isPending)
  const layoutError = published.isError || savedPosts.isError

  /* Account switches discard unpublished drafts, including local previews. */
  useEffect(() => {
    setDraft(undefined)
    setEditError(undefined)
    setConflict(false)
  }, [currentAccount?.did])

  function changeCuration(update: (value: Curation) => Curation) {
    if (!editing || save.isPending || conflict) return
    try {
      setDraft({...draft, curation: update(draft.curation)})
      setEditError(undefined)
    } catch {
      setEditError(l`You can arrange or hide up to 100 items.`)
    }
  }

  async function publish() {
    if (!isOwner || !editing || save.isPending) return
    setEditError(undefined)
    try {
      await save.mutateAsync(draft)
      setDraft(undefined)
      Toast.show(l`Front page published`)
    } catch (error) {
      const changed = error instanceof CurationConflictError
      setConflict(changed)
      setEditError(
        changed
          ? l`This front page changed in another editor. Reload the published version before editing again.`
          : l`Couldn’t publish the front page. Your changes are still here. Try again.`,
      )
    }
  }

  function renderArticle(article: (typeof articles)[number], lead = false) {
    const size = articleSize(curation, article.item.uri, lead)
    const controls = editing ? (
      <ArticleControls
        article={article}
        dragHandle={
          <StoryDragHandle uri={article.item.uri} title={article.title} />
        }
        size={size}
        lead={lead}
        extraControls={
          isResourceItem(article) && article.kind === 'starterPack' ? (
            <StarterPackViewPicker
              value={starterPackView(curation, article.item.uri)}
              disabled={save.isPending || conflict}
              onChange={view =>
                changeCuration(current =>
                  setStarterPackView(current, article.item.uri, view),
                )
              }
            />
          ) : undefined
        }
        onSize={value =>
          changeCuration(current =>
            setArticleSize(current, article.item.uri, value),
          )
        }
        disabled={save.isPending || conflict}
        onHide={() =>
          changeCuration(value => hidePost(value, article.item.uri))
        }
      />
    ) : undefined
    return (
      <SortableStory uri={article.item.uri}>
        {isResourceItem(article) ? (
          <ResourceSlot
            item={article}
            controls={controls}
            starterPackMode={starterPackView(curation, article.item.uri)}
          />
        ) : (
          <Article
            article={article}
            lead={lead}
            compact={wide && size === 'small'}
            size={size}
            wide={wide}
            controls={controls}
          />
        )}
      </SortableStory>
    )
  }

  function openInsertion(index: number | null) {
    if (!editing || save.isPending || conflict) return
    setInsertionBefore(index === null ? null : articles[index].item.uri)
    pickerControl.open()
  }

  function addItem(item: EditorialItem) {
    if (!editing || save.isPending || conflict) return
    try {
      const next = insertItem(
        draft.curation,
        visibleUris,
        item.item.uri,
        insertionBefore,
      )
      setDraft({
        ...draft,
        curation: next,
        added: [
          ...(draft.added ?? []).filter(
            value => value.item.uri !== item.item.uri,
          ),
          item,
        ],
      })
      setEditError(undefined)
    } catch (error) {
      setEditError(
        error instanceof Error && error.message === 'CurationLimit'
          ? l`You can arrange or hide up to 100 items.`
          : l`Couldn’t add the item here. Choose another insertion point.`,
      )
    }
  }

  const columns = wide ? 3 : 1
  const displayName = sanitizeDisplayName(
    profile.displayName || profile.handle.split('.')[0],
    moderation.ui('displayName'),
  )
  const masthead = publicationName || displayName
  useSetTitle(masthead)

  return (
    <ScreenHider
      testID="editorialFrontpage"
      style={[a.flex_1]}
      screenDescription={l`profile`}
      modui={moderation.ui('profileView')}>
      <ExploreSpreadBorders />
      <Animated.View style={scrollStyle}>
        <ExploreColumn style={[a.px_lg, wide && a.px_2xl, a.pb_4xl]}>
          {intro}
          {editing && <EditorVisibility />}
          <View
            testID="editorialFrontpageTopBar"
            style={[
              a.flex_row,
              a.flex_wrap,
              a.align_center,
              a.gap_md,
              a.py_md,
              a.border_b,
              t.atoms.border_contrast_high,
            ]}>
            <View
              style={[
                a.flex_row,
                a.flex_1,
                a.align_center,
                a.gap_sm,
                {minWidth: 200},
              ]}>
              <Layout.Header.BackButton />
              <Link
                testID="publicationAvatarLink"
                to={{screen: 'Profile', params: {name: profile.did}}}
                label={l`View profile`}>
                <UserAvatar
                  type="user"
                  shape="square"
                  size={32}
                  avatar={profile.avatar}
                  moderation={moderation.ui('avatar')}
                />
              </Link>
              <View style={[a.flex_1, a.gap_2xs, {minWidth: 0}]}>
                <View style={[a.flex_row, a.align_center, a.gap_xs]}>
                  <Link
                    testID="publicationNameLink"
                    to={{screen: 'Profile', params: {name: profile.did}}}
                    label={l`View ${masthead}’s profile`}
                    style={[a.flex_shrink]}>
                    <Text
                      emoji
                      accessibilityRole="header"
                      numberOfLines={1}
                      style={[a.text_md, a.font_bold]}>
                      {masthead}
                    </Text>
                  </Link>
                  <VerificationCheckButton
                    profile={profile}
                    width={16}
                    hitSlop={HITSLOP_20}
                  />
                </View>
                <Text
                  numberOfLines={1}
                  style={[a.text_xs, t.atoms.text_contrast_medium]}>
                  {sanitizeHandle(profile.handle, '@')}
                </Text>
                <ProfileCard.Labels
                  profile={profile}
                  moderationOpts={moderationOpts}
                />
              </View>
            </View>
            {(!editing || !isOwner) && (
              <View style={[a.flex_row, a.align_center, a.gap_sm, a.ml_auto]}>
                {!editing && (
                  <Button
                    testID="editFrontpage"
                    label={l`Edit front page`}
                    size="small"
                    color="secondary"
                    disabled={loading || layoutError || query.isError}
                    onPress={() => {
                      if (!published.data) return
                      setDraft({
                        source: {...published.data, curation},
                        curation,
                      })
                      setEditError(undefined)
                      setConflict(false)
                    }}>
                    <ButtonText>
                      <Trans>Edit front page</Trans>
                    </ButtonText>
                  </Button>
                )}
                {!isOwner && (
                  <ProfileCard.FollowButton
                    profile={profile}
                    moderationOpts={moderationOpts}
                    logContext="ProfileHeader"
                    size="small"
                  />
                )}
              </View>
            )}
          </View>

          {editing && (
            <EditorToolbar
              canPublish={isOwner}
              includeLatest={curation.includeLatest}
              onIncludeLatest={value =>
                changeCuration(current =>
                  setIncludeLatest(current, value, visibleUris),
                )
              }
              onSave={() => void publish()}
              onCancel={() => {
                setDraft(undefined)
                setEditError(undefined)
                setConflict(false)
              }}
              onReload={() =>
                void published.refetch().then(result => {
                  if (result.isSuccess) {
                    const reloaded =
                      result.data.cid === null
                        ? automaticLayout
                        : result.data.curation
                    setDraft({
                      source: {...result.data, curation: reloaded},
                      curation: reloaded,
                    })
                    setConflict(false)
                    setEditError(undefined)
                  }
                })
              }
              saving={save.isPending}
              dirty={
                JSON.stringify(curation) !==
                JSON.stringify(draft.source.curation)
              }
              error={editError}
              conflict={conflict}
            />
          )}

          {blocked ? (
            <View style={[a.py_4xl]}>
              <Text>
                <Trans>Stories are unavailable for this account.</Trans>
              </Text>
            </View>
          ) : layoutError ? (
            <View style={[a.py_xl, a.gap_md, a.align_start]}>
              <Text>
                <Trans>Couldn’t load the published front page.</Trans>
              </Text>
              <Button
                label={l`Try again`}
                color="secondary"
                size="small"
                onPress={() =>
                  void Promise.all([published.refetch(), savedPosts.refetch()])
                }>
                <ButtonText>
                  <Trans>Try again</Trans>
                </ButtonText>
              </Button>
            </View>
          ) : loading ? (
            <ExploreSkeleton wide={wide} columns={columns} />
          ) : articles.length ? (
            <SortableStories
              enabled={editing && !save.isPending && !conflict}
              order={visibleUris}
              layoutKey={articles
                .map(
                  (article, index) =>
                    `${article.item.uri}:${articleSize(curation, article.item.uri, index === 0)}:${starterPackView(curation, article.item.uri)}`,
                )
                .join('\n')}
              onReorder={(source, target, edge) =>
                changeCuration(value =>
                  reorderPosts(value, visibleUris, source, target, edge),
                )
              }>
              <ArticleGrid
                renderInsert={
                  editing
                    ? (index, beside) => (
                        <InsertSlotButton
                          beside={beside}
                          disabled={save.isPending || conflict}
                          onPress={() => openInsertion(index)}
                        />
                      )
                    : undefined
                }
                wide={wide}
                sizes={articles.map((article, index) =>
                  articleSize(curation, article.item.uri, index === 0),
                )}>
                {articles.map((article, index) => (
                  <ArticleGridItem
                    key={article.item.uri}
                    wide={wide}
                    size={articleSize(curation, article.item.uri, index === 0)}>
                    {renderArticle(article, index === 0)}
                  </ArticleGridItem>
                ))}
              </ArticleGrid>
            </SortableStories>
          ) : !query.isError ? (
            <View style={[a.py_4xl]}>
              <Text style={[t.atoms.text_contrast_medium]}>
                <Trans>No stories yet.</Trans>
              </Text>
            </View>
          ) : null}

          {editing && !blocked && !loading && !layoutError && (
            <InsertSlotButton
              inline
              disabled={save.isPending || conflict}
              onPress={() => openInsertion(null)}
            />
          )}

          {editing && (
            <UnshownPosts
              posts={unshown}
              disabled={save.isPending || conflict}
              onShow={uri => changeCuration(value => restorePost(value, uri))}
            />
          )}

          {(query.isError ||
            (query.hasNextPage && (curation.includeLatest || editing))) && (
            <View
              style={[
                a.align_center,
                a.gap_md,
                a.py_xl,
                a.border_t,
                t.atoms.border_contrast_low,
              ]}>
              {query.isError && (
                <Text>
                  <Trans>Couldn’t load stories.</Trans>
                </Text>
              )}
              <Button
                label={query.isError ? l`Try again` : l`More stories`}
                size="small"
                color="secondary"
                disabled={query.isFetching}
                onPress={() =>
                  void (query.isError ? query.refetch() : query.fetchNextPage())
                }>
                <ButtonText>
                  {query.isError ? (
                    <Trans>Try again</Trans>
                  ) : (
                    <Trans>More stories</Trans>
                  )}
                </ButtonText>
              </Button>
            </View>
          )}
          {!editing && !blocked && !loading && !layoutError && outro}
        </ExploreColumn>
      </Animated.View>
      {editing && (
        <SlotPicker
          control={pickerControl}
          did={profile.did}
          selected={articles}
          onSelect={addItem}
        />
      )}
    </ScreenHider>
  )
}
