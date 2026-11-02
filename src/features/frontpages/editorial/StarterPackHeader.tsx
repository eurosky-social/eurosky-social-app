import {useEffect, useRef} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {sanitizeHandle} from '#/lib/strings/handles'
import {updateProfileShadow} from '#/state/cache/profile-shadow'
import {getAllListMembers} from '#/state/queries/list-members'
import {
  useAppviewClient,
  usePdsClient,
  useRequireAuth,
  useSession,
} from '#/state/session'
import {bulkWriteFollows} from '#/screens/Onboarding/util'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Group3_Stroke2_Corner0_Rounded as PeopleIcon} from '#/components/icons/Group3'
import {Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {useStarterPackLink} from '#/components/StarterPack/StarterPackCard'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {starterPackFollowCandidates} from './starterPack'

/** Keep the action beside the title and outside the starter-pack navigation link. */
export function StarterPackHeader({
  pack,
  disabled = false,
}: {
  pack: bsky.starterPack.AnyStarterPackView
  disabled?: boolean
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const {currentAccount} = useSession()
  const {to, label, precache} = useStarterPackLink({view: pack})
  if (!bsky.matches(app.bsky.graph.starterpack, pack.record)) return null
  return (
    <View style={[a.gap_md]}>
      <View style={[a.flex_row, a.flex_wrap, a.align_center, a.gap_md]}>
        <Link
          to={to}
          label={label}
          onPress={precache}
          style={[
            a.flex_1,
            a.flex_row,
            a.align_center,
            a.gap_sm,
            {minWidth: 160},
          ]}>
          <PeopleIcon width={32} height={32} fill={t.palette.primary_500} />
          <View style={[a.flex_1, {minWidth: 0}]}>
            <Text emoji numberOfLines={2} style={[a.text_md, a.font_semi_bold]}>
              {pack.record.name}
            </Text>
            <Text
              numberOfLines={1}
              style={[a.text_sm, t.atoms.text_contrast_medium]}>
              {pack.creator.did === currentAccount?.did
                ? l`Starter Pack by you`
                : l`Starter Pack by ${sanitizeHandle(pack.creator.handle, '@')}`}
            </Text>
          </View>
        </Link>
        <FollowAll
          key={currentAccount?.did ?? 'logged-out'}
          pack={pack}
          list={pack.record.list}
          disabled={disabled}
        />
      </View>
      {!!pack.record.description && (
        <Text emoji numberOfLines={3} style={[a.leading_snug]}>
          {pack.record.description}
        </Text>
      )}
    </View>
  )
}

function FollowAll({
  pack,
  list,
  disabled,
}: {
  pack: bsky.starterPack.AnyStarterPackView
  list: app.bsky.graph.starterpack.Main['list']
  disabled: boolean
}) {
  const {t: l} = useLingui()
  const requireAuth = useRequireAuth()
  const {currentAccount} = useSession()
  const appview = useAppviewClient()
  const pds = usePdsClient()
  const queryClient = useQueryClient()
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const mutation = useMutation({
    async mutationFn() {
      if (!currentAccount || pds.assertDid !== currentAccount.did)
        throw new Error('Not authenticated')
      const members = await getAllListMembers(appview, list)
      const dids = starterPackFollowCandidates(members, currentAccount.did)
      if (!dids.length) return 0
      const follows = await bulkWriteFollows(pds, appview, dids, {
        uri: pack.uri,
        cid: pack.cid,
      })
      if (active.current)
        for (const did of dids)
          updateProfileShadow(queryClient, did, {
            followingUri: follows.get(did),
          })
      return dids.length
    },
    onSuccess(count) {
      if (active.current)
        Toast.show(
          count
            ? l`All accounts have been followed!`
            : l`No new accounts to follow.`,
        )
    },
    onError() {
      if (active.current)
        Toast.show(l`Couldn’t follow this starter pack. Try again.`, {
          type: 'error',
        })
    },
  })
  return (
    <Button
      testID="starterPackFollowAll"
      label={mutation.isSuccess ? l`Done` : l`Follow all`}
      size="small"
      color="primary"
      disabled={disabled || mutation.isPending || mutation.isSuccess}
      onPress={() => requireAuth(() => mutation.mutate())}>
      <ButtonText>
        {mutation.isSuccess ? <Trans>Done</Trans> : <Trans>Follow all</Trans>}
      </ButtonText>
      {mutation.isPending && <ButtonIcon icon={Loader} />}
    </Button>
  )
}
