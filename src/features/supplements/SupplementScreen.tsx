import {useState} from 'react'
import {ScrollView, View} from 'react-native'
import {type DidString} from '@atproto/syntax'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
  type NavigationProp,
} from '#/lib/routes/types'
import {useProfileQuery} from '#/state/queries/profile'
import {useSession} from '#/state/session'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as DateField from '#/components/forms/DateField'
import * as TextField from '#/components/forms/TextField'
import {
  ArrowBottom_Stroke2_Corner0_Rounded as DownIcon,
  ArrowTop_Stroke2_Corner0_Rounded as UpIcon,
} from '#/components/icons/Arrow'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {TimesLarge_Stroke2_Corner0_Rounded as RemoveIcon} from '#/components/icons/Times'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Layout from '#/components/Layout'
import {InlineLinkText} from '#/components/Link'
import {Loader} from '#/components/Loader'
import * as Prompt from '#/components/Prompt'
import * as Select from '#/components/Select'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {useDutchTopicsQuery} from '#/features/news/dutch/queries'
import {
  ExploreColumn,
  ExploreHeaderOuter,
  ExploreSpreadBorders,
  useExploreSpread,
} from '#/features/news/explore/components/ExploreColumn'
import {ArticlePicker} from './ArticlePicker'
import {
  ArticleCard,
  Rows,
  StatusTag,
  useSupplementDates,
  useTopicName,
} from './components'
import {type StoredSupplement, SupplementConflictError} from './records'
import {
  useDeleteSupplementMutation,
  useSaveSupplementMutation,
  useSupplementQuery,
} from './state'
import {
  addArticle,
  draftFrom,
  type DraftProblem,
  draftProblems,
  emptyDraft,
  localDay,
  MAX_TITLE_LENGTH,
  moveArticle,
  removeArticle,
  type SupplementArticle,
  type SupplementDraft,
  supplementFromDraft,
  supplementStatus,
} from './supplement'

/** One supplement, at `/news/supplements/:name/:rkey`. */
export function SupplementScreen({
  route,
}: NativeStackScreenProps<CommonNavigatorParams, 'Supplement'>) {
  const {name, rkey} = route.params
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const profile = useProfileQuery({did: name})
  const did = profile.data?.did
  const query = useSupplementQuery(did, rkey)
  const blocked =
    !!profile.data?.viewer?.blocking || !!profile.data?.viewer?.blockedBy

  if (profile.isLoading || query.isLoading) return <Status loading />
  if (profile.isError || query.isError)
    return (
      <Status
        message={l`Couldn’t load this supplement.`}
        onRetry={() => {
          void profile.refetch()
          void query.refetch()
        }}
      />
    )
  if (!did || !query.data || blocked)
    return <Status message={l`This supplement isn’t available.`} />
  return (
    <SupplementPage
      editorName={profile.data?.displayName || profile.data?.handle}
      /* Switching accounts discards a draft, as on a frontpage. */
      key={`${currentAccount?.did}:${query.data.rkey}`}
      did={did}
      stored={query.data}
    />
  )
}

/** A supplement that does not exist yet, at `/news/supplements/new`. */
export function NewSupplementScreen(
  _props: NativeStackScreenProps<CommonNavigatorParams, 'SupplementNew'>,
) {
  const {currentAccount} = useSession()
  if (!currentAccount) return <Status />
  return <SupplementPage key={currentAccount.did} did={currentAccount.did} />
}

function Shell({
  title,
  actions,
  children,
}: {
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Layout.Screen testID="supplementScreen" noCenterBorders>
      <ExploreSpreadBorders />
      <ExploreHeaderOuter>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>{title}</Layout.Header.TitleText>
        </Layout.Header.Content>
        {actions}
      </ExploreHeaderOuter>
      <ScrollView>
        <ExploreColumn>{children}</ExploreColumn>
      </ScrollView>
    </Layout.Screen>
  )
}

function Status({
  loading,
  message,
  onRetry,
}: {
  loading?: boolean
  message?: string
  onRetry?: () => void
}) {
  const {t: l} = useLingui()
  return (
    <Shell title={l`Supplement`}>
      <View style={[a.p_2xl, a.align_center, a.gap_md]}>
        {loading && <Loader size="lg" />}
        {!!message && <Text style={[a.text_md, a.text_center]}>{message}</Text>}
        {onRetry && (
          <Button
            label={l`Try again`}
            size="small"
            color="secondary"
            onPress={onRetry}>
            <ButtonText>
              <Trans>Try again</Trans>
            </ButtonText>
          </Button>
        )}
      </View>
    </Shell>
  )
}

/**
 * The page, read or edited. As on a frontpage, changes stay in a local draft
 * until **Publish**, the editor publishes to their own repository, and only
 * the account that holds the record sees the controls.
 */
function SupplementPage({
  did,
  stored,
  editorName,
}: {
  did: DidString
  /** Who curates it, linking to their frontpage. */
  editorName?: string
  /** Absent for a supplement being created. */
  stored?: StoredSupplement
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const {currentAccount} = useSession()
  const {wide} = useExploreSpread()
  const {gtMobile} = useBreakpoints()
  const isEditor = currentAccount?.did === did
  const [draft, setDraft] = useState<SupplementDraft | undefined>(() =>
    stored ? undefined : emptyDraft(localDay()),
  )
  const [error, setError] = useState<string>()
  const [conflict, setConflict] = useState(false)
  const save = useSaveSupplementMutation(did)
  const remove = useDeleteSupplementMutation(did)
  const deleteControl = Prompt.usePromptControl()
  const dates = useSupplementDates()
  const topicName = useTopicName()
  const columns = wide ? 3 : gtMobile ? 2 : 1

  const items = draft?.items ?? stored?.supplement.items ?? []
  const [lead, ...rest] = items
  const problems = draft ? draftProblems(draft) : []
  const busy = save.isPending || remove.isPending

  function setItems(
    change: (items: SupplementArticle[]) => SupplementArticle[],
  ) {
    setDraft(current =>
      current ? {...current, items: change(current.items)} : current,
    )
  }

  function discard() {
    setError(undefined)
    setConflict(false)
    if (stored) setDraft(undefined)
    else if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate('Frontpage', {name: did})
  }

  async function publish() {
    const supplement = draft && supplementFromDraft(draft)
    if (!supplement || busy) return
    setError(undefined)
    try {
      const saved = await save.mutateAsync({source: stored, supplement})
      Toast.show(l`Supplement published`)
      if (stored) setDraft(undefined)
      else
        navigation.replace('Supplement', {
          name: saved.did,
          rkey: saved.rkey,
        })
    } catch (caught) {
      const changed = caught instanceof SupplementConflictError
      setConflict(changed)
      setError(
        changed
          ? l`This supplement changed in another editor. Reload the published version before editing again.`
          : l`Couldn’t publish the supplement. Your changes are still here. Try again.`,
      )
    }
  }

  async function onDelete() {
    if (!stored || busy) return
    setError(undefined)
    try {
      await remove.mutateAsync(stored)
      Toast.show(l`Supplement deleted`)
      if (navigation.canGoBack()) navigation.goBack()
      else navigation.navigate('Frontpage', {name: did})
    } catch {
      setError(l`Couldn’t delete the supplement. Try again.`)
    }
  }

  const controls = (article: SupplementArticle, index: number) =>
    draft ? (
      <View style={[a.flex_row, a.gap_xs]}>
        <Button
          label={l`Move up: ${article.title}`}
          size="tiny"
          color="secondary"
          shape="round"
          disabled={index === 0}
          onPress={() => setItems(all => moveArticle(all, article.url, -1))}>
          <ButtonIcon icon={UpIcon} />
        </Button>
        <Button
          label={l`Move down: ${article.title}`}
          size="tiny"
          color="secondary"
          shape="round"
          disabled={index === items.length - 1}
          onPress={() => setItems(all => moveArticle(all, article.url, 1))}>
          <ButtonIcon icon={DownIcon} />
        </Button>
        <Button
          testID="supplementRemoveArticle"
          label={l`Remove: ${article.title}`}
          size="tiny"
          color="secondary"
          shape="round"
          onPress={() => setItems(all => removeArticle(all, article.url))}>
          <ButtonIcon icon={RemoveIcon} />
        </Button>
      </View>
    ) : undefined

  return (
    <Shell
      title={l`Supplement`}
      actions={
        isEditor && !draft ? (
          <Button
            testID="supplementEdit"
            label={l`Edit supplement`}
            size="small"
            color="secondary"
            onPress={() => {
              if (stored) setDraft(draftFrom(stored.supplement))
            }}>
            <ButtonIcon icon={PencilIcon} />
            <ButtonText>
              <Trans context="Edit a supplement">Edit</Trans>
            </ButtonText>
          </Button>
        ) : (
          <Layout.Header.Slot />
        )
      }>
      <View style={[a.px_lg, a.py_xl, a.gap_xl]}>
        {draft ? (
          <SupplementForm
            draft={draft}
            problems={problems}
            onChange={change =>
              setDraft(current => current && {...current, ...change})
            }
          />
        ) : (
          stored && (
            <View
              style={[
                a.gap_sm,
                a.pb_lg,
                a.border_b,
                t.atoms.border_contrast_low,
              ]}>
              <StatusTag
                status={supplementStatus(stored.supplement, localDay())}
              />
              <Text style={[a.text_4xl, a.font_bold, a.leading_tight]}>
                {stored.supplement.title}
              </Text>
              <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
                {topicName(stored.supplement.topic)} ·{' '}
                {dates(stored.supplement)}
              </Text>
              {editorName && (
                <InlineLinkText
                  testID="supplementEditorLink"
                  to={{screen: 'Frontpage', params: {name: did}}}
                  label={l`Open ${editorName}’s frontpage`}
                  style={[a.text_sm, a.self_start]}>
                  <Trans>By {editorName}</Trans>
                </InlineLinkText>
              )}
            </View>
          )
        )}

        {draft && (
          <View style={[a.flex_row, a.flex_wrap, a.align_center, a.gap_sm]}>
            <Button
              testID="supplementPublish"
              label={l`Publish supplement`}
              size="small"
              color="primary"
              disabled={busy || conflict || problems.length > 0}
              onPress={() => void publish()}>
              <ButtonText>
                <Trans>Publish</Trans>
              </ButtonText>
              {save.isPending && <Loader size="xs" />}
            </Button>
            <Button
              testID="supplementDiscard"
              label={l`Discard changes`}
              size="small"
              color="secondary"
              disabled={busy}
              onPress={discard}>
              <ButtonText>
                <Trans>Discard</Trans>
              </ButtonText>
            </Button>
            {stored && (
              <Button
                testID="supplementDelete"
                label={l`Delete supplement`}
                size="small"
                color="negative_subtle"
                disabled={busy}
                onPress={deleteControl.open}>
                <ButtonIcon icon={TrashIcon} />
                <ButtonText>
                  <Trans>Delete</Trans>
                </ButtonText>
              </Button>
            )}
          </View>
        )}
        {!!error && (
          <Text
            accessibilityRole="alert"
            style={[a.text_sm, {color: t.palette.negative_500}]}>
            {error}
          </Text>
        )}

        {items.length === 0 ? (
          <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
            <Trans>No articles yet.</Trans>
          </Text>
        ) : (
          <View style={[a.gap_xl]}>
            <ArticleCard article={lead} lead footer={controls(lead, 0)} />
            <Rows items={rest} columns={columns} keyOf={article => article.url}>
              {article => (
                <ArticleCard
                  article={article}
                  footer={controls(article, items.indexOf(article))}
                />
              )}
            </Rows>
          </View>
        )}

        {draft && (
          <View style={[a.pt_lg, a.border_t, t.atoms.border_contrast_low]}>
            <ArticlePicker
              draft={draft}
              onAdd={article => setItems(all => addArticle(all, article))}
            />
          </View>
        )}
      </View>

      <Prompt.Basic
        control={deleteControl}
        title={l`Delete this supplement?`}
        description={l`It will be removed for everyone. This can’t be undone. The articles themselves are not affected.`}
        confirmButtonCta={l`Delete`}
        confirmButtonColor="negative"
        onConfirm={() => void onDelete()}
      />
    </Shell>
  )
}

function SupplementForm({
  draft,
  problems,
  onChange,
}: {
  draft: SupplementDraft
  problems: DraftProblem[]
  onChange: (change: Partial<SupplementDraft>) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {topics, isLoading, isError} = useDutchTopicsQuery()
  const invalidEnd = problems.includes('endDate')
  /* A topic since dropped from the vocabulary stays selectable while kept. */
  const options = [
    ...topics.map(topic => ({label: topic.name, value: topic.slug})),
    ...(draft.topic && !topics.some(topic => topic.slug === draft.topic?.slug)
      ? [{label: draft.topic.name, value: draft.topic.slug}]
      : []),
  ]

  return (
    <View style={[a.gap_md, {maxWidth: 600}]}>
      <View>
        <TextField.LabelText>
          <Trans>Title</Trans>
        </TextField.LabelText>
        <TextField.Root>
          <TextField.Input
            testID="supplementTitle"
            label={l`Title`}
            value={draft.title}
            maxLength={MAX_TITLE_LENGTH}
            onChangeText={title => onChange({title})}
          />
        </TextField.Root>
      </View>

      <View>
        <TextField.LabelText>
          <Trans>Topic</Trans>
        </TextField.LabelText>
        <Select.Root
          disabled={isLoading || isError}
          value={draft.topic?.slug}
          onValueChange={slug => {
            const label = options.find(option => option.value === slug)?.label
            if (label) onChange({topic: {slug, name: label}})
          }}>
          <Select.Trigger label={l`Select a topic`}>
            <Select.ValueText placeholder={l`Select a topic`} />
            <Select.Icon />
          </Select.Trigger>
          <Select.Content
            label={l`Select a topic`}
            items={options}
            renderItem={({label, value}) => (
              <Select.Item value={value} label={label}>
                <Select.ItemIndicator />
                <Select.ItemText>{label}</Select.ItemText>
              </Select.Item>
            )}
          />
        </Select.Root>
        {isError && (
          <Text style={[a.text_xs, a.pt_xs, {color: t.palette.negative_500}]}>
            <Trans>Couldn’t load the topics.</Trans>
          </Text>
        )}
      </View>

      <View style={[a.flex_row, a.flex_wrap, a.gap_md]}>
        <View style={[a.flex_1, {minWidth: 220}]}>
          <DateField.LabelText>
            <Trans>Start date</Trans>
          </DateField.LabelText>
          <DateField.DateField
            testID="supplementStartDate"
            label={l`Start date`}
            value={draft.startDate}
            onChangeDate={startDate => onChange({startDate})}
          />
        </View>
        <View style={[a.flex_1, {minWidth: 220}]}>
          <DateField.LabelText>
            <Trans>End date (optional)</Trans>
          </DateField.LabelText>
          <DateField.DateField
            testID="supplementEndDate"
            label={l`End date (optional)`}
            value={draft.endDate}
            isInvalid={invalidEnd}
            onChangeDate={endDate => onChange({endDate})}
          />
          {!!draft.endDate && (
            <Button
              testID="supplementClearEndDate"
              label={l`Remove end date`}
              size="tiny"
              variant="ghost"
              color="secondary"
              onPress={() => onChange({endDate: ''})}
              style={[a.self_start, a.mt_xs]}>
              <ButtonText>
                <Trans>Remove end date</Trans>
              </ButtonText>
            </Button>
          )}
        </View>
      </View>

      {invalidEnd ? (
        <Text style={[a.text_xs, {color: t.palette.negative_500}]}>
          <Trans>The end date can’t be before the start date.</Trans>
        </Text>
      ) : (
        <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
          <Trans>
            It moves to the archive after its end date. Without one, it stays
            current.
          </Trans>
        </Text>
      )}
    </View>
  )
}
