import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {logger} from '#/logger'
import {usePdsClient, useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {usePatchAgeAssuranceOtherRequiredData} from '#/ageAssurance'
import {setBirthdateForDid} from '#/ageAssurance/data'
import {birthdateFromFlags, setMuAgeStatus} from '#/ageAssurance/muAgeService'

/**
 * Oso age confirmation, shown inline on the gate. "18 or older" is saved to the
 * mu age service. "Under 18" is not saved anywhere; the gate shows the under-18
 * message until the page is reloaded.
 */
export function AgeConfirmation({
  showNote = true,
  onDeclareMinor,
}: {
  /**
   * Show the privacy note. Off when the surrounding text already explains it.
   */
  showNote?: boolean
  /**
   * Called when the user answers "I am under 18".
   */
  onDeclareMinor: () => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const pdsClient = usePdsClient()
  const {currentAccount} = useSession()
  const patch = usePatchAgeAssuranceOtherRequiredData()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState('')

  const onConfirmAdult = async () => {
    setError('')
    setIsPending(true)
    try {
      const flags = {over13: true, over16: true, over18: true}
      await setMuAgeStatus(pdsClient, flags)
      const birthdate = birthdateFromFlags(flags)
      if (currentAccount?.did) {
        setBirthdateForDid({did: currentAccount.did, birthdate})
      }
      patch({birthdate})
    } catch (e) {
      logger.error('AgeConfirmation: save failed', {
        safeMessage: String(e),
      })
      setError(l`Something went wrong. Please try again.`)
    } finally {
      // The gate may stay up (e.g. a blocked region), so don't leave it spinning.
      setIsPending(false)
    }
  }

  return (
    <View style={[a.gap_md]}>
      {showNote && (
        <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            This is a one-time thing. It’s private and not shared with other
            users.
          </Trans>
        </Text>
      )}

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
