import {useState} from 'react'
import {View} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'
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
import {transparentifyColor} from '#/alf/util/colorGeneration'
import {Button, ButtonText} from '#/components/Button'
import {
  ChevronBottom_Stroke2_Corner0_Rounded as ChevronDownIcon,
  ChevronRight_Stroke2_Corner0_Rounded as ChevronRightIcon,
  ChevronTop_Stroke2_Corner0_Rounded as ChevronUpIcon,
} from '#/components/icons/Chevron'
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

/** How many reporters the collapsed module previews. */
const COLLAPSED_SHOWN = 2

/**
 * The newsroom hub's right column: the focused org's reporters, then the
 * cross-network context that sits beside any org - the broader curated news
 * feed and live sports.
 */
export function NewsroomRightRail({
  inline = false,
}: {
  /**
   * Adapts the rail for rendering inline in the scroll (narrow screens):
   * the reporters list collapses to a preview and the news callout tightens
   * to a single row, so the rail does not push the conversation far down.
   * The desktop right column has the vertical room for the full modules.
   */
  inline?: boolean
}) {
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
      <ReportersModule publisher={publisher} collapsible={inline} />
      <NewsModule compact={inline} />
      <ExploreLiveSportsWidget />
    </View>
  )
}

/**
 * The focused org's reporters as followable profiles. The merged feed blends
 * their posts in anonymously; this is where they surface as people.
 */
function ReportersModule({
  publisher,
  collapsible = false,
}: {
  publisher: NewsroomPublisher
  /** Hides the roster behind the header until tapped; see the rail's prop. */
  collapsible?: boolean
}) {
  const t = useTheme()
  const {i18n, t: l} = useLingui()
  const moderationOpts = useModerationOpts()
  const {profilesByDid, isLoading} = useReporterProfiles(publisher.reporterDids)
  const [expanded, setExpanded] = useState(false)

  // Stay quiet until everything is loaded - same rule as the front page.
  if (!publisher.reporterDids.length || isLoading || !moderationOpts)
    return null

  // getProfiles does not guarantee order; keep the registry's.
  const profiles = publisher.reporterDids
    .map(did => profilesByDid.get(did))
    .filter(profile => !!profile)
  if (!profiles.length) return null

  // Collapsed is a preview, not a closed drawer: the first few reporters keep
  // the module inviting while a long roster stays out of the way.
  const canToggle = collapsible && profiles.length > COLLAPSED_SHOWN
  const shown =
    canToggle && !expanded ? profiles.slice(0, COLLAPSED_SHOWN) : profiles

  const accent = publisher.accent ?? t.palette.primary_500

  const header = (
    <ModuleHeader.Container
      bottomBorder
      style={canToggle ? a.flex_1 : undefined}>
      {/* The icon carries the org accent, matching the conversation heading;
       * ModuleHeader.Icon renders in the text color, so place the icon
       * directly with its sizing. */}
      <PersonGroupIcon size="lg" style={{color: accent, marginLeft: -2}} />
      {/* Bigger than the stock module title so the section reads at the same
       * level as the page's other headings. */}
      <ModuleHeader.TitleText style={[a.text_2xl, a.font_bold]}>
        {l`Reporters`}
      </ModuleHeader.TitleText>
      {canToggle && (
        <>
          <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
            {i18n.number(profiles.length)}
          </Text>
          {expanded ? (
            <ChevronUpIcon size="sm" style={t.atoms.text_contrast_low} />
          ) : (
            <ChevronDownIcon size="sm" style={t.atoms.text_contrast_low} />
          )}
        </>
      )}
    </ModuleHeader.Container>
  )

  return (
    <View style={[a.pb_xl]}>
      {canToggle ? (
        <Button
          label={
            expanded
              ? l`Show fewer reporters`
              : l`Show all ${i18n.number(profiles.length)} reporters`
          }
          onPress={() => setExpanded(v => !v)}
          style={[a.w_full]}>
          {header}
        </Button>
      ) : (
        header
      )}
      <View style={[a.relative]}>
        <View style={[a.px_lg, a.pt_md, a.gap_lg]}>
          {shown.map(profile => (
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
        {/* The preview fades into the page rather than ending on a hard cut,
         * signaling the roster continues. */}
        {canToggle && !expanded && (
          <LinearGradient
            key={t.name} // android does not update when you change the colors. sigh.
            start={[0.5, 0]}
            end={[0.5, 1]}
            colors={[
              transparentifyColor(t.atoms.bg.backgroundColor, 0),
              t.atoms.bg.backgroundColor,
            ]}
            style={[a.absolute, a.inset_0, {top: 'auto', height: 96}]}
            pointerEvents="none"
          />
        )}
      </View>
      {canToggle && (
        <View style={[a.px_lg, a.pt_sm]}>
          <Button
            label={
              expanded
                ? l`Show fewer reporters`
                : l`Show all ${i18n.number(profiles.length)} reporters`
            }
            onPress={() => setExpanded(v => !v)}
            size="small"
            variant="ghost"
            color="secondary"
            style={[a.w_full, a.justify_center]}>
            <ButtonText>
              {expanded ? (
                <Trans>Show fewer</Trans>
              ) : (
                <Trans>Show all {i18n.number(profiles.length)} reporters</Trans>
              )}
            </ButtonText>
          </Button>
        </View>
      )}
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

function NewsModule({
  compact = false,
}: {
  /** One tappable row for the inline rail; see the rail's prop. */
  compact?: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()

  if (compact) {
    return (
      <View style={[a.px_lg, a.pb_xl]}>
        <Link
          to="/news"
          label={l`Open your news feed`}
          style={[a.w_full, a.rounded_md]}>
          {({hovered, pressed}) => (
            <View
              style={[
                a.w_full,
                a.flex_row,
                a.align_center,
                a.gap_sm,
                a.p_md,
                a.rounded_md,
                a.transition_color,
                {
                  backgroundColor:
                    hovered || pressed
                      ? t.palette.primary_100
                      : t.palette.primary_50,
                },
              ]}>
              <NewspaperIcon size="md" style={{color: t.palette.primary_600}} />
              <Text
                style={[
                  a.flex_1,
                  a.text_md,
                  a.font_bold,
                  {color: t.palette.primary_600},
                ]}>
                <Trans>Your News</Trans>
              </Text>
              <ChevronRightIcon
                size="sm"
                style={{color: t.palette.primary_500}}
              />
            </View>
          )}
        </Link>
      </View>
    )
  }

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
