import {View} from 'react-native'
import {type AppBskyActorDefs} from '@atproto/api'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigationState} from '@react-navigation/native'
import {useQueries} from '@tanstack/react-query'
import chunk from 'lodash.chunk'

import {getCurrentRoute} from '#/lib/routes/helpers'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {STALE} from '#/state/queries'
import {profilesQueryKey} from '#/state/queries/profile'
import {useAgent} from '#/state/session'
import * as ModuleHeader from '#/screens/Search/components/ModuleHeader'
import {atoms as a, useTheme} from '#/alf'
import {ButtonText} from '#/components/Button'
import {Newspaper_Stroke2_Corner2_Rounded as NewspaperIcon} from '#/components/icons/Newspaper'
import {PersonGroup_Stroke2_Corner2_Rounded as PersonGroupIcon} from '#/components/icons/Person'
import {Link} from '#/components/Link'
import * as ProfileCard from '#/components/ProfileCard'
import {Text} from '#/components/Typography'
import {ExploreLiveSportsWidget} from '#/features/liveSports/components/ExploreLiveSportsWidget'
import {
  getDefaultNewsroomPublisher,
  getNewsroomPublisherByDid,
  type NewsroomPublisher,
} from '../publishers'

/**
 * The newsroom hub's right column: the focused org's reporters, then the
 * cross-network context that sits beside any org - the broader curated news
 * feed and live sports.
 */
export function NewsroomRightRail() {
  // The rail renders in the shell's right column on desktop and inline in the
  // screen otherwise, so it resolves the focused org from the navigation state
  // instead of threading a prop through the shell.
  const routeParamName = useNavigationState(state => {
    if (!state) return undefined
    const route = getCurrentRoute(state)
    if (route.name !== 'Newsroom') return undefined
    return (route.params as {name?: string} | undefined)?.name
  })
  const publisher =
    (routeParamName && getNewsroomPublisherByDid(routeParamName)) ||
    getDefaultNewsroomPublisher()

  return (
    <View>
      <ReportersModule publisher={publisher} />
      <NewsModule />
      <ExploreLiveSportsWidget />
    </View>
  )
}

/**
 * The focused org's reporters as followable profiles. The merged feed blends
 * their posts in anonymously; this is where they surface as people.
 */
function ReportersModule({publisher}: {publisher: NewsroomPublisher}) {
  const {t: l} = useLingui()
  const moderationOpts = useModerationOpts()
  const {profilesByDid, isLoading} = useReporterProfiles(publisher.reporterDids)

  // Stay quiet until everything is loaded - same rule as the front page.
  if (!publisher.reporterDids.length || isLoading || !moderationOpts)
    return null

  // getProfiles does not guarantee order; keep the registry's.
  const profiles = publisher.reporterDids
    .map(did => profilesByDid.get(did))
    .filter(profile => !!profile)
  if (!profiles.length) return null

  return (
    <View style={[a.pb_xl]}>
      <ModuleHeader.Container>
        <ModuleHeader.Icon icon={PersonGroupIcon} />
        <ModuleHeader.TitleText>{l`Reporters`}</ModuleHeader.TitleText>
      </ModuleHeader.Container>
      <View style={[a.px_lg, a.gap_lg]}>
        {profiles.map(profile => (
          <ProfileCard.Link key={profile.did} profile={profile}>
            <ProfileCard.Outer>
              <ProfileCard.Header>
                <ProfileCard.Avatar
                  profile={profile}
                  moderationOpts={moderationOpts}
                />
                <ProfileCard.NameAndHandle
                  profile={profile}
                  moderationOpts={moderationOpts}
                />
                {/* Icon-only so the button does not crowd the narrow rail. */}
                <ProfileCard.FollowButton
                  profile={profile}
                  moderationOpts={moderationOpts}
                  logContext="ProfileCard"
                  shape="round"
                  size="tiny"
                />
              </ProfileCard.Header>
              <ProfileCard.Labels
                profile={profile}
                moderationOpts={moderationOpts}
              />
              <ProfileCard.Description profile={profile} />
            </ProfileCard.Outer>
          </ProfileCard.Link>
        ))}
      </View>
    </View>
  )
}

/** Fetch reporter profiles in chunks because getProfiles accepts at most 25. */
function useReporterProfiles(dids: string[]) {
  const agent = useAgent()
  const results = useQueries({
    queries: chunk(dids, 25).map(actors => ({
      enabled: actors.length > 0,
      staleTime: STALE.MINUTES.FIVE,
      queryKey: profilesQueryKey(actors),
      queryFn: async () => {
        const res = await agent.getProfiles({actors})
        return res.data
      },
    })),
  })

  const profilesByDid = new Map<string, AppBskyActorDefs.ProfileViewDetailed>()
  for (const result of results) {
    for (const profile of result.data?.profiles ?? []) {
      profilesByDid.set(profile.did, profile)
    }
  }

  return {
    profilesByDid,
    isLoading: results.some(result => result.isPending),
  }
}

function NewsModule() {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View style={[a.pb_xl]}>
      <ModuleHeader.Container>
        <ModuleHeader.Icon icon={NewspaperIcon} />
        <ModuleHeader.TitleText>{l`Your News`}</ModuleHeader.TitleText>
      </ModuleHeader.Container>
      <View style={[a.px_lg, a.gap_md]}>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            Your personalized feed of stories from across your sources.
          </Trans>
        </Text>
        <Link
          to="/news"
          label={l`Open your news feed`}
          color="primary"
          size="large"
          style={[a.w_full, a.justify_center]}>
          <ButtonText>
            <Trans>Open news feed</Trans>
          </ButtonText>
        </Link>
      </View>
    </View>
  )
}
