import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {PlusSmall_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {Text} from '#/components/Typography'
import {hiddenLinkRefs, planProfileLinksSave} from '../legacy'
import {useLegacyWebsiteCheck} from '../legacyState'
import {PILL_LEFT, PILL_RIGHT_TEXT, PILL_VERTICAL} from '../pillSize'
import {buildProfileRow, reorderLinks} from '../row'
import {
  MAX_PROFILE_LINKS,
  type OwnProfileLinks,
  type ProfileLink,
} from '../types'
import {LinkFormDialog} from './LinkFormDialog'
import {linkLabel, type PillA11yActions, ProfileLinkPill} from './LinkPill'
import {type SortableItem, SortablePills} from './SortablePills'

/**
 * The Links section of Edit Profile: the links as a wrapping row of pills, an
 * "Add link" pill at the end, and drag to reorder. Tapping a pill opens the
 * form for that link. Changes stay local until the profile is saved.
 */
export function ProfileLinksEditor({
  did,
  links,
  snapshot,
  canEdit = true,
  onChange,
  onEditStart,
  onDragStateChange,
}: {
  /** The owner, whose repo holds the links' stored icons. */
  did: string
  links: ProfileLink[]
  snapshot: OwnProfileLinks
  canEdit?: boolean
  onChange: (links: ProfileLink[]) => void
  /** Freeze the parent snapshot before opening a link form. */
  onEditStart?: () => void
  onDragStateChange?: (dragging: boolean) => void
}) {
  const {t: l} = useLingui()
  const formControl = useDialogControl()
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const editing = editingIndex === null ? null : links[editingIndex]
  const usedSlots = links.length + hiddenLinkRefs(snapshot).length
  const legacy = links.find(link => link.legacyWebsite !== undefined)
  let needsRepair = false
  let overCapacity = false
  try {
    needsRepair = !!legacy && !!planProfileLinksSave(snapshot, links).website
  } catch {
    overCapacity = true
  }
  const {data: safelinkAction} = useLegacyWebsiteCheck(
    canEdit && !needsRepair && !overCapacity ? legacy?.url : undefined,
  )

  const row = buildProfileRow(links, false)
  const rowKeys = row.map(item => item.key)

  const openForm = (index: number | null) => {
    onEditStart?.()
    setEditingIndex(index)
    formControl.open()
  }

  const moveBy = (key: string, offset: number) => {
    const from = rowKeys.indexOf(key)
    const to = from + offset
    if (from < 0 || to < 0 || to >= rowKeys.length) return
    const next = [...rowKeys]
    next.splice(from, 1)
    next.splice(to, 0, key)
    onChange(reorderLinks(next, links))
  }

  const a11yActionsFor = (key: string): PillA11yActions => ({
    accessibilityActions: [
      {name: 'moveEarlier', label: l`Move earlier`},
      {name: 'moveLater', label: l`Move later`},
    ],
    onAccessibilityAction: event => {
      if (event.nativeEvent.actionName === 'moveEarlier') moveBy(key, -1)
      if (event.nativeEvent.actionName === 'moveLater') moveBy(key, 1)
    },
  })

  const items: SortableItem[] = row.flatMap(item => {
    if (item.type !== 'link') return []
    const index = links.indexOf(item.link)
    return {
      key: item.key,
      label: linkLabel(item.link),
      node: (
        <ProfileLinkPill
          did={did}
          link={item.link}
          label={l`Edit ${linkLabel(item.link)}`}
          onPress={
            canEdit || item.link.legacyWebsite !== undefined
              ? () => openForm(index)
              : undefined
          }
          handle={canEdit}
          testID="profileLinkEditorPill"
          a11yActions={canEdit ? a11yActionsFor(item.key) : undefined}
        />
      ),
      ghost: <ProfileLinkPill link={item.link} did={did} handle />,
    }
  })

  return (
    <View>
      <TextField.LabelText>
        <Trans>Links</Trans>
      </TextField.LabelText>
      {canEdit ? (
        <SortablePills
          items={items}
          onReorder={keys => onChange(reorderLinks(keys, links))}
          onDragStateChange={onDragStateChange}
          trailing={
            usedSlots < MAX_PROFILE_LINKS ? (
              <AddLinkPill onPress={() => openForm(null)} />
            ) : null
          }
        />
      ) : (
        <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
          {items.map(item => (
            <View key={item.key}>{item.node}</View>
          ))}
        </View>
      )}
      {overCapacity && canEdit && (
        <Text style={a.mt_sm}>
          <Trans>
            You can save up to 10 links. Remove a link before saving.
          </Trans>
        </Text>
      )}
      {safelinkAction === 'block' && legacy && canEdit && (
        <Text style={a.mt_sm}>
          <Trans>
            Your existing link is kept, but it’s blocked by the link safety
            service. Edit or remove it to update your links.
          </Trans>
        </Text>
      )}
      {needsRepair && canEdit && (
        <Text style={a.mt_sm}>
          <Trans>
            Your existing link is kept. Update it to a supported secure link, or
            remove another link if your list is full.
          </Trans>
        </Text>
      )}
      <LinkFormDialog
        control={formControl}
        link={editing}
        removeOnly={!canEdit}
        existingUrls={links
          .filter((_, i) => i !== editingIndex)
          .map(link => link.url)}
        onSave={saved =>
          onChange(
            editingIndex === null
              ? [...links, saved]
              : links.map((link, i) => (i === editingIndex ? saved : link)),
          )
        }
        onRemove={
          editingIndex === null
            ? undefined
            : () => onChange(links.filter((_, i) => i !== editingIndex))
        }
      />
    </View>
  )
}

function AddLinkPill({onPress}: {onPress: () => void}) {
  const {t: l} = useLingui()
  const t = useTheme()
  return (
    <Button
      testID="profileLinkAddBtn"
      label={l`Add a link`}
      size="small"
      color="secondary"
      variant="outline"
      onPress={onPress}
      style={{
        // the outline variant draws a hairline on native; this wants a full point
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: t.palette.contrast_600,
        paddingVertical: PILL_VERTICAL,
        paddingLeft: PILL_LEFT,
        paddingRight: PILL_RIGHT_TEXT,
      }}>
      <ButtonIcon icon={PlusIcon} />
      <ButtonText style={{marginLeft: -2}}>
        <Trans>Add link</Trans>
      </ButtonText>
    </Button>
  )
}
