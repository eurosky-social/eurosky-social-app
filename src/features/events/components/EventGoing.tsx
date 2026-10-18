import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useProfilesQuery} from '#/state/queries/profile'
import {useSession} from '#/state/session'
import {atoms as a, useTheme, web} from '#/alf'
import {AvatarStack} from '#/components/AvatarStack'
import {Button, ButtonIcon} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import {Loader} from '#/components/Loader'
import * as ProfileCard from '#/components/ProfileCard'
import {Text} from '#/components/Typography'
import {OsoTitlePill} from '#/features/osoNav/pills'
import {type app} from '#/lexicons'
import {EVENT_RSVP_SAMPLE, useEventGoingQuery} from '../queries'
import {type EventRecord, type RsvpStatus} from '../types'

const GOING: RsvpStatus = 'community.lexicon.calendar.rsvp#going'

/** As big as the heart and person icons of the RSVP buttons. */
const AVATAR_SIZE = 22
const MAX_AVATARS = 3
/** Names spelled out before "and N others". */
const MAX_NAMES = 2

/**
 * Who else is going, under an event's RSVP buttons: a stack of their avatars
 * and a line that names people the user follows first ("Anna, Ben and 12
 * others are going"). Pressing it lists everyone going. Hidden until someone
 * other than the user is going.
 */
export function EventGoingSummary({event}: {event: EventRecord}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const control = Dialog.useDialogControl()

  const sampleDids = [
    ...new Set((event.rsvps?.[GOING] ?? []).map(rsvp => rsvp.did)),
  ]
    .filter(did => did !== currentAccount?.did)
    .slice(0, EVENT_RSVP_SAMPLE)
  const viewerGoing = (event.rsvps?.[GOING] ?? []).some(
    rsvp => rsvp.did === currentAccount?.did,
  )
  const othersCount = Math.max(
    0,
    (event.rsvpsGoingCount ?? sampleDids.length) - (viewerGoing ? 1 : 0),
  )

  const {data} = useProfilesQuery({handles: sampleDids})
  // People the user follows come first, in the avatars and in the sentence.
  const profiles = [...(data?.profiles ?? [])].sort(
    (x, y) => Number(!!y.viewer?.following) - Number(!!x.viewer?.following),
  )
  const followed = profiles.filter(profile => profile.viewer?.following)

  if (othersCount < 1 || profiles.length === 0) return null

  const nameOf = (profile: app.bsky.actor.defs.ProfileViewDetailed) =>
    sanitizeDisplayName(
      profile.displayName || sanitizeHandle(profile.handle, '@'),
    )
  const names = followed.slice(0, MAX_NAMES).map(nameOf)
  const rest = othersCount - names.length

  let sentence: string
  if (names.length === 0) {
    sentence = l`${plural(othersCount, {
      one: '# person is going',
      other: '# people are going',
    })}`
  } else if (rest <= 0) {
    sentence =
      names.length === 1
        ? l`${names[0]} is going`
        : l`${names[0]} and ${names[1]} are going`
  } else {
    const others = plural(rest, {one: '# other', other: '# others'})
    sentence =
      names.length === 1
        ? l`${names[0]} and ${others} are going`
        : l`${names[0]}, ${names[1]} and ${others} are going`
  }

  return (
    <>
      <View style={[a.flex_row, a.align_center, a.gap_sm]}>
        <AvatarStack
          profiles={profiles.slice(0, MAX_AVATARS)}
          size={AVATAR_SIZE}
        />
        <Text
          emoji
          role="link"
          accessibilityRole="link"
          accessibilityHint={l`Shows everyone who is going`}
          onPress={() => control.open()}
          numberOfLines={2}
          style={[
            a.flex_1,
            a.text_sm,
            a.font_semi_bold,
            a.leading_snug,
            t.atoms.text_contrast_medium,
            web({cursor: 'pointer'}),
          ]}>
          {sentence}
        </Text>
      </View>
      <EventGoingDialog control={control} event={event} />
    </>
  )
}

/** Everyone going to the event, with follow buttons. */
function EventGoingDialog({
  control,
  event,
}: {
  control: Dialog.DialogControlProps
  event: EventRecord
}) {
  return (
    <Dialog.Outer control={control} nativeOptions={{fullHeight: true}}>
      <Dialog.Handle />
      <GoingList event={event} />
    </Dialog.Outer>
  )
}

function GoingList({event}: {event: EventRecord}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const moderationOpts = useModerationOpts()
  const control = Dialog.useDialogContext()
  const {data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage} =
    useEventGoingQuery({uri: event.uri, enabled: true})
  const profiles = data?.pages.flatMap(page => page.profiles) ?? []

  return (
    <Dialog.InnerFlatList
      data={profiles}
      keyExtractor={(profile: app.bsky.actor.defs.ProfileViewDetailed) =>
        profile.did
      }
      renderItem={({item}: {item: app.bsky.actor.defs.ProfileViewDetailed}) =>
        moderationOpts ? (
          <View
            style={[a.px_lg, a.py_md, a.border_t, t.atoms.border_contrast_low]}>
            {/*
             * ProfileCard.Default, but the follow button's own change is the
             * confirmation: no toast.
             */}
            <ProfileCard.Link profile={item} onPress={() => control.close()}>
              <ProfileCard.Outer>
                <ProfileCard.Header>
                  <ProfileCard.Avatar
                    profile={item}
                    moderationOpts={moderationOpts}
                  />
                  <ProfileCard.NameAndHandle
                    profile={item}
                    moderationOpts={moderationOpts}
                  />
                  <ProfileCard.FollowButton
                    profile={item}
                    moderationOpts={moderationOpts}
                    logContext="ProfileCard"
                    withToast={false}
                  />
                </ProfileCard.Header>
                <ProfileCard.Labels
                  profile={item}
                  moderationOpts={moderationOpts}
                />
                <ProfileCard.Description profile={item} />
              </ProfileCard.Outer>
            </ProfileCard.Link>
          </View>
        ) : null
      }
      ListHeaderComponent={
        <View style={[a.px_lg, a.pt_lg, a.pb_md, a.gap_sm, t.atoms.bg]}>
          <View style={[a.flex_row, a.align_center, a.justify_between]}>
            <OsoTitlePill kind="going" withLogo={false} />
            <Button
              label={l`Close`}
              size="small"
              color="secondary"
              shape="round"
              onPress={() => control.close()}
              testID="eventGoingCloseBtn">
              <ButtonIcon icon={XIcon} />
            </Button>
          </View>
          <Text emoji numberOfLines={2} style={[a.text_md, a.font_semi_bold]}>
            {event.value.name}
          </Text>
        </View>
      }
      ListEmptyComponent={
        isLoading ? (
          <View style={[a.py_xl, a.align_center]}>
            <Loader size="lg" />
          </View>
        ) : (
          <Text style={[a.px_lg, a.text_md, t.atoms.text_contrast_medium]}>
            <Trans>Nobody is going yet.</Trans>
          </Text>
        )
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={[a.py_lg, a.align_center]}>
            <Loader />
          </View>
        ) : undefined
      }
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
      }}
      onEndReachedThreshold={2}
      webInnerStyle={[web({maxHeight: '80vh'})]}
    />
  )
}
