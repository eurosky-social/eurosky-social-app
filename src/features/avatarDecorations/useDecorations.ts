import {type TextStyle} from 'react-native'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useAgent, useSession} from '#/state/session'
import {BRAND} from '#/config/brand'
import {type DecorationFrame, getFrame} from './catalog'
import {getNameGradient, type NameGradient} from './nameGradients'
import {nameGradientTextStyle} from './nameGradientStyle'
import {
  type DecorationSettings,
  getDecorationGrantIssuers,
  getDecorationSettings,
  SETTINGS_COLLECTION,
  SETTINGS_RKEY,
} from './records'

const decorationsQueryKeyRoot = 'decorations'
export const createDecorationsQueryKey = (did: string) =>
  createQueryKey(decorationsQueryKeyRoot, {did})

/**
 * Resolves a DID's *active* decoration slots: the settings record, but only
 * when an allowlisted grant exists (returns null otherwise). Both slot hooks
 * share this one query - react-query dedupes by key, so a DID is resolved
 * once per staleTime no matter how many avatars/names reference it.
 *
 * Same per-DID shape and hot-path volume as useMuVerificationQuery (which runs
 * for every feed item via ProfileBadges), but lazier - cosmetics tolerate
 * staleness better than verification. Disabled when the issuer allowlist is
 * empty (feature off).
 */
function useActiveDecorations(
  did: string | undefined,
): DecorationSettings | null {
  const issuerDids = BRAND.decorations.issuerDids
  const {data} = useQuery<DecorationSettings | null>({
    queryKey: createDecorationsQueryKey(did ?? ''),
    enabled: !!did && issuerDids.length > 0,
    staleTime: STALE.MINUTES.THIRTY,
    queryFn: async () => {
      const issuers = await getDecorationGrantIssuers(did!)
      if (!issuerDids.some(issuer => issuers.has(issuer))) return null
      return await getDecorationSettings(did!)
    },
  })
  return data ?? null
}

/** Active avatar frame for a DID, or undefined. */
export function useAvatarDecoration(
  did: string | undefined,
): DecorationFrame | undefined {
  return getFrame(useActiveDecorations(did)?.avatar)
}

/** Active display-name gradient for a DID, or undefined. */
export function useNameGradient(
  did: string | undefined,
): NameGradient | undefined {
  return getNameGradient(useActiveDecorations(did)?.name)
}

/**
 * Computed text style for a DID's display name (gradient + optional outline),
 * or undefined. Spread into a name's style array at the call site so both the
 * gradient and the outline resolve in one place.
 */
export function useNameStyle(did: string | undefined): TextStyle | undefined {
  const active = useActiveDecorations(did)
  const gradient = getNameGradient(active?.name)
  if (!gradient) return undefined
  return nameGradientTextStyle(gradient, {outline: !!active?.nameOutline})
}

const myDecorationSettingsQueryKeyRoot = 'my-decoration-settings'

/**
 * The current account's own settings record, ungated by any grant - used by
 * the settings screen so you can pick and preview choices whether or not your
 * subscription is currently active (the choices are inert without a grant, but
 * still yours to set). Returns {} until loaded.
 */
export function useMyDecorationSettings(): DecorationSettings {
  const {currentAccount} = useSession()
  const {data} = useQuery<DecorationSettings>({
    queryKey: createQueryKey(myDecorationSettingsQueryKeyRoot, {
      did: currentAccount?.did ?? '',
    }),
    enabled: !!currentAccount,
    staleTime: STALE.MINUTES.ONE,
    queryFn: () => getDecorationSettings(currentAccount!.did),
  })
  return data ?? {}
}

// Constellation/slingshot lag a few seconds behind the firehose, so after a
// write we invalidate immediately and again once the index has caught up.
const INDEX_DELAY = 8e3

/**
 * Writes the current account's settings record, merging `patch` over whatever
 * is already there (putRecord replaces the whole record, so we read-modify-
 * write). Pass a slot as undefined to clear it, e.g. `{name: undefined}`.
 */
export function useSetDecorations() {
  const agent = useAgent()
  const qc = useQueryClient()
  const {currentAccount} = useSession()

  return useMutation({
    async mutationFn(patch: Partial<DecorationSettings>) {
      if (!currentAccount) throw new Error('User not logged in')
      const did = currentAccount.did
      const current = await getDecorationSettings(did)
      const next: DecorationSettings = {...current, ...patch}
      await agent.com.atproto.repo.putRecord({
        repo: did,
        collection: SETTINGS_COLLECTION,
        rkey: SETTINGS_RKEY,
        record: {
          $type: SETTINGS_COLLECTION,
          ...(next.avatar ? {avatar: next.avatar} : {}),
          ...(next.name ? {name: next.name} : {}),
          ...(next.name && next.nameOutline ? {nameOutline: true} : {}),
          updatedAt: new Date().toISOString(),
        },
      })
      return next
    },
    onSuccess(next) {
      if (!currentAccount) return
      const did = currentAccount.did
      qc.setQueryData(
        createQueryKey(myDecorationSettingsQueryKeyRoot, {did}),
        next,
      )
      const activeKey = createDecorationsQueryKey(did)
      void qc.invalidateQueries({queryKey: activeKey})
      setTimeout(
        () => void qc.invalidateQueries({queryKey: activeKey}),
        INDEX_DELAY,
      )
    },
  })
}
