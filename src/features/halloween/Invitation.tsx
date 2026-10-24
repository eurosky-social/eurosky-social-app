import {useEffect, useRef} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {getCurrentState} from '#/lib/appState'
import {type NavigationProp} from '#/lib/routes/types'
import {useDialogStateContext} from '#/state/dialogs'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {usePolicyUpdateContext} from '#/components/PolicyUpdateOverlay'
import {Text} from '#/components/Typography'
import {useHalloween} from '#/features/halloween/context'

/** The independent costume invitation always waits for the theme invitation to finish. */
export function HalloweenInvitation({
  kind = 'theme',
  canOpen = true,
  onOpen,
  onClose,
}: {
  kind?: 'theme' | 'costume'
  canOpen?: boolean
  onOpen?: () => void
  onClose: () => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const {
    shouldPrompt,
    shouldPromptCostume,
    setEnabled,
    dismissInvitation,
    dismissCostumeInvitation,
  } = useHalloween()
  const costume = kind === 'costume'
  const due = costume ? shouldPromptCostume && !shouldPrompt : shouldPrompt
  const {state: policy} = usePolicyUpdateContext()
  const {openDialogs} = useDialogStateContext()
  const control = Dialog.useDialogControl()
  const opened = useRef(false)

  useEffect(() => {
    if (!canOpen || !due || !policy.completed) {
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
  }, [canOpen, due, policy.completed, openDialogs, control, onOpen])

  const handleClose = () => {
    if (!opened.current) return
    opened.current = false
    if (costume) dismissCostumeInvitation()
    else dismissInvitation()
    onClose()
  }
  const title = costume
    ? l`Create a Halloween costume?`
    : l`A little Halloween magic?`

  return (
    <Dialog.Outer
      control={control}
      onClose={handleClose}
      testID={costume ? 'halloweenCostumeInvitation' : 'halloweenInvitation'}
      nativeOptions={{preventExpansion: true}}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={title}>
        <View style={[a.gap_lg]}>
          <Text emoji style={[a.text_4xl]} accessibilityElementsHidden>
            {costume ? '🎭' : '🎃'}
          </Text>
          <Text style={[a.text_2xl, a.font_bold]}>{title}</Text>
          <Text
            style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
            {costume ? (
              <Trans>
                Dress up your profile picture to collect candy. Sharing a
                costume post is optional. Costumes and candy are available
                October 28–November 3, whether or not you enable the Halloween
                theme.
              </Trans>
            ) : (
              <Trans>
                Switch to dark mode with orange accents for Halloween, October
                28–November 3 in your local time. Your regular appearance
                returns on November 4.
              </Trans>
            )}
          </Text>
          <Text
            style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            {costume ? (
              <Trans>
                You can also open the costume studio from your profile during
                Halloween. Nothing is uploaded until you confirm. Published
                profile pictures stay until you change them.
              </Trans>
            ) : (
              <Trans>
                You can turn the Halloween theme on or off in Settings →
                Appearance. This choice only changes the theme, not costumes or
                candy.
              </Trans>
            )}
          </Text>
          <View style={[a.gap_sm]}>
            <Button
              testID={
                costume ? 'createHalloweenCostume' : 'enableHalloweenMode'
              }
              label={costume ? l`Create costume` : l`Turn on Halloween theme`}
              color="primary"
              size="large"
              onPress={() =>
                control.close(() => {
                  if (costume) navigation.navigate('CostumeEditor')
                  else setEnabled(true)
                })
              }>
              <ButtonText>
                {costume ? (
                  <Trans>Create costume</Trans>
                ) : (
                  <Trans>Turn on Halloween theme</Trans>
                )}
              </ButtonText>
            </Button>
            <Button
              testID={
                costume ? 'dismissHalloweenCostume' : 'dismissHalloweenMode'
              }
              label={l`No thanks`}
              color="secondary"
              size="large"
              onPress={() =>
                control.close(() => {
                  if (!costume) setEnabled(false)
                })
              }>
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
