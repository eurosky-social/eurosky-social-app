import {useEffect, useRef} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {getCurrentState} from '#/lib/appState'
import {useDialogStateContext} from '#/state/dialogs'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {usePolicyUpdateContext} from '#/components/PolicyUpdateOverlay'
import {Text} from '#/components/Typography'
import {useHalloween} from '#/features/halloween/context'

/** Lives in the NUX queue so seasonal invitations never replace another NUX. */
export function HalloweenInvitation({
  canOpen = true,
  onOpen,
  onClose,
}: {
  canOpen?: boolean
  onOpen?: () => void
  onClose: () => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const {shouldPrompt, setEnabled, dismissInvitation} = useHalloween()
  const {state: policy} = usePolicyUpdateContext()
  const {openDialogs} = useDialogStateContext()
  const control = Dialog.useDialogControl()
  const opened = useRef(false)

  useEffect(() => {
    if (!canOpen || !shouldPrompt || !policy.completed) {
      if (opened.current) control.close()
      return
    }
    if (opened.current) return

    let timer: ReturnType<typeof setTimeout>
    const tryOpen = () => {
      /* Native sheets and web portals must not stack over an existing dialog. */
      if (openDialogs.current.size || getCurrentState() !== 'active') {
        timer = setTimeout(tryOpen, 500)
        return
      }
      opened.current = true
      onOpen?.()
      control.open()
    }
    timer = setTimeout(tryOpen, 500)
    return () => clearTimeout(timer)
  }, [canOpen, shouldPrompt, policy.completed, openDialogs, control, onOpen])

  const handleClose = () => {
    if (!opened.current) return
    opened.current = false
    dismissInvitation()
    onClose()
  }

  return (
    <Dialog.Outer
      control={control}
      onClose={handleClose}
      testID="halloweenInvitation"
      nativeOptions={{preventExpansion: true}}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={l`A little Halloween magic?`}>
        <View style={[a.gap_lg]}>
          <Text emoji style={[a.text_4xl]} accessibilityElementsHidden>
            🎃
          </Text>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>A little Halloween magic?</Trans>
          </Text>
          <Text
            style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
            <Trans>
              Switch to dark mode with orange accents for Halloween, October
              28–31 in your local time. Your regular appearance returns on
              November 1.
            </Trans>
          </Text>
          <Text
            style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            <Trans>
              You can turn Halloween mode on or off in Settings → Appearance.
              Your choice is saved on this device for future Halloweens too.
            </Trans>
          </Text>
          <View style={[a.gap_sm]}>
            <Button
              testID="enableHalloweenMode"
              label={l`Turn on Halloween mode`}
              color="primary"
              size="large"
              onPress={() => control.close(() => setEnabled(true))}>
              <ButtonText>
                <Trans>Turn on Halloween mode</Trans>
              </ButtonText>
            </Button>
            <Button
              testID="dismissHalloweenMode"
              label={l`No thanks`}
              color="secondary"
              size="large"
              onPress={() => control.close()}>
              <ButtonText>
                <Trans>No thanks</Trans>
              </ButtonText>
            </Button>
          </View>
        </View>
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}
