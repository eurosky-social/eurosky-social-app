import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Toggle from '#/components/forms/Toggle'
import {Bubble_Stroke2_Corner2_Rounded as PostsIcon} from '#/components/icons/Bubble'
import {Group3_Stroke2_Corner0_Rounded as PeopleIcon} from '#/components/icons/Group3'
import {
  Pin_Filled_Corner0_Rounded as PinnedIcon,
  Pin_Stroke2_Corner0_Rounded as PinIcon,
} from '#/components/icons/Pin'
import {TimesLarge_Stroke2_Corner0_Rounded as Close} from '#/components/icons/Times'
import * as Menu from '#/components/Menu'
import {Text} from '#/components/Typography'
import {type EditorialArticle} from './articles'
import {type ArticleSize, type StarterPackViewMode} from './curation'

export function EditorToolbar({
  canPublish,
  previewing = false,
  onPreview,
  cover,
  hasBanner,
  onCover,
  onSave,
  onCancel,
  onReload,
  saving,
  dirty,
  error,
  conflict,
}: {
  canPublish: boolean
  /** Whether the draft shows as readers will see it, without editing controls. */
  previewing?: boolean
  onPreview: (previewing: boolean) => void
  cover: boolean
  /** Whether the account has a banner to fill the cover with. */
  hasBanner: boolean
  onCover: (value: boolean) => void
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
  const publishButton = canPublish && (
    <Button
      testID="publishFrontpage"
      label={l`Publish changes`}
      color="primary"
      size="small"
      disabled={saving || !dirty || conflict}
      onPress={onSave}>
      <ButtonText>
        {saving ? <Trans>Publishing…</Trans> : <Trans>Publish changes</Trans>}
      </ButtonText>
    </Button>
  )
  if (previewing)
    return (
      <View
        testID="frontpageEditor"
        style={[
          a.flex_row,
          a.flex_wrap,
          a.align_center,
          a.justify_between,
          a.gap_md,
          a.py_lg,
          a.border_b,
          t.atoms.border_contrast_low,
        ]}>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          {dirty ? (
            <Trans>
              Preview – this is how readers will see the page once you publish.
            </Trans>
          ) : (
            <Trans>Preview – this is how readers see the page.</Trans>
          )}
        </Text>
        <View style={[a.flex_row, a.gap_sm]}>
          <Button
            testID="exitFrontpagePreview"
            label={l`Back to editing`}
            color="secondary"
            size="small"
            onPress={() => onPreview(false)}>
            <ButtonText>
              <Trans>Back to editing</Trans>
            </ButtonText>
          </Button>
          {publishButton}
        </View>
      </View>
    )
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
          <Button
            testID="previewFrontpage"
            label={l`Preview the front page as readers will see it`}
            color="secondary"
            size="small"
            onPress={() => onPreview(true)}>
            <ButtonText>
              <Trans>Preview</Trans>
            </ButtonText>
          </Button>
          {publishButton}
        </View>
      </View>
      <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
        <Trans>
          Grey stories fill sections automatically with the newest posts. Pin or
          drag one to keep it in place.
        </Trans>
      </Text>
      <View style={[a.gap_xs]}>
        <Toggle.Item
          name="cover"
          label={l`Show cover photo at the top`}
          value={cover && hasBanner}
          onChange={onCover}
          disabled={saving || !hasBanner}>
          <Toggle.Checkbox />
          <Toggle.LabelText>
            <Trans>Show cover photo at the top</Trans>
          </Toggle.LabelText>
        </Toggle.Item>
        {!hasBanner && (
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>Add a banner to the profile to use it as the cover.</Trans>
          </Text>
        )}
      </View>
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
  onRemove,
  onSize,
  extraControls,
}: {
  extraControls?: React.ReactNode
  article: Pick<EditorialArticle, 'title'>
  dragHandle: React.ReactNode
  /** Omitted for a slot with no size of its own, like a section header. */
  size?: ArticleSize
  lead: boolean
  disabled: boolean
  /** Removes a feed or starter pack; posts are pinned or unpinned instead. */
  onRemove?: () => void
  onSize?: (size: ArticleSize) => void
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
        {size && onSize && (
          <ArticleSizePicker
            size={size}
            lead={lead}
            disabled={disabled}
            onChange={onSize}
          />
        )}
        {extraControls}
      </View>
      {onRemove && (
        <Button
          testID="removeFrontpageSlot"
          label={l`Remove ${article.title} from the front page`}
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
          onPress={onRemove}>
          <ButtonIcon icon={Close} />
        </Button>
      )}
    </View>
  )
}

/**
 * Whether a story is pinned in its section or fills it automatically, with the
 * action that changes it. Pinning moves it to the end of the section's pinned
 * stories; unpinning returns it to the automatic ones.
 */
export function PinToggle({
  pinned,
  canPin = true,
  title,
  disabled,
  onChange,
}: {
  pinned: boolean
  /** False for another account's post from a feed: a layout pins only the account's own posts. */
  canPin?: boolean
  title: string
  disabled: boolean
  onChange: (pinned: boolean) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  if (pinned)
    return (
      <Button
        testID="unpinFrontpageStory"
        label={l`Unpin ${title} so it fills automatically`}
        size="small"
        color="primary_subtle"
        disabled={disabled}
        style={[{height: 36}]}
        onPress={() => onChange(false)}>
        <ButtonIcon icon={PinnedIcon} />
        <ButtonText>
          <Trans comment="A story pinned to its place on the front page; pressing unpins it">
            Pinned
          </Trans>
        </ButtonText>
      </Button>
    )
  return (
    <View
      testID="automaticStory"
      style={[a.flex_row, a.align_center, a.gap_xs]}>
      <View
        style={[
          a.justify_center,
          a.px_sm,
          a.rounded_full,
          a.border,
          t.atoms.bg,
          t.atoms.border_contrast_low,
          {height: 36},
        ]}>
        <Text
          style={[a.text_xs, a.font_semi_bold, t.atoms.text_contrast_medium]}>
          {canPin ? (
            <Trans comment="An automatically included story on the front page editor">
              Automatic
            </Trans>
          ) : (
            <Trans comment="A story filled in from a feed, which cannot be pinned because another account posted it">
              From a feed
            </Trans>
          )}
        </Text>
      </View>
      {canPin && (
        <Button
          testID="pinFrontpageStory"
          label={l`Pin ${title} here`}
          size="small"
          color="secondary"
          disabled={disabled}
          style={[
            t.atoms.bg,
            a.border,
            t.atoms.border_contrast_low,
            {height: 36},
          ]}
          onPress={() => onChange(true)}>
          <ButtonIcon icon={PinIcon} />
          <ButtonText>
            <Trans>Pin</Trans>
          </ButtonText>
        </Button>
      )}
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
