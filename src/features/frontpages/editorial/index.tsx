import {Fragment, useEffect, useState} from 'react'
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
import {Carousel} from './Carousel'
import {Cover} from './Cover'
import {
  addSection,
  articleSize,
  type Curation,
  defaultCuration,
  endsWithOwnPosts,
  fillFeeds,
  isOwnPostUri,
  layoutSections,
  moveSection,
  ownRoom,
  pinnedUris,
  pinStory,
  type PlacedSection,
  type PlacedSlot,
  placeStory,
  referenceKind,
  removeSection,
  setArticleSize,
  setCover,
  setSectionFill,
  setSectionKind,
  setSectionLength,
  setStarterPackView,
  splitSection,
  starterPackView,
  unpinStory,
  updateSection,
} from './curation'
import {
  ArticleControls,
  EditorToolbar,
  PinToggle,
  StarterPackViewPicker,
} from './Editor'
import {EditorVisibility} from './EditorVisibility'
import {type EditorialItem, isResourceItem} from './items'
import {articleModeration} from './moderation'
import {CurationConflictError, type CurationSnapshot} from './records'
import {ResourceSlot} from './ResourceSlot'
import {
  AddSectionButton,
  EmptySection,
  SectionContainer,
  SectionDialog,
  SectionResizeBar,
  SectionToolbar,
} from './Section'
import {InsertSlotButton, SlotPicker} from './SlotPicker'
import {
  SortableStories,
  SortableStory,
  StoryDragHandle,
} from './SortableStories'
import {
  useEditorialCurationQuery,
  useEditorialPostsQuery,
  useFillFeedsQuery,
  useSaveEditorialCurationMutation,
} from './state'

/** The publication's editorial front page; account profiles remain ordinary profiles. */
export function EditorialFrontpage({
  profile: unshadowedProfile,
  moderationOpts,
  publicationName,
  intro,
}: {
  profile: app.bsky.actor.defs.ProfileViewDetailed
  moderationOpts: ModerationOpts
  publicationName?: string
  intro?: React.ReactNode
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
  const sectionControl = Dialog.useDialogControl()
  /** The section the dialog renames, or where it adds one: after a section, or at the top for `null`. */
  const [sectionTarget, setSectionTarget] = useState<
    {edit: string} | {after: string | null}
  >()
  /** Where the picker places a story: a section, and a position among its stories. */
  const [insertion, setInsertion] = useState<{
    section: string
    position: number
  }>()
  const editing = !!draft
  const [previewing, setPreviewing] = useState(false)
  /** Editing with the controls showing; a preview shows the draft as readers will see it. */
  const arranging = editing && !previewing
  const blocked = !!profile.viewer?.blocking || !!profile.viewer?.blockedBy
  const published = useEditorialCurationQuery(profile.did, !blocked)
  const save = useSaveEditorialCurationMutation(profile.did)
  const curation =
    (editing ? draft.curation : published.data?.curation) ?? defaultCuration()
  const pinned = pinnedUris(curation)
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
    [...pinned].filter(
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
  const resources = [...pinned].flatMap((uri): EditorialItem[] => {
    const kind = referenceKind(uri)
    if (kind !== 'feed' && kind !== 'starterPack') return []
    const added = editing
      ? draft.added?.find(
          value => value.item.uri === uri && isResourceItem(value),
        )
      : undefined
    return [
      added ?? {
        kind,
        item: {uri: uri as AtUriString},
        title: kind === 'feed' ? l`Feed` : l`Starter pack`,
      },
    ]
  })
  const fill = useFillFeedsQuery(fillFeeds(curation), !blocked)
  const placed = layoutSections<EditorialItem>(
    {own: allArticles, resources, feeds: fill.stories},
    curation,
  )
  const insertionSection = placed.find(
    value => value.section.id === insertion?.section,
  )
  /* The lead is the first story in the grid; a carousel card is never one. */
  const leadUri = placed
    .filter(value => value.section.kind !== 'carousel')
    .flatMap(value => value.slots)[0]?.story.item.uri
  /* A section with no story showing is a drop target of its own in the editor. */
  const dragOrder = placed.flatMap(({section, slots}) =>
    slots.length
      ? slots.map(slot => slot.story.item.uri)
      : arranging
        ? [`end:${section.id}`]
        : [],
  )
  const loading = query.isPending || published.isPending || savedPosts.isPending
  const layoutError = published.isError || savedPosts.isError
  const automaticCount = allArticles.filter(
    article => !pinned.has(article.item.uri),
  ).length
  const wanted = ownRoom(curation)
  const pagesLoaded = query.data?.pages.length ?? 0
  const {hasNextPage, isFetching, isError: feedError, fetchNextPage} = query

  /*
   * Loads older posts while filling sections have open slots, so a long
   * section is not cut short by the first page of posts. Bounded, so an
   * account with few posts stops asking.
   */
  useEffect(() => {
    if (
      automaticCount < wanted &&
      hasNextPage &&
      !isFetching &&
      !feedError &&
      pagesLoaded < 8
    )
      void fetchNextPage()
  }, [
    automaticCount,
    wanted,
    pagesLoaded,
    hasNextPage,
    isFetching,
    feedError,
    fetchNextPage,
  ])

  /* Account switches discard unpublished drafts, including local previews. */
  useEffect(() => {
    setDraft(undefined)
    setPreviewing(false)
    setEditError(undefined)
    setConflict(false)
  }, [currentAccount?.did])

  function changeCuration(update: (value: Curation) => Curation) {
    if (!editing || save.isPending || conflict) return
    try {
      setDraft({...draft, curation: update(draft.curation)})
      setEditError(undefined)
    } catch (error) {
      setEditError(editErrorMessage(error))
    }
  }

  function editErrorMessage(error: unknown) {
    const reason = error instanceof Error ? error.message : undefined
    return reason === 'CarouselTakesPosts'
      ? l`A carousel holds posts only, not feeds or starter packs.`
      : reason === 'CurationLimit'
        ? l`You can pin up to 100 items, with up to 60 slots in a section.`
        : l`Couldn’t place the item there. Choose another place.`
  }

  async function publish() {
    if (!isOwner || !editing || save.isPending) return
    setEditError(undefined)
    try {
      await save.mutateAsync(draft)
      setPreviewing(false)
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

  const disabled = save.isPending || conflict

  /** Whether a story can be pinned: a post of the account's own, or a feed or starter pack. */
  function pinnable(story: EditorialItem) {
    return isResourceItem(story) || isOwnPostUri(story.item.uri, profile.did)
  }

  function reorder(source: string, target: string, edge: 'before' | 'after') {
    let at: {section: string; position: number} | undefined
    if (target.startsWith('end:')) {
      const section = target.slice('end:'.length)
      at = {
        section,
        position:
          placed.find(value => value.section.id === section)?.slots.length ?? 0,
      }
    } else
      for (const {section, slots} of placed) {
        const position = slots.findIndex(
          value => value.story.item.uri === target,
        )
        if (position !== -1)
          at = {
            section: section.id,
            position: position + (edge === 'after' ? 1 : 0),
          }
      }
    if (!at) return
    const {section, position} = at
    changeCuration(value => placeStory(value, source, section, position))
  }

  function renderSlot(
    section: PlacedSection<EditorialItem>['section'],
    slot: PlacedSlot<EditorialItem>,
    position: number,
  ) {
    const article = slot.story
    const card = section.kind === 'carousel'
    const lead = article.item.uri === leadUri
    const size = card
      ? 'small'
      : articleSize(curation, article.item.uri, lead, position)
    const automatic = arranging && !slot.pinned
    const canPin = pinnable(article)
    const controls = arranging ? (
      <ArticleControls
        article={article}
        dragHandle={
          canPin ? (
            <StoryDragHandle uri={article.item.uri} title={article.title} />
          ) : null
        }
        size={card ? undefined : size}
        lead={lead}
        extraControls={
          isResourceItem(article) && article.kind === 'starterPack' ? (
            <StarterPackViewPicker
              value={starterPackView(curation, article.item.uri)}
              disabled={disabled}
              onChange={view =>
                changeCuration(current =>
                  setStarterPackView(current, article.item.uri, view),
                )
              }
            />
          ) : !isResourceItem(article) ? (
            <PinToggle
              pinned={slot.pinned}
              canPin={canPin}
              title={article.title}
              disabled={disabled}
              onChange={pin =>
                changeCuration(value =>
                  pin
                    ? pinStory(value, section.id, article.item.uri)
                    : unpinStory(value, article.item.uri),
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
        disabled={disabled}
        onRemove={
          isResourceItem(article)
            ? () => changeCuration(value => unpinStory(value, article.item.uri))
            : undefined
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
            compact={card || (wide && size === 'small')}
            card={card}
            size={size}
            wide={card ? false : wide}
            controls={controls}
            muted={automatic}
          />
        )}
      </SortableStory>
    )
  }

  function openInsertion(section: string, position: number) {
    if (!editing || disabled) return
    setInsertion({section, position})
    pickerControl.open()
  }

  function openSectionDialog(target: {edit: string} | {after: string | null}) {
    if (!editing || disabled) return
    setSectionTarget(target)
    sectionControl.open()
  }

  function addItem(item: EditorialItem) {
    if (!editing || disabled || !insertion) return
    try {
      setDraft({
        ...draft,
        curation: placeStory(
          draft.curation,
          item.item.uri,
          insertion.section,
          insertion.position,
        ),
        added: [
          ...(draft.added ?? []).filter(
            value => value.item.uri !== item.item.uri,
          ),
          item,
        ],
      })
      setEditError(undefined)
    } catch (error) {
      setEditError(editErrorMessage(error))
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
          {arranging && <EditorVisibility />}
          {curation.cover && !blocked && (
            <Cover
              banner={profile.banner}
              moderation={moderation}
              wide={wide}
            />
          )}
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
              previewing={previewing}
              onPreview={setPreviewing}
              cover={curation.cover}
              hasBanner={!!profile.banner}
              onCover={value =>
                changeCuration(current => setCover(current, value))
              }
              onSave={() => void publish()}
              onCancel={() => {
                setPreviewing(false)
                setDraft(undefined)
                setEditError(undefined)
                setConflict(false)
              }}
              onReload={() =>
                void published.refetch().then(result => {
                  if (result.isSuccess) {
                    const reloaded = result.data.curation
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
          ) : arranging || placed.some(value => value.slots.length) ? (
            <SortableStories
              enabled={arranging && !disabled}
              order={dragOrder}
              layoutKey={placed
                .map(({section, slots}) =>
                  [
                    section.id,
                    ...slots.map(
                      (slot, position) =>
                        `${slot.story.item.uri}:${articleSize(curation, slot.story.item.uri, slot.story.item.uri === leadUri, position)}:${starterPackView(curation, slot.story.item.uri)}`,
                    ),
                  ].join('\n'),
                )
                .join('\n')}
              onReorder={reorder}>
              {arranging && (
                <AddSectionButton
                  disabled={disabled}
                  onPress={() => openSectionDialog({after: null})}
                />
              )}
              {placed.map(({section, slots}, index) =>
                !arranging && !slots.length ? null : (
                  <Fragment key={section.id}>
                    <SectionContainer
                      section={section}
                      editing={arranging}
                      toolbar={
                        arranging ? (
                          <SectionToolbar
                            section={section}
                            disabled={disabled}
                            canMoveUp={index > 0}
                            canMoveDown={index < placed.length - 1}
                            canRemove={placed.length > 1}
                            isLast={index === placed.length - 1}
                            onLength={length =>
                              changeCuration(value =>
                                setSectionLength(value, section.id, length),
                              )
                            }
                            onEdit={() => openSectionDialog({edit: section.id})}
                            onFill={fill =>
                              changeCuration(value =>
                                setSectionFill(value, section.id, fill),
                              )
                            }
                            onMove={offset =>
                              changeCuration(value =>
                                moveSection(value, section.id, offset),
                              )
                            }
                            onRemove={() =>
                              changeCuration(value =>
                                removeSection(value, section.id),
                              )
                            }
                          />
                        ) : undefined
                      }
                      footer={
                        arranging && section.length !== 'infinite' ? (
                          <SectionResizeBar
                            length={section.length}
                            shown={slots.length}
                            fill={section.fill !== 'none'}
                            disabled={disabled}
                            onChange={length =>
                              changeCuration(value =>
                                setSectionLength(value, section.id, length),
                              )
                            }
                          />
                        ) : undefined
                      }>
                      {!!slots.length && section.kind === 'carousel' ? (
                        <Carousel>
                          {slots.map((slot, position) => (
                            <Fragment key={slot.story.item.uri}>
                              {renderSlot(section, slot, position)}
                            </Fragment>
                          ))}
                        </Carousel>
                      ) : (
                        !!slots.length && (
                          <ArticleGrid
                            renderInsert={
                              arranging
                                ? (position, beside) => (
                                    <InsertSlotButton
                                      beside={beside}
                                      disabled={disabled}
                                      onPress={() =>
                                        openInsertion(section.id, position)
                                      }
                                    />
                                  )
                                : undefined
                            }
                            wide={wide}
                            sizes={slots.map((slot, position) =>
                              articleSize(
                                curation,
                                slot.story.item.uri,
                                slot.story.item.uri === leadUri,
                                position,
                              ),
                            )}>
                            {slots.map((slot, position) => (
                              <ArticleGridItem
                                key={slot.story.item.uri}
                                wide={wide}
                                size={articleSize(
                                  curation,
                                  slot.story.item.uri,
                                  slot.story.item.uri === leadUri,
                                  position,
                                )}>
                                {renderSlot(section, slot, position)}
                              </ArticleGridItem>
                            ))}
                          </ArticleGrid>
                        )
                      )}
                      {arranging && (
                        <SortableStory uri={`end:${section.id}`}>
                          {slots.length ? (
                            <InsertSlotButton
                              inline
                              disabled={disabled}
                              onPress={() =>
                                openInsertion(section.id, slots.length)
                              }
                            />
                          ) : (
                            <EmptySection />
                          )}
                        </SortableStory>
                      )}
                    </SectionContainer>
                    {arranging && (
                      <AddSectionButton
                        disabled={disabled}
                        onPress={() => openSectionDialog({after: section.id})}
                      />
                    )}
                  </Fragment>
                ),
              )}
            </SortableStories>
          ) : !query.isError ? (
            <View style={[a.py_4xl]}>
              <Text style={[t.atoms.text_contrast_medium]}>
                <Trans>No stories yet.</Trans>
              </Text>
            </View>
          ) : null}

          {!query.isError &&
            !loading &&
            hasNextPage &&
            endsWithOwnPosts(curation) && (
              <View style={[a.align_center, a.py_xl]}>
                <Button
                  testID="frontpageMoreStories"
                  label={l`More stories`}
                  size="small"
                  color="secondary"
                  disabled={isFetching}
                  onPress={() => void fetchNextPage()}>
                  <ButtonText>
                    <Trans>More stories</Trans>
                  </ButtonText>
                </Button>
              </View>
            )}

          {query.isError && (
            <View
              style={[
                a.align_center,
                a.gap_md,
                a.py_xl,
                a.border_t,
                t.atoms.border_contrast_low,
              ]}>
              <Text>
                <Trans>Couldn’t load stories.</Trans>
              </Text>
              <Button
                label={l`Try again`}
                size="small"
                color="secondary"
                disabled={query.isFetching}
                onPress={() => void query.refetch()}>
                <ButtonText>
                  <Trans>Try again</Trans>
                </ButtonText>
              </Button>
            </View>
          )}
        </ExploreColumn>
      </Animated.View>
      {editing && (
        <SectionDialog
          control={sectionControl}
          section={
            sectionTarget && 'edit' in sectionTarget
              ? curation.sections.find(
                  section => section.id === sectionTarget.edit,
                )
              : undefined
          }
          onSave={value => {
            if (!sectionTarget) return
            changeCuration(current =>
              'edit' in sectionTarget
                ? setSectionKind(
                    updateSection(current, sectionTarget.edit, value),
                    sectionTarget.edit,
                    value.kind,
                  )
                : addSection(current, sectionTarget.after, value),
            )
          }}
        />
      )}
      {editing && (
        <SlotPicker
          control={pickerControl}
          did={profile.did}
          pinned={placed.flatMap(value =>
            value.slots.filter(slot => slot.pinned).map(slot => slot.story),
          )}
          automatic={placed.flatMap(value =>
            value.slots
              .filter(slot => !slot.pinned && pinnable(slot.story))
              .map(slot => slot.story.item.uri),
          )}
          postsOnly={insertionSection?.section.kind === 'carousel'}
          onSplit={
            insertion &&
            insertionSection &&
            insertionSection.section.kind !== 'carousel' &&
            insertion.position > 0 &&
            insertion.position < insertionSection.slots.length
              ? () => {
                  const story = insertionSection.slots[insertion.position]
                  changeCuration(value =>
                    splitSection(
                      value,
                      insertion.section,
                      insertion.position,
                      story.pinned ? story.story.item.uri : undefined,
                    ),
                  )
                }
              : undefined
          }
          onSelect={addItem}
        />
      )}
    </ScreenHider>
  )
}
