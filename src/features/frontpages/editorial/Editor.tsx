import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Toggle from '#/components/forms/Toggle'
import {Bubble_Stroke2_Corner2_Rounded as PostsIcon} from '#/components/icons/Bubble'
import {Group3_Stroke2_Corner0_Rounded as PeopleIcon} from '#/components/icons/Group3'
import {TimesLarge_Stroke2_Corner0_Rounded as Close} from '#/components/icons/Times'
import * as Menu from '#/components/Menu'
import {ContentHider} from '#/components/moderation/ContentHider'
import {Text} from '#/components/Typography'
import {type EditorialArticle} from './articles'
import {type ArticleSize, type StarterPackViewMode} from './curation'
import {articleModeration} from './moderation'

export function EditorToolbar({
  canPublish,
  includeLatest,
  onIncludeLatest,
  onSave,
  onCancel,
  onReload,
  saving,
  dirty,
  error,
  conflict,
}: {
  canPublish: boolean
  includeLatest: boolean
  onIncludeLatest: (value: boolean) => void
  onSave: () => void
  onCancel: () => void
  onReload: () => void
  saving: boolean
  dirty: boolean
  error?: string
  conflict: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View
      testID="frontpageEditor"
      style={[a.gap_md, a.py_lg, a.border_b, t.atoms.border_contrast_low]}>
      <View
        style={[
          a.flex_row,
          a.flex_wrap,
          a.align_center,
          a.justify_between,
          a.gap_md,
        ]}>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          {canPublish ? (
            <Trans>Drag stories to arrange the front page, then publish.</Trans>
          ) : (
            <Trans>Try arranging the front page. Changes won’t be saved.</Trans>
          )}
        </Text>
        <View style={[a.flex_row, a.gap_sm]}>
          <Button
            testID="discardFrontpage"
            label={canPublish ? l`Cancel editing` : l`Discard changes`}
            color="secondary"
            size="small"
            disabled={saving}
            onPress={onCancel}>
            <ButtonText>
              {canPublish ? <Trans>Cancel</Trans> : <Trans>Discard</Trans>}
            </ButtonText>
          </Button>
          {canPublish && (
            <Button
              testID="publishFrontpage"
              label={l`Publish changes`}
              color="primary"
              size="small"
              disabled={saving || !dirty || conflict}
              onPress={onSave}>
              <ButtonText>
                {saving ? (
                  <Trans>Publishing…</Trans>
                ) : (
                  <Trans>Publish changes</Trans>
                )}
              </ButtonText>
            </Button>
          )}
        </View>
      </View>
      <Toggle.Item
        name="includeLatest"
        label={l`Include new posts automatically`}
        value={includeLatest}
        onChange={onIncludeLatest}
        disabled={saving}>
        <Toggle.Checkbox />
        <Toggle.LabelText>
          <Trans>Include new posts automatically</Trans>
        </Toggle.LabelText>
      </Toggle.Item>
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={[a.text_sm, {color: t.palette.negative_500}]}>
          {error}
        </Text>
      )}
      {canPublish && conflict && (
        <Button
          label={l`Reload published version`}
          size="small"
          color="secondary"
          onPress={onReload}>
          <ButtonText>
            <Trans>Reload published version</Trans>
          </ButtonText>
        </Button>
      )}
    </View>
  )
}

export function ArticleControls({
  article,
  dragHandle,
  size,
  lead,
  disabled,
  onHide,
  onSize,
  extraControls,
}: {
  extraControls?: React.ReactNode
  article: Pick<EditorialArticle, 'title'>
  dragHandle: React.ReactNode
  size: ArticleSize
  lead: boolean
  disabled: boolean
  onHide: () => void
  onSize: (size: ArticleSize) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View
      testID="articleControls"
      pointerEvents="box-none"
      style={[
        a.absolute,
        a.flex_row,
        a.justify_between,
        {top: 8, left: 8, right: 8, zIndex: 10},
      ]}>
      <View style={[a.flex_row, a.gap_xs]}>
        {dragHandle}
        <ArticleSizePicker
          size={size}
          lead={lead}
          disabled={disabled}
          onChange={onSize}
        />
        {extraControls}
      </View>
      <Button
        testID="hideFrontpageStory"
        label={l`Hide ${article.title} from the front page`}
        size="small"
        shape="round"
        color="secondary"
        style={[
          t.atoms.bg,
          a.border,
          t.atoms.border_contrast_low,
          {width: 36, height: 36, marginLeft: 'auto'},
        ]}
        disabled={disabled}
        onPress={onHide}>
        <ButtonIcon icon={Close} />
      </Button>
    </View>
  )
}

export function StarterPackViewPicker({
  value,
  disabled,
  onChange,
}: {
  value: StarterPackViewMode
  disabled: boolean
  onChange: (value: StarterPackViewMode) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const labels = {people: l`People`, posts: l`Latest posts`}
  return (
    <Menu.Root>
      <Menu.Trigger label={l`Starter pack display: ${labels[value]}`}>
        {({props}) => (
          <Button
            {...props}
            testID="starterPackViewPicker"
            label={l`Starter pack display: ${labels[value]}`}
            size="small"
            shape="round"
            color="secondary"
            disabled={disabled}
            style={[
              t.atoms.bg,
              a.border,
              t.atoms.border_contrast_low,
              {width: 36, height: 36},
            ]}>
            <ButtonIcon icon={value === 'people' ? PeopleIcon : PostsIcon} />
          </Button>
        )}
      </Menu.Trigger>
      <Menu.Outer>
        <Menu.Group>
          {(['people', 'posts'] as const).map(view => (
            <Menu.Item
              key={view}
              label={labels[view]}
              onPress={() => onChange(view)}>
              <Menu.ItemText>{labels[view]}</Menu.ItemText>
              <Menu.ItemRadio selected={view === value} />
            </Menu.Item>
          ))}
        </Menu.Group>
      </Menu.Outer>
    </Menu.Root>
  )
}

function ArticleSizePicker({
  size,
  lead,
  disabled,
  onChange,
}: {
  size: ArticleSize
  lead: boolean
  disabled: boolean
  onChange: (size: ArticleSize) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const labels: Record<ArticleSize, string> = {
    small: l`Small`,
    medium: l`Medium (⅔ width)`,
    big: l`Big (full width)`,
  }
  const options: ArticleSize[] = lead
    ? ['medium', 'big']
    : ['small', 'medium', 'big']
  return (
    <Menu.Root>
      <Menu.Trigger label={l`Slot size: ${labels[size]}`}>
        {({props}) => (
          <Button
            {...props}
            testID="articleSizePicker"
            label={l`Slot size: ${labels[size]}`}
            size="small"
            shape="round"
            color="secondary"
            disabled={disabled}
            style={[
              t.atoms.bg,
              a.border,
              t.atoms.border_contrast_low,
              {width: 36, height: 36},
            ]}>
            <ButtonText>
              {size === 'small' ? l`S` : size === 'medium' ? l`M` : l`B`}
            </ButtonText>
          </Button>
        )}
      </Menu.Trigger>
      <Menu.Outer>
        <Menu.Group>
          {options.map(value => (
            <Menu.Item
              key={value}
              label={labels[value]}
              onPress={() => onChange(value)}>
              <Menu.ItemText>{labels[value]}</Menu.ItemText>
              <Menu.ItemRadio selected={size === value} />
            </Menu.Item>
          ))}
        </Menu.Group>
      </Menu.Outer>
    </Menu.Root>
  )
}

export function UnshownPosts({
  posts,
  disabled,
  onShow,
}: {
  posts: {uri: string; article?: EditorialArticle}[]
  disabled: boolean
  onShow: (uri: string) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const moderationOpts = useModerationOpts()
  if (!posts.length) return null
  return (
    <View
      testID="unshownPosts"
      style={[a.py_xl, a.gap_md, a.border_t, t.atoms.border_contrast_low]}>
      <Text style={[a.text_lg, a.font_semi_bold]}>
        <Trans>Not on the front page</Trans>
      </Text>
      <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
        <Trans>These posts stay on your standard profile.</Trans>
      </Text>
      {posts.map(({uri, article}) => (
        <ContentHider
          key={uri}
          modui={
            article ? articleModeration(article, moderationOpts) : undefined
          }>
          <View
            style={[
              a.flex_row,
              a.align_center,
              a.justify_between,
              a.gap_md,
              a.py_sm,
            ]}>
            <Text emoji style={[a.flex_1, a.text_sm]} numberOfLines={2}>
              {article?.title || l`Unavailable post`}
            </Text>
            <Button
              label={l`Show ${article?.title || l`post`} on the front page`}
              size="small"
              color="secondary"
              disabled={disabled}
              onPress={() => onShow(uri)}>
              <ButtonText>
                <Trans>Show</Trans>
              </ButtonText>
            </Button>
          </View>
        </ContentHider>
      ))}
    </View>
  )
}
