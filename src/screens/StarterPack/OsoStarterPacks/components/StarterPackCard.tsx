import {useState} from 'react'
import {type GestureResponderEvent, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useQueryClient} from '@tanstack/react-query'

import {batchedUpdates} from '#/lib/batchedUpdates'
import {isBlockedOrBlocking, isMuted} from '#/lib/moderation/blocked-and-muted'
import {sanitizeHandle} from '#/lib/strings/handles'
import {logger} from '#/logger'
import {updateProfileShadow} from '#/state/cache/profile-shadow'
import {getAllListMembers} from '#/state/queries/list-members'
import {useAppviewClient, usePdsClient, useSession} from '#/state/session'
import {LoadingPlaceholder} from '#/view/com/util/LoadingPlaceholder'
import {bulkWriteFollows} from '#/screens/Onboarding/util'
import {AvatarStack} from '#/screens/Search/components/StarterPackCard'
import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {useStarterPackLink} from '#/components/StarterPack/StarterPackCard'
import {SubtleHover} from '#/components/SubtleHover'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'

/**
 * Copy of the large Explore card (`#/screens/Search/components/StarterPackCard`)
 * with a "Follow all" button added. Kept separate so the upstream card stays
 * untouched.
 */
export function StarterPackCard({
  view,
  onPress,
}: {
  view: app.bsky.graph.defs.StarterPackView
  onPress?: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {hasSession, currentAccount} = useSession()
  const {gtPhone} = useBreakpoints()
  const link = useStarterPackLink({view})
  const record = view.record
  const isOwnStarterPack = view.creator?.did === currentAccount?.did

  if (!bsky.isType(app.bsky.graph.starterpack, record)) {
    return null
  }

  const profileCount = gtPhone ? 11 : 8
  const profiles = view.listItemsSample
    ?.slice(0, profileCount)
    .map(item => item.subject)

  return (
    <Link
      to={link.to}
      label={link.label}
      onHoverIn={link.precache}
      onPress={() => {
        link.precache()
        onPress?.()
      }}>
      {s => (
        <>
          <SubtleHover hover={s.hovered || s.pressed} />

          <View
            style={[
              a.w_full,
              a.p_lg,
              a.gap_md,
              a.border,
              a.rounded_sm,
              a.overflow_hidden,
              t.atoms.border_contrast_low,
            ]}>
            <AvatarStack
              profiles={profiles ?? []}
              numPending={profileCount}
              total={view.list?.listItemCount}
            />

            <View
              style={[
                a.w_full,
                a.flex_row,
                a.align_start,
                a.gap_lg,
                web({
                  position: 'static',
                  zIndex: 'unset',
                }),
              ]}>
              <View style={[a.flex_1]}>
                <Text
                  emoji
                  style={[a.text_md, a.font_semi_bold, a.leading_snug]}
                  numberOfLines={1}>
                  {record.name}
                </Text>
                <Text
                  emoji
                  style={[
                    a.text_sm,
                    a.leading_snug,
                    t.atoms.text_contrast_medium,
                  ]}
                  numberOfLines={1}>
                  {isOwnStarterPack
                    ? l`By you`
                    : l`By ${sanitizeHandle(view.creator.handle, '@')}`}
                </Text>
              </View>
              <View style={[a.flex_row, a.gap_sm]}>
                {hasSession && view.list && <FollowAllButton view={view} />}
                <Link
                  to={link.to}
                  label={link.label}
                  onHoverIn={link.precache}
                  onPress={() => {
                    link.precache()
                    onPress?.()
                  }}
                  variant="solid"
                  color="secondary"
                  size="small"
                  style={[a.z_50]}>
                  <ButtonText>
                    <Trans>Open pack</Trans>
                  </ButtonText>
                </Link>
              </View>
            </View>
          </View>
        </>
      )}
    </Link>
  )
}

/**
 * Follows every member of the pack, skipping yourself, accounts you already
 * follow, and blocked or muted accounts. Same logic as the onboarding card.
 */
function FollowAllButton({view}: {view: app.bsky.graph.defs.StarterPackView}) {
  const {t: l} = useLingui()
  const ax = useAnalytics()
  const {currentAccount} = useSession()
  const appviewClient = useAppviewClient()
  const pdsClient = usePdsClient()
  const queryClient = useQueryClient()
  const [isProcessing, setIsProcessing] = useState(false)
  const [isFollowingAll, setIsFollowingAll] = useState(false)

  const onFollowAll = async () => {
    if (!view.list) return

    setIsProcessing(true)

    let dids: string[]
    let followUris: Map<string, string>
    try {
      const listItems = await getAllListMembers(appviewClient, view.list.uri)
      dids = listItems
        .filter(
          li =>
            li.subject.did !== currentAccount?.did &&
            !isBlockedOrBlocking(li.subject) &&
            !isMuted(li.subject) &&
            !li.subject.viewer?.following,
        )
        .map(li => li.subject.did)
      followUris = await bulkWriteFollows(pdsClient, appviewClient, dids, {
        uri: view.uri,
        cid: view.cid,
      })
    } catch (e) {
      setIsProcessing(false)
      Toast.show(l`An error occurred while trying to follow all`, {
        type: 'error',
      })
      logger.error('Failed to follow all accounts in Starter Pack', {
        safeMessage: e,
      })
      return
    }

    setIsFollowingAll(true)
    setIsProcessing(false)
    batchedUpdates(() => {
      for (const did of dids) {
        updateProfileShadow(queryClient, did, {
          followingUri: followUris.get(did),
        })
      }
    })
    Toast.show(l`All accounts have been followed!`, {type: 'success'})
    ax.metric('starterPack:followAll', {
      logContext: 'OsoStarterPacks',
      starterPack: view.uri,
      count: dids.length,
    })
  }

  return (
    <Button
      label={l`Follow all`}
      disabled={isProcessing || isFollowingAll}
      onPress={(e: GestureResponderEvent) => {
        // The whole card is a link; don't open the pack.
        e.preventDefault()
        e.stopPropagation()
        void onFollowAll()
      }}
      color="primary"
      size="small"
      style={[a.z_50]}>
      <ButtonText>
        <Trans>Follow all</Trans>
      </ButtonText>
      {isFollowingAll ? (
        <ButtonIcon icon={CheckIcon} />
      ) : (
        isProcessing && <ButtonIcon icon={Loader} />
      )}
    </Button>
  )
}

export function StarterPackCardSkeleton() {
  const t = useTheme()
  const {gtPhone} = useBreakpoints()

  const profileCount = gtPhone ? 11 : 8

  return (
    <View
      style={[
        a.w_full,
        a.p_lg,
        a.gap_md,
        a.border,
        a.rounded_sm,
        a.overflow_hidden,
        t.atoms.border_contrast_low,
      ]}>
      <AvatarStack profiles={[]} numPending={profileCount} />

      <View
        style={[
          a.w_full,
          a.flex_row,
          a.align_start,
          a.gap_lg,
          web({
            position: 'static',
            zIndex: 'unset',
          }),
        ]}>
        <View style={[a.flex_1, a.gap_xs]}>
          <LoadingPlaceholder width={180} height={18} />
          <LoadingPlaceholder width={120} height={14} />
        </View>

        <LoadingPlaceholder width={100} height={33} />
      </View>
    </View>
  )
}
