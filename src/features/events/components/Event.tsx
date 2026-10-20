import {type GestureResponderEvent, View} from 'react-native'
import {Image} from 'expo-image'
import {Trans, useLingui} from '@lingui/react/macro'

import {makeProfileLink} from '#/lib/routes/links'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useSession} from '#/state/session'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, type TextStyleProp, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {InlineLinkText} from '#/components/Link'
import {ProfileHoverCard} from '#/components/ProfileHoverCard'
import {Text} from '#/components/Typography'
import {type EventProfile, type EventRecord} from '../types'
import {
  formatEventTime,
  getEventImage,
  getEventLocationLabel,
  getProfileAvatar,
} from '../util'

/*
 * Building blocks of an event, composed differently by the feed item and the
 * event's own page. Use as `import * as Event from './Event'`.
 */

const AVATAR_SIZE = 24
const BANNER_ASPECT_RATIO = 16 / 9

/** The organiser's avatar and name, e.g. “Alice is organizing”. */
export function Organizer({
  did,
  profile,
}: {
  did: string
  profile?: EventProfile
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const name = sanitizeDisplayName(
    profile?.value?.displayName ||
      (profile?.handle ? sanitizeHandle(profile.handle, '@') : did),
  )

  return (
    <View style={[a.flex_row, a.align_center, a.gap_sm]}>
      <UserAvatar
        type="user"
        size={AVATAR_SIZE}
        avatar={profile && getProfileAvatar(profile)}
      />
      <Text
        emoji
        numberOfLines={1}
        style={[a.flex_1, t.atoms.text_contrast_medium]}>
        <Trans>
          <ProfileHoverCard did={did} inline>
            <InlineLinkText
              to={makeProfileLink({did, handle: profile?.handle ?? ''})}
              label={l`Go to ${name}’s profile`}
              disableMismatchWarning
              emoji
              style={[a.font_semi_bold, t.atoms.text]}>
              {name}
            </InlineLinkText>
          </ProfileHoverCard>{' '}
          is organizing
        </Trans>
      </Text>
    </View>
  )
}

/** The event's image, or nothing when it has none. */
export function Banner({event}: {event: EventRecord}) {
  const t = useTheme()
  const image = getEventImage(event)
  if (!image) return null

  return (
    <Image
      source={{uri: image.url}}
      alt={image.alt}
      accessibilityIgnoresInvertColors
      loading="lazy"
      style={[
        a.w_full,
        a.rounded_md,
        t.atoms.bg_contrast_25,
        {aspectRatio: BANNER_ASPECT_RATIO},
      ]}
    />
  )
}

export function Title({name, style}: {name: string} & TextStyleProp) {
  return (
    <Text emoji style={[a.font_bold, a.leading_snug, style]}>
      {name}
    </Text>
  )
}

/** When and where, e.g. “Oct 7, 2026, 18:00 – 21:00 · Amsterdam, NL”. */
export function Meta({event}: {event: EventRecord}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const time = formatEventTime(i18n, event)
  const when = time?.end
    ? l({
        message: `${time.start} – ${time.end}`,
        comment: 'Time range of an event, e.g. “Oct 7, 2026, 18:00 – 21:00”',
      })
    : time?.start
  const where = getEventLocationLabel(event)
  if (!when && !where) return null

  return (
    <Text emoji style={[t.atoms.text_contrast_medium]}>
      {[when, where].filter(Boolean).join(' · ')}
    </Text>
  )
}

/** A row for the RSVP buttons, with anything else pushed to the end. */
export function Actions({children}: {children: React.ReactNode}) {
  return (
    <View style={[a.flex_row, a.align_center, a.justify_between, a.gap_sm]}>
      {children}
    </View>
  )
}

/** Renders only on the signed-in user's own events. */
export function EditButton({
  event,
  onPress,
}: {
  event: EventRecord
  onPress: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  if (currentAccount?.did !== event.did) return null

  return (
    <Button
      label={l`Edit event`}
      onPress={(e: GestureResponderEvent) => {
        // Don't let the press reach the feed item's link.
        e.preventDefault()
        e.stopPropagation()
        onPress()
      }}
      size="small"
      variant="ghost"
      color="secondary"
      hoverStyle={t.atoms.bg_contrast_25}
      style={[a.bg_transparent]}>
      <ButtonIcon icon={PencilIcon} />
      <ButtonText>
        <Trans context="action">Edit</Trans>
      </ButtonText>
    </Button>
  )
}
