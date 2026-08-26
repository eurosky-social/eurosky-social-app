import {useEffect, useRef, useState} from 'react'
import {Pressable, StyleSheet, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigationState} from '@react-navigation/native'

import {useAppState} from '#/lib/appState'
import {getCurrentRoute} from '#/lib/routes/helpers'
import {type AllNavigatorParams} from '#/lib/routes/types'
import {
  usePetCompanion,
  usePetRestBreaks,
  useSetPetRestBreaks,
} from '#/state/preferences'
import {useSession} from '#/state/session'
import {useComposerState} from '#/state/shell/composer'
import {atoms as a, flatten, useBreakpoints, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {H1, Text} from '#/components/Typography'
import {PetSprite} from '#/features/petCompanion/PetSprite'
import {getSpecies, resolveVariant} from '#/features/petCompanion/registry'
import {type Species} from '#/features/petCompanion/types'
import {HOUR, MINUTE} from './constants'
import {FocusTrap} from './FocusTrap'
import {
  isTimerOwnerAlive,
  setTimerOwnerAlive,
  TIMER_OWNER_ID,
} from './timerOwner'

/*
 * These are the social surfaces where reading and scrolling consume a rest
 * break's browsing allowance. Settings, composing, and messages do not.
 */
type BrowsingRoute = keyof AllNavigatorParams | 'MyProfile'

const BROWSING_ROUTES = new Set<BrowsingRoute>([
  'Bookmarks',
  'CustomFeed',
  'CustomFeedLikedBy',
  'Feeds',
  'Hashtag',
  'Home',
  'MyProfile',
  'NewsFeed',
  'Newsroom',
  'Notifications',
  'NotificationsActivityList',
  'PostLikedBy',
  'PostQuotes',
  'PostRepostedBy',
  'PostThread',
  'Profile',
  'ProfileFollowers',
  'ProfileFollows',
  'ProfileKnownFollowers',
  'ProfileLabelerLikedBy',
  'ProfileList',
  'ProfileSearch',
  'Search',
  'Start',
  'Topic',
  'VideoFeed',
])

export function useIsPetResting() {
  const {hasSession} = useSession()
  const companion = usePetCompanion()
  const restBreaks = usePetRestBreaks()

  return Boolean(
    hasSession &&
    companion.enabled &&
    restBreaks.enabled &&
    restBreaks.sleepUntil !== null,
  )
}

/**
 * Tracks device-local browsing time and covers social surfaces while the
 * companion is taking an optional rest break.
 */
export function PetRestBreaksTracker() {
  const appState = useAppState()
  const routeName = useNavigationState(state => getCurrentRoute(state).name)
  const {hasSession} = useSession()
  const composerState = useComposerState()
  const companion = usePetCompanion()
  const restBreaks = usePetRestBreaks()
  const setRestBreaks = useSetPetRestBreaks()

  const totalBrowsingMs = restBreaks.browsingDurationMinutes * MINUTE
  const sleepDurationMs = restBreaks.sleepDurationHours * HOUR
  const featureEnabled = hasSession && companion.enabled && restBreaks.enabled
  const isBrowsing =
    featureEnabled &&
    !composerState &&
    appState === 'active' &&
    BROWSING_ROUTES.has(routeName as BrowsingRoute)
  const ownsBrowsingTimer = restBreaks.browsingOwnerId === TIMER_OWNER_ID
  const ownedTimerRef = useRef({
    browsingEndsAt: restBreaks.browsingEndsAt,
    ownsBrowsingTimer,
    sleepUntil: restBreaks.sleepUntil,
    totalBrowsingMs,
  })
  ownedTimerRef.current = {
    browsingEndsAt: restBreaks.browsingEndsAt,
    ownsBrowsingTimer,
    sleepUntil: restBreaks.sleepUntil,
    totalBrowsingMs,
  }

  useEffect(() => {
    return () => {
      const timer = ownedTimerRef.current
      if (
        timer.ownsBrowsingTimer &&
        timer.browsingEndsAt !== null &&
        timer.sleepUntil === null
      ) {
        setRestBreaks({
          remainingBrowsingMs: Math.min(
            timer.totalBrowsingMs,
            Math.max(0, timer.browsingEndsAt - Date.now()),
          ),
          browsingEndsAt: null,
          browsingOwnerId: null,
        })
      }
    }
  }, [setRestBreaks])

  useEffect(() => {
    setTimerOwnerAlive(ownsBrowsingTimer && isBrowsing)
    return () => setTimerOwnerAlive(false)
  }, [isBrowsing, ownsBrowsingTimer])

  useEffect(() => {
    if (!featureEnabled || restBreaks.sleepUntil === null) return

    const wakeUp = () => {
      setRestBreaks({
        remainingBrowsingMs: totalBrowsingMs,
        browsingEndsAt: null,
        browsingOwnerId: null,
        sleepUntil: null,
      })
    }
    const remainingSleepMs = restBreaks.sleepUntil - Date.now()
    if (remainingSleepMs <= 0) {
      wakeUp()
      return
    }

    const timer = setTimeout(wakeUp, remainingSleepMs)
    return () => clearTimeout(timer)
  }, [
    appState,
    featureEnabled,
    restBreaks.sleepUntil,
    setRestBreaks,
    totalBrowsingMs,
  ])

  useEffect(() => {
    const now = Date.now()
    const browsingEndsAt = restBreaks.browsingEndsAt

    if (
      browsingEndsAt !== null &&
      restBreaks.browsingOwnerId &&
      !ownsBrowsingTimer
    ) {
      let cancelled = false
      void isTimerOwnerAlive(restBreaks.browsingOwnerId).then(ownerIsAlive => {
        if (cancelled || ownerIsAlive) return

        if (isBrowsing) {
          setRestBreaks({browsingOwnerId: TIMER_OWNER_ID})
        } else {
          setRestBreaks({
            remainingBrowsingMs: Math.min(
              totalBrowsingMs,
              Math.max(0, browsingEndsAt - Date.now()),
            ),
            browsingEndsAt: null,
            browsingOwnerId: null,
          })
        }
      })
      return () => {
        cancelled = true
      }
    }

    if (!featureEnabled) {
      if (browsingEndsAt !== null && ownsBrowsingTimer) {
        setRestBreaks({
          remainingBrowsingMs: Math.min(
            totalBrowsingMs,
            Math.max(0, browsingEndsAt - now),
          ),
          browsingEndsAt: null,
          browsingOwnerId: null,
        })
      }
      return
    }

    if (restBreaks.sleepUntil !== null) return

    if (browsingEndsAt !== null && browsingEndsAt <= now) {
      const sleepUntil = browsingEndsAt + sleepDurationMs
      if (sleepUntil > now) {
        setRestBreaks({
          remainingBrowsingMs: totalBrowsingMs,
          browsingEndsAt: null,
          browsingOwnerId: null,
          sleepUntil,
        })
      } else {
        setRestBreaks({
          remainingBrowsingMs: totalBrowsingMs,
          browsingEndsAt: null,
          browsingOwnerId: null,
          sleepUntil: null,
        })
      }
      return
    }

    if (!isBrowsing) {
      if (browsingEndsAt !== null && ownsBrowsingTimer) {
        setRestBreaks({
          remainingBrowsingMs: Math.min(
            totalBrowsingMs,
            Math.max(0, browsingEndsAt - now),
          ),
          browsingEndsAt: null,
          browsingOwnerId: null,
        })
      }
      return
    }

    if (browsingEndsAt === null) {
      const remainingBrowsingMs = Math.min(
        totalBrowsingMs,
        Math.max(0, restBreaks.remainingBrowsingMs),
      )
      setRestBreaks({
        remainingBrowsingMs,
        browsingEndsAt: now + remainingBrowsingMs,
        browsingOwnerId: TIMER_OWNER_ID,
      })
      return
    }

    if (!restBreaks.browsingOwnerId) {
      setRestBreaks({browsingOwnerId: TIMER_OWNER_ID})
      return
    }

    const timer = setTimeout(() => {
      setRestBreaks({
        remainingBrowsingMs: totalBrowsingMs,
        browsingEndsAt: null,
        browsingOwnerId: null,
        sleepUntil: browsingEndsAt + sleepDurationMs,
      })
    }, browsingEndsAt - now)
    return () => clearTimeout(timer)
  }, [
    featureEnabled,
    isBrowsing,
    restBreaks.browsingEndsAt,
    restBreaks.browsingOwnerId,
    restBreaks.remainingBrowsingMs,
    restBreaks.sleepUntil,
    setRestBreaks,
    sleepDurationMs,
    totalBrowsingMs,
  ])

  return null
}

export function PetRestBreakOverlay() {
  const companion = usePetCompanion()
  const restBreaks = usePetRestBreaks()
  const setRestBreaks = useSetPetRestBreaks()
  const isPetResting = useIsPetResting()

  if (!isPetResting || restBreaks.sleepUntil === null) return null

  const totalBrowsingMs = restBreaks.browsingDurationMinutes * MINUTE
  const species = getSpecies(companion.species)
  return (
    <RestScreen
      key={species.id}
      species={species}
      variant={resolveVariant(species, companion.variant)}
      sleepUntil={restBreaks.sleepUntil}
      onWakeUp={() =>
        setRestBreaks({
          remainingBrowsingMs: totalBrowsingMs,
          browsingEndsAt: null,
          browsingOwnerId: null,
          sleepUntil: null,
        })
      }
    />
  )
}

function RestScreen({
  species,
  variant,
  sleepUntil,
  onWakeUp,
}: {
  species: Species
  variant: string
  sleepUntil: number
  onWakeUp: () => void
}) {
  const {t: l, i18n} = useLingui()
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const [showWakeUpConfirmation, setShowWakeUpConfirmation] = useState(false)
  const wakeDate = new Date(sleepUntil)
  const wakeTime = i18n.date(wakeDate, {timeStyle: 'short'})
  const wakeDay = i18n.date(wakeDate, {weekday: 'long'})

  return (
    <FocusTrap>
      <View
        role="dialog"
        aria-modal
        accessibilityViewIsModal
        testID="petRestBreakScreen"
        style={flatten([
          StyleSheet.absoluteFill,
          a.align_center,
          a.justify_center,
          a.px_xl,
          t.atoms.bg,
          web({position: 'fixed'}),
          styles.overlay,
        ])}>
        <View
          accessibilityElementsHidden={showWakeUpConfirmation}
          importantForAccessibility={
            showWakeUpConfirmation ? 'no-hide-descendants' : 'auto'
          }
          pointerEvents={showWakeUpConfirmation ? 'none' : 'auto'}
          style={[a.w_full, a.align_center, a.gap_lg, styles.content]}>
          <SleepingPet species={species} variant={variant} />
          <View style={[a.align_center, a.gap_sm]}>
            <H1
              style={[a.text_3xl, a.font_bold, a.leading_snug, a.text_center]}>
              <Trans>Your companion is sleeping</Trans>
            </H1>
            <Text
              style={[a.text_lg, a.text_center, t.atoms.text_contrast_medium]}>
              <Trans>
                Wakes up at {wakeTime} on {wakeDay}
              </Trans>
            </Text>
          </View>
          <Button
            label={l`Wake up your companion`}
            onPress={() => setShowWakeUpConfirmation(true)}
            color="primary"
            size="large">
            <ButtonText>
              <Trans>Wake up</Trans>
            </ButtonText>
          </Button>
        </View>

        {showWakeUpConfirmation && (
          <FocusTrap>
            <View
              role="alertdialog"
              aria-modal
              accessibilityViewIsModal
              style={flatten([
                StyleSheet.absoluteFill,
                a.align_center,
                a.justify_center,
                a.px_xl,
                styles.confirmationOverlay,
              ])}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={l`Let your companion sleep`}
                accessibilityHint={l`Closes the confirmation without waking your companion`}
                onPress={() => setShowWakeUpConfirmation(false)}
                style={[
                  StyleSheet.absoluteFill,
                  {backgroundColor: t.palette.black, opacity: 0.8},
                ]}
              />
              <View
                style={[
                  a.w_full,
                  gtMobile ? a.p_2xl : a.p_xl,
                  a.border,
                  t.atoms.bg,
                  styles.confirmationCard,
                  {
                    borderColor: t.palette.contrast_200,
                    shadowColor: t.palette.black,
                    shadowOpacity: t.name === 'light' ? 0.1 : 0.4,
                    shadowRadius: 30,
                  },
                ]}>
                <View style={[a.pb_sm]}>
                  <Text
                    style={[
                      a.text_2xl,
                      a.font_semi_bold,
                      a.leading_snug,
                      a.pb_xs,
                    ]}>
                    <Trans>Wake up your companion?</Trans>
                  </Text>
                  <Text
                    style={[
                      a.text_md,
                      a.leading_snug,
                      a.pb_lg,
                      t.atoms.text_contrast_high,
                    ]}>
                    <Trans>
                      Are you sure you want to wake up your pet? You’ll be able
                      to browse again right away.
                    </Trans>
                  </Text>
                </View>
                <View style={[a.gap_sm]}>
                  <Button
                    label={l`Wake up`}
                    onPress={onWakeUp}
                    color="primary"
                    size="large">
                    <ButtonText>
                      <Trans>Wake up</Trans>
                    </ButtonText>
                  </Button>
                  <Button
                    label={l`Let them sleep`}
                    onPress={() => setShowWakeUpConfirmation(false)}
                    color="secondary"
                    size="large">
                    <ButtonText>
                      <Trans>Let them sleep</Trans>
                    </ButtonText>
                  </Button>
                </View>
              </View>
            </View>
          </FocusTrap>
        )}
      </View>
    </FocusTrap>
  )
}

function SleepingPet({species, variant}: {species: Species; variant: string}) {
  const {sleep, sleepEnter} = species.behavior
  const [state, setState] = useState(
    sleepEnter && !species.loopStates.includes(sleepEnter) ? sleepEnter : sleep,
  )

  return (
    <PetSprite
      species={species}
      variant={variant}
      state={state}
      onAnimationEnd={() => setState(sleep)}
    />
  )
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 1000,
    elevation: 1000,
  },
  content: {
    maxWidth: 420,
  },
  confirmationOverlay: {
    zIndex: 1,
  },
  confirmationCard: {
    maxWidth: 320,
    borderRadius: 36,
    zIndex: 1,
  },
})
