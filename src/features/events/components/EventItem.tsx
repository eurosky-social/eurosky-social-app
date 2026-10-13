import {useState} from 'react'
import {View} from 'react-native'
import {Image} from 'expo-image'
import {type I18n} from '@lingui/core'
import {Trans, useLingui} from '@lingui/react/macro'

import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {countLines} from '#/lib/strings/helpers'
import {useSession} from '#/state/session'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {Text} from '#/components/Typography'
import {type EventProfile, type EventRecord} from '../types'
import {getEventImage, getEventLocationLabel, getProfileAvatar} from '../util'
import {EventPosts} from './EventPosts'
import {EventRsvpButtons} from './EventRsvpButtons'
import {ShowMoreButton} from './ShowMoreButton'

const AVATAR_SIZE = 24
const BANNER_ASPECT_RATIO = 16 / 9
const DESCRIPTION_MAX_LINES = 4
/*
 * We can't cheaply measure whether wrapped text overflows (onTextLayout doesn't
 * fire on web), so long descriptions without line breaks are caught by length.
 */
const DESCRIPTION_MAX_CHARS = 300

export function EventItem({
  event,
  profile,
  onEdit,
}: {
  event: EventRecord
  profile?: EventProfile
  /** Shown only on the signed-in user's own events. */
  onEdit?: () => void
}) {
  const t = useTheme()
  const {currentAccount} = useSession()
  const canEdit = !!onEdit && currentAccount?.did === event.did
  const {t: l, i18n} = useLingui()
  const image = getEventImage(event)
  const time = formatEventTime(i18n, event)
  const when = time?.end
    ? l({
        message: `${time.start}\u00A0– ${time.end}`,
        comment: 'Time range of an event, e.g. “Oct 7, 2026, 18:00 – 21:00”',
      })
    : time?.start
  const where = getEventLocationLabel(event)
  const description = event.value.description?.trim()
  const [limitDescription, setLimitDescription] = useState(
    () =>
      countLines(description) >= DESCRIPTION_MAX_LINES ||
      (description?.length ?? 0) > DESCRIPTION_MAX_CHARS,
  )

  const authorName = sanitizeDisplayName(
    profile?.value?.displayName ||
      (profile?.handle ? sanitizeHandle(profile.handle, '@') : event.did),
  )

  return (
    <View style={[a.border_t, t.atoms.border_contrast_low]}>
      <View style={[a.gap_sm, a.px_xl, a.pt_lg, a.pb_sm]}>
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
              <Text emoji style={[a.font_semi_bold, t.atoms.text]}>
                {authorName}
              </Text>{' '}
              is organizing
            </Trans>
          </Text>
        </View>
        {image && (
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
        )}
        <View style={[a.gap_xs]}>
          <Text emoji style={[a.text_lg, a.font_bold, a.leading_snug]}>
            {event.value.name}
          </Text>
          {(when || where) && (
            <Text emoji style={[t.atoms.text_contrast_medium]}>
              {[when, where].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
        {description && (
          <View>
            <Text
              emoji
              numberOfLines={
                limitDescription ? DESCRIPTION_MAX_LINES : undefined
              }
              style={[a.leading_snug]}>
              {description}
            </Text>
            {limitDescription && (
              <ShowMoreButton
                label={l`Expand event description`}
                onPress={() => setLimitDescription(false)}
              />
            )}
          </View>
        )}
        <View style={[a.flex_row, a.align_center, a.justify_between, a.gap_sm]}>
          <EventRsvpButtons event={event} />
          <View style={[a.flex_row, a.align_center, a.gap_xs]}>
            {canEdit && (
              <Button
                label={l`Edit event`}
                onPress={onEdit}
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
            )}
          </View>
        </View>
      </View>
      {/* Full width: Post brings its own padding and top border. */}
      <EventPosts event={event} profile={profile} />
    </View>
  )
}

/**
 * The event's start, plus its end when present. An end on the same day only
 * shows the time.
 */
function formatEventTime(
  i18n: I18n,
  event: EventRecord,
): {start: string; end?: string} | undefined {
  const start = parseDate(event.value.startsAt)
  if (!start) return undefined
  const startText = i18n.date(start, {dateStyle: 'medium', timeStyle: 'short'})

  const end = parseDate(event.value.endsAt)
  if (!end || end <= start) return {start: startText}
  const endText =
    end.toDateString() === start.toDateString()
      ? i18n.date(end, {timeStyle: 'short'})
      : i18n.date(end, {dateStyle: 'medium', timeStyle: 'short'})
  return {start: startText, end: endText}
}

/** Record timestamps can be malformed (`{}`), so parse defensively. */
function parseDate(value: string | {} | undefined): Date | undefined {
  if (typeof value !== 'string') return undefined
  const date = new Date(value)
  return isNaN(date.getTime()) ? undefined : date
}
