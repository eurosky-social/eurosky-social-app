import {View} from 'react-native'
import {moderateProfile} from '@bsky/sdk/moderation'
import {Trans, useLingui} from '@lingui/react/macro'
import {useQuery} from '@tanstack/react-query'

import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient, useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {ContentHider} from '#/components/moderation/ContentHider'
import * as ProfileCard from '#/components/ProfileCard'
import {useStarterPackLink} from '#/components/StarterPack/StarterPackCard'
import {Text} from '#/components/Typography'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'

/** Show real members, not the creator or a decorative facepile. */
export function StarterPackPeople({
  pack,
}: {
  pack: bsky.starterPack.AnyStarterPackView
}) {
  const client = useAppviewClient()
  const {currentAccount} = useSession()
  const opts = useModerationOpts()
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const packLink = useStarterPackLink({view: pack})
  const packCount =
    'list' in pack
      ? pack.list?.listItemCount
      : 'listItemCount' in pack
        ? pack.listItemCount
        : undefined
  const sample = 'listItemsSample' in pack ? pack.listItemsSample : undefined
  const list = bsky.matches(app.bsky.graph.starterpack, pack.record)
    ? pack.record.list
    : undefined
  const query = useQuery({
    queryKey: createQueryKey('editorialStarterPackPeople', {
      uri: pack.uri,
      viewer: currentAccount?.did,
    }),
    staleTime: STALE.MINUTES.ONE,
    enabled: !!opts && !!list && (!sample?.length || packCount === undefined),
    queryFn: async () => {
      if (!list) throw new Error('Missing starter-pack list')
      return client.call(app.bsky.graph.getList, {list, limit: 12})
    },
  })
  const seen = new Set<string>()
  const candidates = sample?.length ? sample : (query.data?.items ?? [])
  const eligible = candidates.filter(item => {
    if (item.subjectOptedOut || seen.has(item.subject.did)) return false
    seen.add(item.subject.did)
    return (
      !opts || !moderateProfile(item.subject, opts).ui('profileList').filter
    )
  })
  const people = eligible.slice(0, 6)
  const rawTotal = packCount ?? query.data?.list.listItemCount
  const total =
    rawTotal === undefined
      ? undefined
      : Math.max(0, rawTotal - (candidates.length - eligible.length))
  const more =
    total === undefined ? undefined : Math.max(0, total - people.length)
  const hasMore =
    more !== undefined
      ? more > 0
      : eligible.length > people.length || !!query.data?.cursor
  if (!opts) return null
  return (
    <View testID="starterPackPeople" style={[a.gap_md]}>
      {people.map(({subject}) => (
        <ContentHider
          key={subject.did}
          modui={moderateProfile(subject, opts).ui('profileList')}>
          <ProfileCard.Link
            profile={subject}
            testID="starterPackPerson"
            style={[a.w_full, a.align_start]}>
            <View style={[a.w_full, a.flex_row, a.align_center, a.gap_sm]}>
              <View style={{width: 40, flexShrink: 0}}>
                <ProfileCard.Avatar
                  profile={subject}
                  moderationOpts={opts}
                  size={40}
                  disabledPreview
                />
              </View>
              <View style={[a.flex_1, {minWidth: 0}]}>
                <ProfileCard.NameAndHandle
                  profile={subject}
                  moderationOpts={opts}
                />
              </View>
            </View>
          </ProfileCard.Link>
        </ContentHider>
      ))}
      {hasMore && (
        <View style={[a.align_start]}>
          <Link
            testID="starterPackMorePeople"
            to={packLink.to}
            onPress={packLink.precache}
            label={packLink.label}
            size="small"
            color="secondary">
            <ButtonText>
              {more === undefined ? l`Show more` : l`${i18n.number(more)} more`}
            </ButtonText>
          </Link>
        </View>
      )}
      {!people.length && query.isFetching ? (
        <Loader size="md" />
      ) : !people.length && query.isError ? (
        <Button
          label={l`Retry loading people`}
          color="secondary"
          size="small"
          onPress={() => void query.refetch()}>
          <ButtonText>
            <Trans>Retry loading people</Trans>
          </ButtonText>
        </Button>
      ) : !people.length ? (
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>No people to show.</Trans>
        </Text>
      ) : null}
    </View>
  )
}
