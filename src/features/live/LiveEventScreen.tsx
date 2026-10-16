import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {useIsWithinSplitView} from '#/screens/Messages/components/splitView/context'
import {ThreadComposePrompt} from '#/screens/PostThread/components/ThreadComposePrompt'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {LiveEventEditorDialog} from './components/LiveEventEditorDialog'
import {LiveEventHeader} from './components/LiveEventHeader'
import {LiveHeroPlayer} from './components/LiveHeroPlayer'
import {LiveThreadInline, useLiveThread} from './components/LiveThread'
import {NetworkDiscussion} from './components/NetworkDiscussion'
import {type LiveEvent} from './events'
import {
  useIsLiveCurator,
  useLiveAnchorQuery,
  useLiveEventQuery,
} from './queries'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'LiveEvent'>

/**
 * One event: the stream, who is hosting, and the conversation. On wide
 * screens the split view layout puts the live thread in its own column
 * beside this screen; otherwise the thread and the network view are tabs
 * under the player.
 */
export function LiveEventScreen({route}: Props) {
  const {data: event, isLoading} = useLiveEventQuery(route.params.id)
  const {t: l} = useLingui()

  if (!event) {
    return (
      <Layout.Screen testID="liveEventScreen">
        <Layout.Header.Outer>
          <Layout.Header.BackButton />
          <Layout.Header.Content>
            <Layout.Header.TitleText>
              <Trans>Live</Trans>
            </Layout.Header.TitleText>
          </Layout.Header.Content>
          <Layout.Header.Slot />
        </Layout.Header.Outer>
        <Layout.Content>
          <View style={[a.p_2xl, a.align_center]}>
            {isLoading ? (
              <Loader size="lg" />
            ) : (
              <Text>{l`This event is not in the programme.`}</Text>
            )}
          </View>
        </Layout.Content>
      </Layout.Screen>
    )
  }

  return <Inner event={event} />
}

function Inner({event}: {event: LiveEvent}) {
  const {t: l} = useLingui()
  const {isWithinSplitView} = useIsWithinSplitView()
  const isCurator = useIsLiveCurator()
  const editorControl = useDialogControl()
  const {data: anchorUri, isLoading: anchorLoading} = useLiveAnchorQuery(event)

  return (
    <Layout.Screen testID="liveEventScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Live</Trans>
          </Layout.Header.TitleText>
          <Layout.Header.SubtitleText>{event.title}</Layout.Header.SubtitleText>
        </Layout.Header.Content>
        {isCurator ? (
          <Button
            label={l`Edit live event`}
            size="small"
            color="secondary"
            onPress={() => editorControl.open()}>
            <ButtonText>
              <Trans>Edit</Trans>
            </ButtonText>
          </Button>
        ) : (
          <Layout.Header.Slot />
        )}
      </Layout.Header.Outer>
      {isWithinSplitView ? (
        <SplitBody event={event} anchorUri={anchorUri} />
      ) : (
        <StackedBody
          event={event}
          anchorUri={anchorUri}
          anchorLoading={anchorLoading}
        />
      )}
      {isCurator && (
        <LiveEventEditorDialog control={editorControl} event={event} />
      )}
    </Layout.Screen>
  )
}

/**
 * Wide screens: the thread lives in the split view's own column, so this
 * body never mounts the thread hook (which would double the live polling).
 */
function SplitBody({
  event,
  anchorUri,
}: {
  event: LiveEvent
  anchorUri: string | null
}) {
  const t = useTheme()
  return (
    <Layout.Content>
      <LiveHeroPlayer event={event} />
      <LiveEventHeader event={event} />
      <View style={[a.border_t, t.atoms.border_contrast_low]}>
        <NetworkDiscussion event={event} anchorUri={anchorUri} compact />
      </View>
    </Layout.Content>
  )
}

/** Phone and narrow web: the thread and the network view are tabs. */
function StackedBody({
  event,
  anchorUri,
  anchorLoading,
}: {
  event: LiveEvent
  anchorUri: string | null
  anchorLoading: boolean
}) {
  const [tab, setTab] = useState<'thread' | 'network'>('thread')
  const thread = useLiveThread({event, anchorUri, anchorLoading})
  return (
    <>
      <Layout.Content>
        <LiveHeroPlayer event={event} />
        <LiveEventHeader event={event} />
        <Tabs
          tab={tab}
          onChange={setTab}
          replyCount={thread.anchor?.value.post.replyCount}
        />
        {tab === 'thread' ? (
          <LiveThreadInline event={event} data={thread} />
        ) : (
          <NetworkDiscussion event={event} anchorUri={anchorUri} limit={25} />
        )}
      </Layout.Content>
      {tab === 'thread' && thread.canReply && (
        <ThreadComposePrompt onPressCompose={thread.onReply} />
      )}
    </>
  )
}

function Tabs({
  tab,
  onChange,
  replyCount,
}: {
  tab: 'thread' | 'network'
  onChange: (tab: 'thread' | 'network') => void
  replyCount?: number
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const threadLabel = replyCount
    ? l`Live thread · ${replyCount}`
    : l`Live thread`
  return (
    <View
      style={[a.flex_row, a.px_sm, a.border_b, t.atoms.border_contrast_low]}>
      <Tab
        active={tab === 'thread'}
        text={threadLabel}
        onPress={() => onChange('thread')}
      />
      <Tab
        active={tab === 'network'}
        text={l`Across the network`}
        onPress={() => onChange('network')}
      />
    </View>
  )
}

function Tab({
  active,
  text,
  onPress,
}: {
  active: boolean
  text: string
  onPress: () => void
}) {
  const t = useTheme()
  return (
    <Button
      label={text}
      onPress={onPress}
      accessibilityState={{selected: active}}
      style={[
        a.px_md,
        a.pt_md,
        a.pb_sm,
        a.rounded_0,
        {marginBottom: -1, borderBottomWidth: 2},
        {borderBottomColor: active ? t.palette.primary_500 : 'transparent'},
      ]}>
      <Text
        style={[
          a.text_sm,
          active ? a.font_bold : a.font_medium,
          active ? t.atoms.text : t.atoms.text_contrast_medium,
        ]}>
        {text}
      </Text>
    </Button>
  )
}
