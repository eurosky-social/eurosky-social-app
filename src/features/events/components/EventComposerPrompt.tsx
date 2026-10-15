import {useState} from 'react'
import {Pressable, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {useCurrentAccountProfile} from '#/state/queries/useCurrentAccountProfile'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, native, useTheme, web} from '#/alf'
import {SubtleHover} from '#/components/SubtleHover'
import {Text} from '#/components/Typography'
import {type EventProfile, type EventRecord} from '../types'
import {getEventPostUrl} from '../util'

/**
 * A prompt to post about the event, opening the composer with a link to it
 * already in the text. Modelled on `ComposerPrompt` from
 * `#/view/com/feeds/ComposerPrompt`, without its camera and image buttons.
 */
export function EventComposerPrompt({
  event,
  profile,
}: {
  event: EventRecord
  profile?: EventProfile
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {openComposer} = useOpenComposer()
  const viewer = useCurrentAccountProfile()
  const [hover, setHover] = useState(false)

  if (!viewer) return null

  return (
    <Pressable
      onPress={() =>
        openComposer({
          // Leaves room above the link for the post's own text.
          text: `\n\n${getEventPostUrl(event, profile)}`,
          logContext: 'Other',
        })
      }
      accessibilityRole="button"
      accessibilityLabel={l`Post about this event`}
      accessibilityHint={l`Opens the post composer with a link to the event`}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      style={({pressed}) => [
        a.relative,
        a.flex_row,
        a.align_center,
        a.gap_md,
        a.px_xl,
        a.py_md,
        a.border_t,
        t.atoms.border_contrast_low,
        native({paddingTop: 10, paddingBottom: 10}),
        web({cursor: 'pointer'}),
        pressed && web({outline: 'none'}),
      ]}>
      <SubtleHover hover={hover} />
      <UserAvatar
        avatar={viewer.avatar}
        size={42}
        type={viewer.associated?.labeler ? 'labeler' : 'user'}
      />
      <View style={[a.flex_1]}>
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>Write about this event…</Trans>
        </Text>
      </View>
    </Pressable>
  )
}
