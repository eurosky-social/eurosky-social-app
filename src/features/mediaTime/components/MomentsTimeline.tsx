import {useEffect, useMemo, useRef, useState} from 'react'
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {List, type ListMethods} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import * as Toggle from '#/components/forms/Toggle'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {type app} from '#/lexicons'
import {type Moment} from '../moments'
import {formatMediaTime} from '../record'
import {useMomentTitle} from '../useMomentTitle'
import {
  busiestMoment,
  foldedMomentCount,
  type MomentStatus,
  momentStatuses,
} from '../watching'

type Row = {moment: Moment; status: MomentStatus}

/**
 * A video's moments as a timeline that follows playback (design canvas
 * "Watching, with moments"): the moment playing is highlighted, older past
 * moments fold into one row, and moments ahead keep their comments hidden
 * until playback gets there, unless revealed. Tapping a moment opens it.
 *
 * On phones, and in the desktop web panel, the list scrolls by itself, and
 * "Follow the video" keeps the moment playing in view (`canFollow`). On a
 * narrow web page it scrolls with the page, below `header`.
 */
export function MomentsTimeline({
  moments,
  loading,
  playing,
  threadgateRecord,
  header,
  canFollow = !IS_WEB,
  onOpenMoment,
}: {
  moments: Moment[]
  loading: boolean
  /** The second being watched, once the player has reported one. */
  playing: number | undefined
  threadgateRecord?: app.bsky.feed.threadgate.Main
  /** Shown above the moments, scrolling with them. */
  header?: React.ReactNode
  /**
   * Whether the list scrolls by itself, so it can keep the moment playing in
   * view. Not on a web page that scrolls as a whole.
   */
  canFollow?: boolean
  onOpenMoment: (moment: Moment) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const listRef = useRef<ListMethods>(null)
  const [follow, setFollow] = useState(true)
  const [showEarlier, setShowEarlier] = useState(false)
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(new Set())

  const statuses = useMemo(
    () => momentStatuses(moments, playing),
    [moments, playing],
  )
  const folded = showEarlier ? 0 : foldedMomentCount(statuses)
  const rows: Row[] = useMemo(
    () =>
      moments.map((moment, i) => ({moment, status: statuses[i]})).slice(folded),
    [moments, statuses, folded],
  )
  const busiest = busiestMoment(moments)
  const nowIndex = rows.findIndex(row => row.status === 'now')

  useEffect(() => {
    if (!canFollow || !follow || nowIndex < 0) return
    listRef.current?.scrollToIndex({
      index: nowIndex,
      viewPosition: 0.3,
      animated: true,
    })
  }, [canFollow, follow, nowIndex])

  const earlierTimes = moments
    .slice(0, foldedMomentCount(statuses))
    .map(m => formatMediaTime(m.startSeconds))
  const listHeader = (
    <>
      {header}
      <View
        style={[
          a.flex_row,
          a.align_center,
          a.justify_between,
          a.px_lg,
          a.py_sm,
          header ? [a.border_t, t.atoms.border_contrast_low] : null,
        ]}>
        <Text style={[a.text_md, a.font_bold]}>
          <Trans>Moments</Trans>
          {moments.length > 0 ? (
            <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
              {` · ${moments.length}`}
            </Text>
          ) : null}
        </Text>
        {!canFollow ? null : (
          <Toggle.Item
            name="followVideo"
            label={l`Follow the video`}
            value={follow}
            onChange={setFollow}
            style={[a.flex_row, a.align_center, a.gap_sm]}>
            <Text
              style={[
                a.text_sm,
                a.font_semi_bold,
                t.atoms.text_contrast_medium,
              ]}>
              <Trans>Follow the video</Trans>
            </Text>
            <Toggle.Switch />
          </Toggle.Item>
        )}
      </View>
      {earlierTimes.length > 0 || showEarlier ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            showEarlier ? l`Hide earlier moments` : l`Show earlier moments`
          }
          accessibilityHint=""
          onPress={() => setShowEarlier(!showEarlier)}
          style={[a.flex_row, a.align_stretch]}>
          <Rail />
          <Text
            style={[
              a.py_sm,
              a.text_sm,
              a.font_semi_bold,
              t.atoms.text_contrast_medium,
            ]}>
            {showEarlier
              ? l`Hide earlier moments`
              : `${plural(earlierTimes.length, {
                  one: '# earlier moment',
                  other: '# earlier moments',
                })} · ${earlierTimes.join(' · ')}`}
          </Text>
        </Pressable>
      ) : null}
    </>
  )

  return (
    <List
      ref={listRef}
      data={rows}
      keyExtractor={(row: Row) => `${row.moment.startSeconds}`}
      renderItem={({item}: {item: Row}) => (
        <TimelineMoment
          moment={item.moment}
          status={item.status}
          busiest={item.moment === busiest}
          revealed={revealed.has(item.moment.startSeconds)}
          onReveal={() =>
            setRevealed(new Set([...revealed, item.moment.startSeconds]))
          }
          onOpen={() => onOpenMoment(item.moment)}
          threadgateRecord={threadgateRecord}
        />
      )}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        loading ? (
          <View style={[a.py_2xl, a.align_center]}>
            <ActivityIndicator />
          </View>
        ) : (
          <View style={[a.px_lg, a.py_lg]}>
            <Text
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              <Trans>
                No moments yet. A moment forms where several people comment
                close to the same second.
              </Trans>
            </Text>
          </View>
        )
      }
      ListFooterComponent={<View style={{height: 24}} />}
      onScrollToIndexFailed={({averageItemLength, index}) => {
        listRef.current?.scrollToOffset({
          offset: averageItemLength * index,
          animated: true,
        })
      }}
      desktopFixedHeight={false}
    />
  )
}

/** The line along the left of the timeline. */
function Rail({children}: {children?: React.ReactNode}) {
  const t = useTheme()
  return (
    <View style={[{width: 52}, a.flex_shrink_0]}>
      <View
        style={[
          a.absolute,
          t.atoms.bg_contrast_100,
          {left: 25, top: 0, bottom: 0, width: 2},
        ]}
      />
      {children}
    </View>
  )
}

/** The dot on the line: larger for moments with more comments. */
function dotSize(count: number) {
  return count > 100 ? 14 : count > 50 ? 11 : count > 25 ? 9 : 7
}

function TimelineMoment({
  moment,
  status,
  busiest,
  revealed,
  onReveal,
  onOpen,
  threadgateRecord,
}: {
  moment: Moment
  status: MomentStatus
  busiest: boolean
  revealed: boolean
  onReveal: () => void
  onOpen: () => void
  threadgateRecord?: app.bsky.feed.threadgate.Main
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const hidden = status === 'ahead' && !revealed
  const {title, people} = useMomentTitle({
    moment,
    threadgateRecord,
    enabled: !hidden,
  })
  const time = formatMediaTime(moment.startSeconds)
  const comments = plural(moment.count, {
    one: '# comment',
    other: '# comments',
  })
  const tag =
    status === 'now'
      ? l`Now playing`
      : busiest
        ? l`Most discussed`
        : title && !hidden
          ? l`From the comments`
          : undefined
  const meta = hidden
    ? l`${comments} · shown when you get there`
    : people
      ? l({
          message: `${comments} · ${plural(people, {one: '# person', other: '# people'})}`,
          comment:
            'Under a video moment: how many comments, and by how many people, e.g. 12 comments · 9 people',
        })
      : comments
  const size = dotSize(moment.count)
  const cardStyle: StyleProp<ViewStyle> = [
    a.flex_1,
    a.rounded_md,
    a.border,
    a.gap_xs,
    {marginVertical: 4, marginRight: 16, padding: 12},
    status === 'now'
      ? {
          backgroundColor: t.palette.primary_50,
          borderColor: t.palette.primary_500,
        }
      : status === 'ahead'
        ? [t.atoms.border_contrast_low, {borderStyle: 'dashed'}]
        : [t.atoms.bg_contrast_25, {borderColor: 'transparent'}],
  ]
  const content = (
    <>
      <View style={[a.flex_row, a.align_center, a.gap_sm]}>
        <Text
          style={[
            a.text_sm,
            a.font_bold,
            {color: t.palette.primary_600, fontVariant: ['tabular-nums']},
          ]}>
          {time}
        </Text>
        {tag ? (
          <View
            style={[
              a.rounded_sm,
              {paddingHorizontal: 6, paddingVertical: 2},
              status === 'now'
                ? {backgroundColor: t.palette.primary_500}
                : t.atoms.bg_contrast_50,
            ]}>
            <Text
              style={[
                a.text_xs,
                a.font_semi_bold,
                status === 'now'
                  ? {color: t.palette.white}
                  : t.atoms.text_contrast_high,
              ]}>
              {tag}
            </Text>
          </View>
        ) : null}
      </View>
      {hidden ? null : (
        <Text
          style={[a.text_md, a.font_semi_bold, a.leading_snug]}
          numberOfLines={3}>
          {title ? `“${title}”` : l`Moment at ${time}`}
        </Text>
      )}
      <View style={[a.flex_row, a.align_center, a.gap_md, a.flex_wrap]}>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>{meta}</Text>
        {hidden ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={l`Show this moment's comments now`}
            accessibilityHint=""
            hitSlop={{top: 10, bottom: 10, left: 8, right: 8}}
            onPress={onReveal}>
            <Text
              style={[
                a.text_sm,
                a.font_semi_bold,
                {color: t.palette.primary_600},
              ]}>
              <Trans>Show</Trans>
            </Text>
          </Pressable>
        ) : null}
      </View>
    </>
  )

  return (
    <View
      testID={`timelineMoment-${moment.startSeconds}`}
      style={[a.flex_row, a.align_stretch]}>
      <Rail>
        <View
          style={[
            a.absolute,
            {
              top: 20,
              left: 26 - size / 2,
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor:
                status === 'ahead'
                  ? t.palette.contrast_300
                  : t.palette.primary_500,
            },
          ]}
        />
      </Rail>
      {hidden ? (
        // Not pressable until revealed: opening it would show its comments,
        // and "Show" can't sit inside another button on the web.
        <View style={cardStyle}>{content}</View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={l`Moment at ${time}: ${title ?? ''}, ${meta}`}
          accessibilityHint={l`Opens the moment and plays the video from there`}
          onPress={onOpen}
          style={cardStyle}>
          {content}
        </Pressable>
      )}
    </View>
  )
}
