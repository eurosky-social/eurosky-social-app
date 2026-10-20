import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {useSession} from '#/state/session'
import {Button, ButtonText} from '#/components/Button'
import {useHalloween} from '#/features/halloween/context'
import {useCostumes} from '#/features/halloween/costumes/state'

/** The editor is a normal route, not a dialog; drafts live only on that screen. */
export function CostumeButton({
  profile,
}: {
  profile: {did: string; avatar?: string}
}) {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const {isActive} = useHalloween()
  const {currentAccount} = useSession()
  const {costumes} = useCostumes()
  if (!isActive || currentAccount?.did !== profile.did) return null
  return (
    <Button
      testID="drawCostumeButton"
      size="small"
      color="secondary"
      label={costumes[profile.did] ? l`Edit costume` : l`Draw costume`}
      onPress={() => navigation.navigate('CostumeEditor')}>
      <ButtonText>
        {costumes[profile.did] ? (
          <Trans>Edit costume</Trans>
        ) : (
          <Trans>Draw costume</Trans>
        )}
      </ButtonText>
    </Button>
  )
}
