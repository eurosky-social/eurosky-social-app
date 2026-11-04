import {useRef, useState} from 'react'
import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {
  ChevronBottom_Stroke2_Corner0_Rounded as DownIcon,
  ChevronTop_Stroke2_Corner0_Rounded as UpIcon,
  ChevronTopBottom_Stroke2_Corner0_Rounded as ResizeIcon,
} from '#/components/icons/Chevron'
import {PencilLine_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {PlusSmall_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {TimesLarge_Stroke2_Corner0_Rounded as Close} from '#/components/icons/Times'
import * as Menu from '#/components/Menu'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {
  DEFAULT_SECTION_LENGTH,
  type FillSource,
  type FrontpageSection,
  MAX_SECTION_DESCRIPTION,
  MAX_SECTION_LENGTH,
  MAX_SECTION_TITLE,
  type SectionKind,
} from './curation'
import {FillMenu} from './FillMenu'

type SectionText = {title?: string; description?: string; kind: SectionKind}

/**
 * A section of the front page: a heavy rule and its title for readers, when it
 * has one, then its stories. In the editor it is a framed container with its
 * settings above its stories and its length below them.
 */
export function SectionContainer({
  section,
  editing,
  toolbar,
  footer,
  children,
}: {
  section: FrontpageSection
  editing: boolean
  toolbar?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  const t = useTheme()
  return (
    <View
      testID="frontpageSection"
      style={[
        editing && [
          a.mt_lg,
          a.p_md,
          a.rounded_md,
          a.border,
          t.atoms.border_contrast_medium,
          {borderStyle: 'dashed'},
        ],
      ]}>
      {toolbar}
      {section.title ? (
        <View
          style={[
            a.gap_xs,
            a.pt_md,
            a.mt_lg,
            {borderTopWidth: 3, borderColor: t.atoms.text.color},
          ]}>
          <Text
            emoji
            accessibilityRole="header"
            style={[
              a.text_3xl,
              a.font_bold,
              t.atoms.text,
              {letterSpacing: -0.7},
            ]}>
            {section.title}
          </Text>
          {!!section.description && (
            <Text
              emoji
              style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
              {section.description}
            </Text>
          )}
        </View>
      ) : null}
      {children}
      {footer}
    </View>
  )
}

/** A section's settings in the editor: its name, whether it fills itself, its place and removal. */
export function SectionToolbar({
  section,
  disabled,
  canMoveUp,
  canMoveDown,
  canRemove,
  isLast,
  onEdit,
  onFill,
  onLength,
  onMove,
  onRemove,
}: {
  section: FrontpageSection
  disabled: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  canRemove: boolean
  isLast: boolean
  onEdit: () => void
  onFill: (fill: FillSource) => void
  onLength: (length: number | 'infinite') => void
  onMove: (offset: -1 | 1) => void
  onRemove: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const name =
    section.title ||
    (section.kind === 'carousel' ? l`Untitled carousel` : l`Untitled section`)
  const iconButton = [
    t.atoms.bg,
    a.border,
    t.atoms.border_contrast_low,
    {width: 32, height: 32},
  ]
  return (
    <View
      testID="frontpageSectionToolbar"
      style={[a.flex_row, a.flex_wrap, a.align_center, a.gap_sm]}>
      <Text
        emoji
        numberOfLines={1}
        style={[
          a.flex_1,
          a.text_sm,
          a.font_semi_bold,
          section.title ? t.atoms.text : t.atoms.text_contrast_medium,
          {minWidth: 120},
        ]}>
        {name}
      </Text>
      <SpotsMenu
        length={section.length}
        isLast={isLast}
        pinned={section.pinned.length}
        disabled={disabled}
        onChange={onLength}
      />
      <FillMenu value={section.fill} disabled={disabled} onChange={onFill} />
      <Button
        testID="editFrontpageSection"
        label={l`Edit section ${name}`}
        size="small"
        shape="round"
        color="secondary"
        disabled={disabled}
        style={iconButton}
        onPress={onEdit}>
        <ButtonIcon icon={PencilIcon} />
      </Button>
      <Button
        label={l`Move ${name} up`}
        size="small"
        shape="round"
        color="secondary"
        disabled={disabled || !canMoveUp}
        style={iconButton}
        onPress={() => onMove(-1)}>
        <ButtonIcon icon={UpIcon} />
      </Button>
      <Button
        label={l`Move ${name} down`}
        size="small"
        shape="round"
        color="secondary"
        disabled={disabled || !canMoveDown}
        style={iconButton}
        onPress={() => onMove(1)}>
        <ButtonIcon icon={DownIcon} />
      </Button>
      <Button
        testID="removeFrontpageSection"
        label={l`Remove ${name}`}
        size="small"
        shape="round"
        color="secondary"
        disabled={disabled || !canRemove}
        style={iconButton}
        onPress={onRemove}>
        <ButtonIcon icon={Close} />
      </Button>
    </View>
  )
}

/** How far to drag the bottom bar for one spot more or less. */
const SPOT_DRAG_STEP = 48

/**
 * A fixed section's bottom edge in the editor: drag it down for more spots and
 * up for fewer, or use the arrow keys on it. Says how many of its spots have a
 * story when there is not enough to fill them.
 */
export function SectionResizeBar({
  length,
  shown,
  fill,
  disabled,
  onChange,
}: {
  length: number
  /** How many stories it shows; fewer than its spots when there is nothing to fill them. */
  shown: number
  fill: boolean
  disabled: boolean
  onChange: (length: number) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const drag = useRef<{y: number; length: number} | null>(null)
  const [preview, setPreview] = useState<number>()
  const value = preview ?? length
  const spots = plural(value, {one: '# spot', other: '# spots'})
  const note =
    shown >= length
      ? undefined
      : fill
        ? l`${shown} of ${length} filled – there are no more posts to fill it, so it collapses for readers.`
        : l`Open spots stay empty while this section doesn’t fill.`
  if (!IS_WEB)
    return (
      <View
        style={[
          a.flex_row,
          a.align_center,
          a.justify_center,
          a.gap_sm,
          a.pt_md,
        ]}>
        <Button
          label={l`Fewer spots`}
          size="small"
          shape="round"
          color="secondary"
          disabled={disabled || length <= 1}
          onPress={() => onChange(length - 1)}>
          <ButtonText>−</ButtonText>
        </Button>
        <Text style={[a.text_sm, a.font_semi_bold]}>{spots}</Text>
        <Button
          label={l`More spots`}
          size="small"
          shape="round"
          color="secondary"
          disabled={disabled || length >= MAX_SECTION_LENGTH}
          onPress={() => onChange(length + 1)}>
          <ButtonText>+</ButtonText>
        </Button>
      </View>
    )
  return (
    <View testID="frontpageSectionLength" style={[a.pt_md, a.gap_xs]}>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={l`Section length: drag down for more spots, up for fewer`}
        aria-valuemin={1}
        aria-valuemax={MAX_SECTION_LENGTH}
        aria-valuenow={value}
        aria-valuetext={spots}
        onKeyDown={event => {
          if (disabled) return
          if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            event.preventDefault()
            onChange(length - 1)
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            event.preventDefault()
            onChange(length + 1)
          }
        }}
        onPointerDown={event => {
          if (disabled || event.button !== 0) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = {y: event.clientY, length}
        }}
        onPointerMove={event => {
          if (!drag.current) return
          setPreview(
            Math.max(
              1,
              Math.min(
                MAX_SECTION_LENGTH,
                drag.current.length +
                  Math.round((event.clientY - drag.current.y) / SPOT_DRAG_STEP),
              ),
            ),
          )
        }}
        onPointerUp={() => {
          if (drag.current && preview !== undefined && preview !== length)
            onChange(preview)
          drag.current = null
          setPreview(undefined)
        }}
        onPointerCancel={() => {
          drag.current = null
          setPreview(undefined)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          height: 28,
          borderRadius: 6,
          border: `1px dashed ${t.atoms.border_contrast_medium.borderColor}`,
          background:
            preview !== undefined
              ? t.atoms.bg_contrast_25.backgroundColor
              : 'transparent',
          cursor: disabled ? 'default' : 'ns-resize',
          touchAction: 'none',
          userSelect: 'none',
        }}>
        <ResizeIcon size="sm" fill={t.atoms.text_contrast_medium.color} />
        <Text
          style={[a.text_xs, a.font_semi_bold, t.atoms.text_contrast_medium]}>
          {preview !== undefined ? spots : l`${spots} – drag to resize`}
        </Text>
      </div>
      {note && (
        <Text style={[a.text_center, a.text_xs, t.atoms.text_contrast_medium]}>
          {note}
        </Text>
      )}
    </View>
  )
}

/**
 * How many spots a section has, at its top in the editor: a fixed number, or,
 * for the page's last section, infinite.
 */
export function SpotsMenu({
  length,
  isLast,
  pinned,
  disabled,
  onChange,
}: {
  length: number | 'infinite'
  isLast: boolean
  /** How many it pins, the fewest spots it can have. */
  pinned: number
  disabled: boolean
  onChange: (length: number | 'infinite') => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const label = length === 'infinite' ? '∞' : String(length)
  return (
    <Menu.Root>
      <Menu.Trigger label={l`Spots: ${label}`}>
        {({props}) => (
          <Button
            {...props}
            testID="frontpageSectionSpots"
            label={l`Spots: ${label}`}
            size="small"
            color="secondary"
            disabled={disabled}
            style={[
              t.atoms.bg,
              a.border,
              t.atoms.border_contrast_low,
              {height: 32},
            ]}>
            <ButtonText style={[a.text_sm]}>{l`Spots: ${label}`}</ButtonText>
            <ButtonIcon icon={DownIcon} size="sm" />
          </Button>
        )}
      </Menu.Trigger>
      <Menu.Outer>
        <Menu.Group>
          <Menu.Item
            label={l`Infinite: every post its source has`}
            disabled={!isLast}
            onPress={() => onChange('infinite')}>
            <Menu.ItemText>
              {isLast ? l`Infinite` : l`Infinite (last section only)`}
            </Menu.ItemText>
            <Menu.ItemRadio selected={length === 'infinite'} />
          </Menu.Item>
          <Menu.Item
            label={l`A fixed number of spots`}
            onPress={() =>
              onChange(
                length === 'infinite'
                  ? Math.max(pinned, DEFAULT_SECTION_LENGTH)
                  : length,
              )
            }>
            <Menu.ItemText>
              {length === 'infinite'
                ? l`Fixed number of spots`
                : plural(length, {
                    one: 'Fixed: # spot',
                    other: 'Fixed: # spots',
                  })}
            </Menu.ItemText>
            <Menu.ItemRadio selected={length !== 'infinite'} />
          </Menu.Item>
        </Menu.Group>
      </Menu.Outer>
    </Menu.Root>
  )
}

/** Where a story can be dropped into a section with no stories showing. */
export function EmptySection() {
  const t = useTheme()
  return (
    <View
      style={[
        a.mt_md,
        a.p_xl,
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_medium,
        {borderStyle: 'dashed'},
      ]}>
      <Text style={[a.text_sm, a.text_center, t.atoms.text_contrast_medium]}>
        <Trans>
          Drop stories here, add one with +, or choose what fills it.
        </Trans>
      </Text>
    </View>
  )
}

/** Adds a section below another, in the editor. */
export function AddSectionButton({
  disabled,
  onPress,
}: {
  disabled: boolean
  onPress: () => void
}) {
  const {t: l} = useLingui()
  return (
    <View style={[a.align_center, a.pt_lg]}>
      <Button
        testID="addFrontpageSection"
        label={l`Add a section here`}
        size="small"
        color="secondary"
        disabled={disabled}
        onPress={onPress}>
        <ButtonIcon icon={PlusIcon} />
        <ButtonText>
          <Trans>Add section</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}

/** A section's title and description, for adding a section or editing one. */
export function SectionForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<SectionText>
  submitLabel: string
  onSubmit: (value: SectionText) => void
}) {
  const {t: l} = useLingui()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [kind, setKind] = useState<SectionKind>(initial?.kind ?? 'grid')
  function submit() {
    onSubmit({
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      kind,
    })
  }
  return (
    <View testID="frontpageSectionForm" style={[a.gap_md]}>
      <Toggle.Group
        label={l`Section layout`}
        type="radio"
        values={[kind]}
        onChange={values =>
          setKind(values[0] === 'carousel' ? 'carousel' : 'grid')
        }>
        <View style={[a.gap_sm]}>
          <Toggle.Item name="grid" label={l`Stories`}>
            <Toggle.Radio />
            <Toggle.LabelText>
              <Trans>
                Stories – posts, feeds and starter packs in the grid
              </Trans>
            </Toggle.LabelText>
          </Toggle.Item>
          <Toggle.Item name="carousel" label={l`Carousel`}>
            <Toggle.Radio />
            <Toggle.LabelText>
              <Trans>Carousel – a row of posts that scrolls sideways</Trans>
            </Toggle.LabelText>
          </Toggle.Item>
        </View>
      </Toggle.Group>
      <View>
        <TextField.LabelText>
          <Trans>Title (optional)</Trans>
        </TextField.LabelText>
        <TextField.Root>
          <Dialog.Input
            testID="frontpageSectionTitle"
            label={l`Section title`}
            placeholder={l`e.g. Politics`}
            value={title}
            onChangeText={setTitle}
            maxLength={MAX_SECTION_TITLE}
            onSubmitEditing={submit}
          />
        </TextField.Root>
      </View>
      <View>
        <TextField.LabelText>
          <Trans>Description (optional)</Trans>
        </TextField.LabelText>
        <TextField.Root>
          <Dialog.Input
            testID="frontpageSectionDescription"
            label={l`Section description`}
            placeholder={l`What this section covers`}
            value={description}
            onChangeText={setDescription}
            maxLength={MAX_SECTION_DESCRIPTION}
            multiline
            numberOfLines={3}
          />
        </TextField.Root>
      </View>
      <Button
        testID="saveFrontpageSection"
        label={submitLabel}
        color="primary"
        size="large"
        onPress={submit}>
        <ButtonText>{submitLabel}</ButtonText>
      </Button>
    </View>
  )
}

/** Adds a section, or renames one, with a title and description. */
export function SectionDialog({
  control,
  section,
  onSave,
}: {
  control: Dialog.DialogControlProps
  /** The section being edited; a new section when unset. */
  section?: FrontpageSection
  onSave: (value: SectionText) => void
}) {
  const {t: l} = useLingui()
  const heading = section ? l`Edit section` : l`Add section`
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={heading} style={web({maxWidth: 480})}>
        <View style={[a.gap_md]}>
          <Text style={[a.text_2xl, a.font_bold]}>{heading}</Text>
          <SectionForm
            key={section?.id ?? 'new'}
            initial={section}
            submitLabel={section ? l`Save section` : l`Add section`}
            onSubmit={value => control.close(() => onSave(value))}
          />
        </View>
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}
