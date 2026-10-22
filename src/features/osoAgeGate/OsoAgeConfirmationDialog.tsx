import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {logger} from '#/logger'
import {usePdsClient, useSession} from '#/state/session'
import {atoms as a, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {usePatchAgeAssuranceOtherRequiredData} from '#/ageAssurance'
import {setBirthdateForDid} from '#/ageAssurance/data'
import {birthdateFromFlags, setMuAgeStatus} from '#/ageAssurance/muAgeService'
import {useDeclaredUnder18} from '#/features/osoAgeGate/useOsoAgeGate'

/**
 * Oso age confirmation. "18 or older" is saved to the mu age service, like
 * MuAgeConfirmDialog. "Under 18" is only stored locally (see
 * `useDeclaredUnder18`) and keeps the user behind the gate.
 */
export function OsoAgeConfirmationDialog({
  control,
}: {
  control: Dialog.DialogControlProps
}) {
  const {t: l} = useLingui()
  return (
    <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={l`Confirm your age`}
        style={web({maxWidth: 400})}>
        <Inner control={control} />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function Inner({control}: {control: Dialog.DialogControlProps}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const pdsClient = usePdsClient()
  const {currentAccount} = useSession()
  const patch = usePatchAgeAssuranceOtherRequiredData()
  const [, setDeclaredUnder18] = useDeclaredUnder18()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState('')

  const onConfirmAdult = async () => {
    setError('')
    setIsPending(true)
    try {
      const flags = {over13: true, over16: true, over18: true}
      await setMuAgeStatus(pdsClient, flags)
      const birthdate = birthdateFromFlags(flags)
      control.close(() => {
        setDeclaredUnder18(false)
        if (currentAccount?.did) {
          setBirthdateForDid({did: currentAccount.did, birthdate})
        }
        patch({birthdate})
      })
    } catch (e) {
      logger.error('OsoAgeConfirmationDialog: save failed', {
        safeMessage: String(e),
      })
      setError(l`Something went wrong. Please try again.`)
      setIsPending(false)
    }
  }

  const onDeclareMinor = () => {
    control.close(() => {
      setDeclaredUnder18(true)
    })
  }

  return (
    <View style={[a.gap_md]}>
      <Text style={[a.text_xl, a.font_semi_bold]}>
        <Trans>Confirm your age</Trans>
      </Text>
      <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>
          This is a one-time thing. It’s private and not shared with other
          users.
        </Trans>
      </Text>

      {error ? <Admonition type="error">{error}</Admonition> : null}

      <View style={[a.gap_sm]}>
        <Button
          label={l`Confirm that you are 18 or older`}
          size="large"
          // Both answers look the same, so neither is suggested.
          color="secondary"
          onPress={() => void onConfirmAdult()}
          disabled={isPending}
          testID="osoAgeConfirmAdultButton">
          <ButtonText>
            <Trans>I am 18 or older</Trans>
          </ButtonText>
          {isPending && <ButtonIcon icon={Loader} />}
        </Button>
        <Button
          label={l`Confirm that you are under 18`}
          size="large"
          color="secondary"
          onPress={onDeclareMinor}
          disabled={isPending}
          testID="osoAgeDeclareMinorButton">
          <ButtonText>
            <Trans>I am under 18</Trans>
          </ButtonText>
        </Button>
      </View>
    </View>
  )
}
