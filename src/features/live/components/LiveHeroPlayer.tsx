import {View} from 'react-native'
import {type UriString} from '@atproto/lex'
import {Trans} from '@lingui/react/macro'

import {externalEmbedLabels} from '#/lib/strings/embed-player'
import {atoms as a, useTheme} from '#/alf'
import {ExternalPlayer} from '#/components/Post/Embed/ExternalEmbed/ExternalPlayer'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {
  getLiveEventState,
  getLiveEventThumb,
  getStreamPlayer,
  type LiveEvent,
} from '../events'
import {LivePill} from './LivePill'

/**
 * The stream itself, through the same player ordinary posts use for YouTube
 * and Twitch links: consent per source, WebView on native, own-origin iframe
 * on web. The event supplies the thumbnail and title in place of a link card.
 */
export function LiveHeroPlayer({event}: {event: LiveEvent}) {
  const t = useTheme()
  const params = getStreamPlayer(event.streamUrl)
  const state = getLiveEventState(event)

  if (!params) {
    return (
      <View
        style={[
          a.w_full,
          a.justify_center,
          a.align_center,
          a.p_xl,
          {aspectRatio: 16 / 9},
          t.atoms.bg_contrast_25,
        ]}>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>This stream cannot play inside mu.</Trans>
        </Text>
      </View>
    )
  }

  const link: app.bsky.embed.external.ViewExternal = {
    uri: event.streamUrl as UriString,
    title: event.title,
    description: event.description ?? '',
    thumb: getLiveEventThumb(event) as UriString | undefined,
  }

  return (
    <View style={[a.w_full, a.relative, {backgroundColor: 'black'}]}>
      <ExternalPlayer link={link} params={params} />
      <View
        pointerEvents="none"
        style={[
          a.absolute,
          a.flex_row,
          a.align_center,
          a.gap_xs,
          {top: 12, left: 12, zIndex: 4},
        ]}>
        {state === 'live' && <LivePill size="large" />}
        <View
          style={[
            a.rounded_xs,
            a.px_sm,
            a.py_2xs,
            {backgroundColor: 'rgba(0,0,0,0.55)'},
          ]}>
          <Text style={[a.text_xs, a.font_medium, {color: t.palette.white}]}>
            <Trans>via {externalEmbedLabels[params.source]}</Trans>
          </Text>
        </View>
      </View>
    </View>
  )
}
