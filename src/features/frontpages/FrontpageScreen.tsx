import {useEffect, useRef} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {useProfileQuery} from '#/state/queries/profile'
import {PostFeed} from '#/view/com/posts/PostFeed'
import {type ListMethods} from '#/view/com/util/List'
import {atoms as a, useLayoutBreakpoints, useTheme} from '#/alf'
import {ButtonIcon, ButtonText} from '#/components/Button'
import {Newspaper_Stroke2_Corner2_Rounded as NewsFeedIcon} from '#/components/icons/Newspaper'
import {Newspaper2_Stroke2_Corner2_Rounded as FrontpagesIcon} from '#/components/icons/Newspaper2'
import * as Layout from '#/components/Layout'
import {Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {BRAND} from '#/config/brand'
import {getPublisherName} from '#/features/news/publishers'
import {FrontpageArticles} from './components/FrontpageArticles'
import {FrontpageMasthead} from './components/FrontpageMasthead'
import {FrontpageRightRail} from './components/FrontpageRightRail'
import {findFrontpage, useFrontpageReporters, useFrontpages} from './frontpages'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Frontpage'>

/**
 * A frontpage: one of the news aggregator's outlets, with its masthead, its
 * latest articles, and - where it has a Bluesky account - the conversation
 * from it and its reporters.
 */
export function FrontpageScreen({route, navigation}: Props) {
  const {name} = route.params

  /*
   * The URL is the single source of truth for the frontpage, so navigating
   * here from anywhere (a byline, a link chip, a profile shortcut, a shared
   * link) lands on the right one, even when the screen is already mounted.
   * It names the outlet by slug or by its account's DID; a handle resolves
   * to its DID through the live profile first.
   */
  const {frontpages, isLoading} = useFrontpages()
  const direct = findFrontpage(frontpages, name)
  const lookUpHandle =
    !!name && !!frontpages && !direct && !name.startsWith('did:')
  const {data: namedProfile, isLoading: isResolvingName} = useProfileQuery({
    did: lookUpHandle ? name : undefined,
  })
  const frontpage =
    direct ??
    (namedProfile ? findFrontpage(frontpages, namedProfile.did) : undefined)
  const resolving = isLoading || (lookUpHandle && isResolvingName)

  const t = useTheme()
  const {t: l} = useLingui()
  const {rightNavVisible} = useLayoutBreakpoints()
  const scrollElRef = useRef<ListMethods>(null)

  const {data: profile} = useProfileQuery({did: frontpage?.did})
  /*
   * The conversation merges the outlet's account and its reporters', round-
   * robin across their author feeds (see NewsFeedAPI). Held back until a
   * verifying outlet's journalists are known, so the feed starts once.
   */
  const {conversationDids, isLoading: reportersLoading} =
    useFrontpageReporters(frontpage)
  const frontpageName = getPublisherName(profile) || frontpage?.name || ''

  /* The address settles on the slug, whatever named the frontpage. */
  useEffect(() => {
    if (frontpage && name !== frontpage.slug) {
      navigation.setParams({name: frontpage.slug})
    }
  }, [name, frontpage, navigation])

  /* Without a frontpage to show, the directory lists them all. */
  useEffect(() => {
    if (!name) navigation.replace('OutletDirectory')
  }, [name, navigation])

  if (resolving || !name) {
    return (
      <Layout.Screen testID="frontpageScreen">
        <Layout.Center style={[a.flex_1, a.justify_center, a.align_center]}>
          <Loader size="xl" />
        </Layout.Center>
      </Layout.Screen>
    )
  }

  if (!frontpage) {
    return (
      <Layout.Screen testID="frontpageScreen">
        <Layout.Header.Outer>
          <Layout.Header.BackButton />
          <Layout.Header.Content>
            <Layout.Header.TitleText>
              <Trans>{BRAND.name} News</Trans>
            </Layout.Header.TitleText>
          </Layout.Header.Content>
          <Layout.Header.Slot />
        </Layout.Header.Outer>
        <Layout.Center style={[a.flex_1, a.align_center, a.gap_lg, a.p_2xl]}>
          <Text style={[a.text_md, a.text_center]}>
            <Trans>There is no frontpage here.</Trans>
          </Text>
          <Link
            to="/outlets"
            label={l`See every outlet`}
            size="small"
            color="secondary">
            <ButtonIcon icon={FrontpagesIcon} />
            <ButtonText>
              <Trans>All outlets</Trans>
            </ButtonText>
          </Link>
        </Layout.Center>
      </Layout.Screen>
    )
  }

  const feedDids = reportersLoading ? [] : conversationDids
  /* The journalism, then the rail inline where the shell has no column for it. */
  const front = (
    <>
      <FrontpageMasthead frontpage={frontpage} />
      <FrontpageArticles frontpage={frontpage} />
      {/* The shell's right column hosts the rail on wide screens; when it
       * is hidden, fall back to rendering it inline above the feed. */}
      {!rightNavVisible && (
        <View style={[a.pb_md]}>
          <FrontpageRightRail inline />
        </View>
      )}
    </>
  )

  return (
    <Layout.Screen testID="frontpageScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>{BRAND.name} News</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        {/* Mirrors the news feed's link to the outlets, so the two news
         * surfaces cross-link both ways. Sits outside Header.Slot: slots are
         * fixed-width squares and this button carries a text label. */}
        <Link
          testID="frontpageNewsFeedBtn"
          to="/news"
          label={l`Open your news feed`}
          size="small"
          color="secondary">
          <ButtonIcon icon={NewsFeedIcon} />
          <ButtonText>
            <Trans>News</Trans>
          </ButtonText>
        </Link>
      </Layout.Header.Outer>

      {feedDids.length === 0 ? (
        /* An outlet with no accounts at all has no conversation to follow. */
        <Layout.Content key={frontpage.slug}>{front}</Layout.Content>
      ) : (
        <PostFeed
          // Key on the frontpage so switching resets feed scroll/state cleanly.
          key={frontpage.slug}
          testID="frontpageFeed"
          scrollElRef={scrollElRef}
          /*
           * The conversation merges the outlet's account and its reporters',
           * round-robin across their author feeds (see NewsFeedAPI).
           */
          feed={`frontpage|${feedDids.join(',')}`}
          renderEmptyState={renderEmpty}
          // An element rather than an inline component, so header state (image
          // loads, discussion) survives re-renders like follow-state changes.
          ListHeaderComponent={
            <>
              {front}
              {/* Native social layer: the conversation around the journalism. */}
              <View
                style={[
                  a.flex_row,
                  a.align_center,
                  a.gap_sm,
                  a.px_lg,
                  a.py_xl,
                  a.border_t,
                  a.border_b,
                  t.atoms.border_contrast_low,
                ]}>
                <FrontpagesIcon
                  size="lg"
                  style={{color: frontpage.accent ?? t.palette.primary_500}}
                />
                <Text
                  emoji
                  style={[
                    a.flex_1,
                    a.text_2xl,
                    a.font_bold,
                    a.leading_tight,
                    t.atoms.text,
                  ]}>
                  <Trans>From {frontpageName} and its reporters</Trans>
                </Text>
              </View>
            </>
          }
        />
      )}
    </Layout.Screen>
  )
}

function renderEmpty() {
  return (
    <View style={[a.flex_1, a.align_center, a.justify_center, a.p_2xl]}>
      <Text style={[a.text_md, a.text_center]}>
        <Trans>No recent posts from this outlet.</Trans>
      </Text>
    </View>
  )
}
