import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {useQuery} from '@tanstack/react-query'

import {type NavigationProp} from '#/lib/routes/types'
import {useSession} from '#/state/session'
import {Button, ButtonText} from '#/components/Button'
import {useHalloween} from '#/features/halloween/context'
import {fetchCostumeRecord} from '#/features/halloween/costumes/records'

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
  const {data: costume} = useQuery({
    queryKey: ['halloweenCostume', profile.did],
    queryFn: () => fetchCostumeRecord(profile.did),
    enabled: isHalloween && currentAccount?.did === profile.did,
    staleTime: 30_000,
  })
  if (!isHalloween || currentAccount?.did !== profile.did) return null
  return (
    <Button
      testID="drawCostumeButton"
      size="small"
      color="secondary"
      label={costume ? l`Edit costume` : l`Draw costume`}
      onPress={() => navigation.navigate('CostumeEditor')}>
      <ButtonText>
        {costume ? <Trans>Edit costume</Trans> : <Trans>Draw costume</Trans>}
      </ButtonText>
    </Button>
  )
}
