import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {LiveEventCard} from './components/LiveEventCard'
import {LiveEventEditorDialog} from './components/LiveEventEditorDialog'
import {groupLiveEvents, type LiveEvent} from './events'
import {
  useIsLiveCurator,
  useLiveCuratorQuery,
  useLiveEventsQuery,
} from './queries'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Live'>

/** The Live index: what is on now, what is coming, what can be replayed. */
export function LiveScreen({}: Props) {
  const t = useTheme()
  const {t: l} = useLingui()
  const curator = useLiveCuratorQuery()
  const eventsQuery = useLiveEventsQuery()
  const events = eventsQuery.data
  const isLoading = curator.isLoading || eventsQuery.isLoading
  const error = curator.error ?? eventsQuery.error
  const isCurator = useIsLiveCurator()
  const editorControl = useDialogControl()
  const {live, upcoming, ended} = groupLiveEvents(events ?? [])

  return (
    <Layout.Screen testID="liveScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Live</Trans>
          </Layout.Header.TitleText>
          <Layout.Header.SubtitleText>
            <Trans>Curated broadcasts, with the conversation around them</Trans>
          </Layout.Header.SubtitleText>
        </Layout.Header.Content>
        {isCurator ? (
          <Button
            label={l`New live event`}
            size="small"
            color="primary"
            onPress={() => editorControl.open()}>
            <ButtonIcon icon={PlusIcon} />
            <ButtonText>
              <Trans>New event</Trans>
            </ButtonText>
          </Button>
        ) : (
          <Layout.Header.Slot />
        )}
      </Layout.Header.Outer>
      <Layout.Content>
        {isLoading ? (
          <View style={[a.py_2xl, a.align_center]}>
            <Loader size="lg" />
          </View>
        ) : error ? (
          <View style={[a.px_lg, a.py_2xl, a.align_center]}>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              <Trans>The programme could not be loaded.</Trans>
            </Text>
          </View>
        ) : !events?.length ? (
          <View style={[a.px_lg, a.py_2xl, a.align_center, a.gap_xs]}>
            <Text style={[a.text_md, a.font_bold, t.atoms.text]}>
              <Trans>Nothing scheduled yet</Trans>
            </Text>
            <Text
              style={[a.text_sm, a.text_center, t.atoms.text_contrast_medium]}>
              <Trans>Curated broadcasts will appear here.</Trans>
            </Text>
          </View>
        ) : (
          <View style={[a.px_lg, a.py_lg, a.gap_2xl]}>
            <Section titleText={<Trans>Live now</Trans>} events={live} />
            <Section titleText={<Trans>Upcoming</Trans>} events={upcoming} />
            <Section titleText={<Trans>Recent</Trans>} events={ended} />
          </View>
        )}
      </Layout.Content>
      {isCurator && <LiveEventEditorDialog control={editorControl} />}
    </Layout.Screen>
  )
}

function Section({
  titleText,
  events,
}: {
  titleText: React.ReactNode
  events: LiveEvent[]
}) {
  const t = useTheme()
  if (events.length === 0) return null
  return (
    <View style={[a.gap_md]}>
      <Text style={[a.text_lg, a.font_bold, t.atoms.text]}>{titleText}</Text>
      <View style={[a.gap_md]}>
        {events.map(event => (
          <LiveEventCard key={event.id} event={event} />
        ))}
      </View>
    </View>
  )
}
