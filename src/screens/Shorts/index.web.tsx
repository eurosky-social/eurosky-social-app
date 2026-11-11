import {useEffect, useLayoutEffect, useRef, useState} from 'react'
import {View} from 'react-native'
import {RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {Trans, useLingui} from '@lingui/react/macro'
import {useIsFocused, useNavigation} from '@react-navigation/native'

import {useSetTitle} from '#/lib/hooks/useSetTitle'
import {getHomeNavigationAction} from '#/lib/routes/navigation'
import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
  type NavigationProp,
} from '#/lib/routes/types'
import {POST_TOMBSTONE, usePostShadow} from '#/state/cache/post-shadow'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {usePostFeedQuery} from '#/state/queries/post-feed'
import {useAutoPagination} from '#/state/queries/util'
import {atoms as a, useBreakpoints} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {
  ChevronBottom_Stroke2_Corner0_Rounded as Down,
  ChevronTop_Stroke2_Corner0_Rounded as Up,
} from '#/components/icons/Chevron'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {ContentHider} from '#/components/moderation/ContentHider'
import * as ReportDialogMetadataContext from '#/components/moderation/ReportDialog/ReportDialogMetadataContext'
import {VideoEmbed} from '#/components/Post/Embed/VideoEmbed'
import * as ActiveVideo from '#/components/Post/Embed/VideoEmbed/ActiveVideoWebContext'
import {
  useVideoMuteState,
  type VideoAudioState,
} from '#/components/Post/Embed/VideoEmbed/VideoVolumeContext'
import {Text} from '#/components/Typography'
import {PRODUCT} from '#/config/product'
import {type PostArticle} from '#/features/articles/articles'
import {articleModeration} from '#/features/articles/moderation'
import {articlesFromPublisherFeed} from '#/features/publishers/articles'
import {PublisherByline} from '#/features/publishers/Byline'
import {PublisherFollowButton} from '#/features/publishers/FollowButton'
import {ShortsActions} from './Actions'
import {ShortsCaption, ShortsFade} from './Caption'
import {ShortsChrome} from './Chrome'
import {ShortsTheme} from './Theme'
import {useIdleControls} from './useIdleControls'

/** Full-height snapping feed; only the selected clip mounts a player. */
export function ShortsScreen({
  route,
}: NativeStackScreenProps<CommonNavigatorParams, 'Shorts'>) {
  const {t: l} = useLingui()
  useSetTitle(PRODUCT.id === 'news' ? l`Video` : l`Shorts`)
  return (
    <ShortsTheme>
      <Layout.Screen minimalShell fullBleed noInsetTop>
        <Shorts initialPostUri={route.params?.initialPostUri} />
      </Layout.Screen>
    </ShortsTheme>
  )
}

function Shorts({initialPostUri}: {initialPostUri?: string}) {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const focused = useIsFocused()
  const {gtMobile} = useBreakpoints()
  const opts = useModerationOpts()
  const feed = usePostFeedQuery('publishers|videos')
  const videos = articlesFromPublisherFeed(
    feed.data?.pages.flatMap(page => page.slices) ?? [],
  ).filter(
    article =>
      article.media?.type === 'video' &&
      article.media.view.presentation !== 'gif' &&
      !articleModeration(article, opts).filter,
  )
  const viewport = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [muted, setMuted] = useVideoMuteState()
  const audio = {muted, onMutedChange: setMuted}
  const {visible: controlsVisible, reveal} = useIdleControls(
    focused && videos.length > 0 && !feed.isError,
    index,
  )
  const wakeOnly = useRef(false)
  const appliedInitialUri = useRef<string | undefined>(undefined)
  useLayoutEffect(() => {
    if (
      !initialPostUri ||
      !viewport.current ||
      appliedInitialUri.current === initialPostUri
    )
      return
    const target = videos.findIndex(
      article => article.item.uri === initialPostUri,
    )
    if (target < 0) return
    appliedInitialUri.current = initialPostUri
    viewport.current.scrollTo({
      top: target * viewport.current.clientHeight,
      behavior: 'instant',
    })
    setIndex(target)
  }, [initialPostUri, videos])

  // Bound filtered/empty-page retries while keeping three playable clips ahead.
  useAutoPagination(
    {...feed, hasNextPage: focused && !feed.isError && !!feed.hasNextPage},
    Math.max(videos.length - index, 0),
    3,
  )

  useEffect(() => {
    if (!focused) return
    const onEscape = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        document.fullscreenElement ||
        document.querySelector('[role="dialog"], [role="menu"]')
      )
        return
      event.preventDefault()
      if (navigation.canGoBack()) navigation.goBack()
      else
        navigation.dispatch(
          getHomeNavigationAction(navigation.getState(), 'navigate'),
        )
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [focused, navigation])
  const move = (step: number) => {
    const target = Math.min(Math.max(index + step, 0), videos.length - 1)
    viewport.current?.scrollTo({
      top: target * viewport.current.clientHeight,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    })
  }
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: '#000',
        color: '#fff',
      }}
      onPointerDownCapture={event => {
        if (!controlsVisible) {
          wakeOnly.current = true
          reveal()
          event.preventDefault()
          event.stopPropagation()
        }
      }}
      onClickCapture={event => {
        if (wakeOnly.current || !controlsVisible) {
          wakeOnly.current = false
          reveal()
          event.preventDefault()
          event.stopPropagation()
        }
      }}>
      <div
        ref={viewport}
        data-testid="shortsViewport"
        data-controls-visible={controlsVisible}
        role="region"
        aria-label={PRODUCT.id === 'news' ? l`Video` : l`Shorts`}
        tabIndex={0}
        style={{
          height: '100%',
          overflowY: 'auto',
          scrollSnapType: 'y mandatory',
          overscrollBehavior: 'contain',
          scrollbarWidth: 'none',
        }}
        onKeyDown={event => {
          if (event.target !== event.currentTarget || event.defaultPrevented)
            return
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            move(event.key === 'ArrowDown' ? 1 : -1)
          }
        }}
        onScroll={event =>
          setIndex(
            Math.round(
              event.currentTarget.scrollTop / event.currentTarget.clientHeight,
            ),
          )
        }>
        <ActiveVideo.Provider>
          {videos.map((article, position) => (
            <div
              key={article.item.uri}
              data-testid="shortsPage"
              data-post-uri={article.item.uri}
              style={{
                height: '100%',
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
                display: 'flex',
                justifyContent: 'center',
                padding: gtMobile ? '16px 80px' : 0,
                boxSizing: 'border-box',
              }}>
              <div
                style={{
                  position: 'relative',
                  height: '100%',
                  width: gtMobile
                    ? 'min(100%, calc((100dvh - 32px) * 9 / 16))'
                    : '100%',
                  display: 'flex',
                  borderRadius: gtMobile ? 24 : 0,
                  overflow: 'hidden',
                }}>
                <ShortsClip
                  article={article}
                  active={focused && index === position}
                  audio={audio}
                  controlsVisible={controlsVisible}
                />
              </div>
            </div>
          ))}
        </ActiveVideo.Provider>
        {(feed.isPending ||
          !videos.length ||
          feed.isError ||
          feed.isFetchingNextPage) && (
          <View
            style={[
              a.p_xl,
              a.align_center,
              a.justify_center,
              a.gap_md,
              !videos.length && {height: '100%'},
            ]}>
            {feed.isPending || feed.isFetchingNextPage ? (
              <Loader size="lg" />
            ) : feed.isError ? (
              <>
                <Text>
                  <Trans>Couldn’t load videos.</Trans>
                </Text>
                <Button
                  label={l`Try again`}
                  color="secondary"
                  size="small"
                  onPress={() =>
                    void (feed.isFetchNextPageError
                      ? feed.fetchNextPage()
                      : feed.refetch())
                  }>
                  <ButtonText>
                    <Trans>Try again</Trans>
                  </ButtonText>
                </Button>
              </>
            ) : (
              <Text>
                <Trans>No recent videos.</Trans>
              </Text>
            )}
          </View>
        )}
      </div>
      <ShortsChrome visible={controlsVisible}>
        {gtMobile && !!videos.length && (
          <View
            pointerEvents="auto"
            style={[a.absolute, a.gap_lg, {right: 24, top: '45%'}]}>
            <Button
              label={l`Previous video`}
              color="secondary"
              size="large"
              shape="round"
              disabled={index === 0}
              onPress={() => move(-1)}>
              <ButtonIcon icon={Up} />
            </Button>
            <Button
              label={l`Next video`}
              color="secondary"
              size="large"
              shape="round"
              disabled={index >= videos.length - 1}
              onPress={() => move(1)}>
              <ButtonIcon icon={Down} />
            </Button>
          </View>
        )}
      </ShortsChrome>
    </div>
  )
}

function ShortsClip({
  article,
  active,
  audio,
  controlsVisible,
}: {
  article: PostArticle
  active: boolean
  audio: VideoAudioState
  controlsVisible: boolean
}) {
  const opts = useModerationOpts()
  const post = usePostShadow(article.item.post)
  if (post === POST_TOMBSTONE)
    return (
      <Text>
        <Trans>Post has been deleted</Trans>
      </Text>
    )
  if (!opts || article.media?.type !== 'video') return null
  const moderation = articleModeration(article, opts)
  if (moderation.filter) return null
  const text = new RichTextAPI({
    text: article.item.record.text,
    facets: article.item.record.facets,
  })
  return (
    <ReportDialogMetadataContext.Provider key={post.uri}>
      <ContentHider
        testID="shortsClip"
        modui={moderation}
        style={[a.flex_1]}
        childContainerStyle={[a.flex_1]}>
        {active ? (
          <VideoEmbed
            embed={article.media.view}
            post={post}
            immersive
            overlay={<ShortsFade visible={controlsVisible} />}
            audio={audio}
            controlsVisible={controlsVisible}
          />
        ) : (
          <>
            <img
              src={article.media.view.thumbnail}
              alt=""
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
            <ShortsFade />
          </>
        )}
        <ShortsChrome visible={controlsVisible}>
          <View
            pointerEvents="auto"
            style={[a.absolute, a.gap_sm, {left: 16, right: 76, bottom: 56}]}>
            <View style={[a.flex_row, a.align_center, a.flex_wrap, a.gap_sm]}>
              <PublisherByline profile={post.author} />
              <PublisherFollowButton
                profile={post.author}
                moderationOpts={opts}
              />
            </View>
            <ShortsCaption value={text} authorHandle={post.author.handle} />
          </View>
          <div style={{pointerEvents: 'auto'}}>
            <ShortsActions
              post={post}
              record={article.item.record}
              richText={text}
            />
          </div>
        </ShortsChrome>
      </ContentHider>
    </ReportDialogMetadataContext.Provider>
  )
}
