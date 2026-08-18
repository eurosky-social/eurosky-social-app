import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme, web} from '#/alf'
import * as Dialog from '#/components/Dialog'
import * as Toggle from '#/components/forms/Toggle'
import {Text} from '#/components/Typography'
import {useKeyboardShortcutsPreference} from './preferences'

export function KeyboardShortcutsDialog({
  control,
  onOpen,
  onClose,
}: {
  control: Dialog.DialogControlProps
  onOpen?: () => void
  onClose?: () => void
}) {
  return (
    <Dialog.Outer
      control={control}
      onOpen={onOpen}
      onClose={onClose}
      nativeOptions={{preventExpansion: true}}
      webOptions={{alignCenter: true}}>
      <KeyboardShortcutsDialogInner />
    </Dialog.Outer>
  )
}

function KeyboardShortcutsDialogInner() {
  const {t: l} = useLingui()
  const t = useTheme()
  const {enabled, setEnabled} = useKeyboardShortcutsPreference()

  return (
    <Dialog.ScrollableInner
      label={l`Keyboard shortcuts`}
      style={web({
        maxWidth: 620,
        maxHeight: '80vh',
        overflowY: 'auto',
      })}>
      <View style={[a.gap_xl]}>
        <View style={[a.gap_xs]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>Keyboard shortcuts</Trans>
          </Text>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>
              Navigate and interact without taking your hands off the keyboard.
            </Trans>
          </Text>
        </View>

        <ShortcutGroup title={l`General`}>
          <ShortcutRow shortcut="?" label={l`Show keyboard shortcuts`} />
          <ShortcutRow shortcut="/" label={l`Focus search`} />
          <ShortcutRow shortcut="N" label={l`Compose a new post`} />
          <ShortcutRow shortcut="." label={l`Refresh the current feed`} />
          <ShortcutRow shortcut="Esc" label={l`Clear post selection`} />
          <ShortcutRow
            shortcut="Cmd/Ctrl Enter"
            label={l`Publish from the composer`}
          />
        </ShortcutGroup>

        <ShortcutGroup title={l`Go to`}>
          <ShortcutRow shortcut="G H" label={l`Home`} />
          <ShortcutRow shortcut="G W" label={l`News`} />
          <ShortcutRow shortcut="G E" label={l`Explore`} />
          <ShortcutRow shortcut="G N" label={l`Notifications`} />
          <ShortcutRow shortcut="G C" label={l`Chat`} />
          <ShortcutRow shortcut="G F" label={l`Feeds`} />
          <ShortcutRow shortcut="G L" label={l`Lists`} />
          <ShortcutRow shortcut="G B" label={l`Saved`} />
          <ShortcutRow shortcut="G P" label={l`Profile`} />
          <ShortcutRow shortcut="G S" label={l`Settings`} />
        </ShortcutGroup>

        <ShortcutGroup title={l`Selected post`}>
          <ShortcutRow shortcut="H" label={l`Return to the previous feed`} />
          <ShortcutRow shortcut="J" label={l`Select the next post`} />
          <ShortcutRow shortcut="K" label={l`Select the previous post`} />
          <ShortcutRow shortcut="B / Enter" label={l`Open the selected post`} />
          <ShortcutRow shortcut="O" label={l`Open the selected post’s image`} />
          <ShortcutRow shortcut="R" label={l`Reply to the selected post`} />
          <ShortcutRow
            shortcut="L"
            label={l`Like or unlike the selected post`}
          />
          <ShortcutRow shortcut="T" label={l`Repost or undo repost`} />
          <ShortcutRow shortcut="S" label={l`Open sharing options`} />
        </ShortcutGroup>

        <View
          style={[a.border_t, t.atoms.border_contrast_low, a.pt_lg, a.gap_xs]}>
          <Toggle.Item
            name="keyboard_shortcuts_dialog"
            label={l`Enable keyboard shortcuts`}
            value={enabled}
            onChange={setEnabled}>
            <Toggle.LabelText style={[a.flex_1]}>
              <Trans>Enable keyboard shortcuts</Trans>
            </Toggle.LabelText>
            <Toggle.Platform />
          </Toggle.Item>
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>
              This controls app shortcuts only. Standard keyboard behavior in
              forms, menus, and dialogs remains available.
            </Trans>
          </Text>
        </View>
      </View>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}

function ShortcutGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <View style={[a.gap_sm]}>
      <Text style={[a.text_lg, a.font_bold]}>{title}</Text>
      <View style={[a.gap_xs]}>{children}</View>
    </View>
  )
}

function ShortcutRow({shortcut, label}: {shortcut: string; label: string}) {
  const t = useTheme()

  return (
    <View style={[a.flex_row, a.align_center, a.justify_between, a.gap_lg]}>
      <Text style={[a.text_sm, t.atoms.text_contrast_high]}>{label}</Text>
      <View
        style={[
          a.rounded_sm,
          a.border,
          t.atoms.border_contrast_medium,
          t.atoms.bg_contrast_25,
          a.px_sm,
          a.py_2xs,
        ]}>
        <Text style={[a.text_xs, a.font_semi_bold]}>{shortcut}</Text>
      </View>
    </View>
  )
}
