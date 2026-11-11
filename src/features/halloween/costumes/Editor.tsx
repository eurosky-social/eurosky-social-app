import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {useSession} from '#/state/session'
import {Button, ButtonText} from '#/components/Button'
import {useHalloween} from '#/features/halloween/context'

/** The editor is a normal route, not a dialog; drafts live only on that screen. */
export function CostumeButton({
  profile,
}: {
  profile: {did: string; avatar?: string}
}) {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const {isHalloween} = useHalloween()
  const {currentAccount} = useSession()
  if (!isHalloween || currentAccount?.did !== profile.did) return null
  return (
    <Button
      testID="drawCostumeButton"
      size="small"
      color="secondary"
      label={l`Costume`}
      onPress={() => navigation.navigate('CostumeEditor')}>
      <ButtonText>
        <Trans>Costume</Trans>
      </ButtonText>
    </Button>
  )
}
