import {Trans, useLingui} from '@lingui/react/macro'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {cleanError, isNetworkError} from '#/lib/strings/errors'
import {logger} from '#/logger'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useRequireAuth, useSession} from '#/state/session'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Toast from '#/components/Toast'
import {CandyIcon} from '#/features/halloween/CandyIcon'
import {
  giveProfileCandy,
  hasGivenProfileCandy,
} from '#/features/halloween/candyRecords'
import {useHalloween} from '#/features/halloween/context'
import {fetchCostumeRecord} from '#/features/halloween/costumes/records'

const profileCandyQueryKeyRoot = 'profile-candy'
const createProfileCandyQueryKey = (senderDid: string, subject: string) =>
  createQueryKey(profileCandyQueryKeyRoot, {senderDid, subject})

/** Profile gifts are separate records, not likes on an optional costume post. */
export function GiveCandyButton({did}: {did: string}) {
  const {t: l} = useLingui()
  const client = usePdsClient()
  const {currentAccount} = useSession()
  const queryClient = useQueryClient()
  const requireAuth = useRequireAuth()
  const {isHalloween} = useHalloween()
  const isSelf = currentAccount?.did === did
  const {data} = useQuery({
    queryKey: ['halloweenCostume', did],
    queryFn: () => fetchCostumeRecord(did),
    staleTime: STALE.SECONDS.THIRTY,
    enabled: isHalloween && !isSelf,
  })
  const {data: hasGivenCandy} = useQuery({
    queryKey: createProfileCandyQueryKey(currentAccount?.did ?? '', did),
    queryFn: ({signal}) =>
      hasGivenProfileCandy(currentAccount!.did, did, signal),
    staleTime: STALE.MINUTES.ONE,
    enabled: isHalloween && !!data && !!currentAccount && !isSelf,
  })
  const gift = useMutation({
    mutationFn: async () => {
      const senderDid = client.assertDid
      const subject = did
      await giveProfileCandy(client, subject)
      return {senderDid, subject}
    },
    /* A timed-out write may have succeeded; never create duplicate gifts via automatic retries. */
    retry: false,
    onSuccess: async ({senderDid, subject}) => {
      const queryKey = createProfileCandyQueryKey(senderDid, subject)
      /* An in-flight index read may predate this gift; keep the confirmed write visible. */
      await queryClient.cancelQueries({queryKey, exact: true})
      queryClient.setQueryData(queryKey, true)
      Toast.show(l`Candy given!`)
    },
    onError: error => {
      if (!isNetworkError(error))
        logger.error('Failed to give profile candy', {safeMessage: error})
      const reason = cleanError(error)
      Toast.show(l`Could not give candy. ${reason}`, {type: 'error'})
    },
  })
  /* Candy is for other people; your own profile shows the costume studio instead. */
  if (!isHalloween || !data || isSelf) return null
  return (
    <Button
      testID="profileGiveCandy"
      size="small"
      color={hasGivenCandy ? 'primary_subtle' : 'secondary'}
      label={
        gift.isPending
          ? l`Giving candy…`
          : hasGivenCandy
            ? l`Give more candy`
            : l`Give candy`
      }
      disabled={gift.isPending}
      onPress={() => {
        if (gift.isPending || !isHalloween || !data) return
        requireAuth(() => gift.mutate())
      }}>
      <ButtonIcon icon={CandyIcon} />
      <ButtonText>
        {gift.isPending ? (
          <Trans>Giving candy…</Trans>
        ) : hasGivenCandy ? (
          <Trans>Give more candy</Trans>
        ) : (
          <Trans>Give candy</Trans>
        )}
      </ButtonText>
    </Button>
  )
}
