import {useCallback, useEffect, useRef, useState} from 'react'
import {KeyboardAvoidingView, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  type NavigationAction,
  useFocusEffect,
  useIsFocused,
  usePreventRemove,
} from '@react-navigation/native'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'
import {useQuery, useQueryClient} from '@tanstack/react-query'

import {uploadBlob} from '#/lib/api'
import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {type CommonNavigatorParams} from '#/lib/routes/types'
import {cleanError, isNetworkError} from '#/lib/strings/errors'
import {logger} from '#/logger'
import {
  profilesQueryKeyRoot,
  RQKEY as profileKey,
} from '#/state/queries/profile'
import {useAppviewClient, usePdsClient, useSession} from '#/state/session'
import {useSetDrawerSwipeDisabled} from '#/state/shell'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Layout from '#/components/Layout'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {IS_IOS, IS_WEB} from '#/env'
import {useHalloween} from '#/features/halloween/context'
import {useColorHistory} from '#/features/halloween/costumes/colorHistory'
import {createCostumeImageFile} from '#/features/halloween/costumes/imageFile'
import {createCostume, isEmpty} from '#/features/halloween/costumes/model'
import {usePhotoSampler} from '#/features/halloween/costumes/photoPixels/usePhotoSampler'
import {PixelLayer} from '#/features/halloween/costumes/PixelLayer'
import {
  CostumeConflictError,
  type CostumeSource,
  loadCostumeSource,
  originalAvatarUrl,
  publishCostume,
  waitForCostumeAvatar,
} from '#/features/halloween/costumes/records'
import {
  COSTUME_IMAGE_SIZE,
  renderCostume,
} from '#/features/halloween/costumes/render'
import {useCostumes} from '#/features/halloween/costumes/state'
import {useDrawing} from '#/features/halloween/costumes/useDrawing'
import {CostumeWorkspace} from '#/features/halloween/costumes/Workspace'

type ScreenProps = NativeStackScreenProps<
  CommonNavigatorParams,
  'CostumeEditor'
>

export function CostumeEditorScreen(props: ScreenProps) {
  const {currentAccount} = useSession()
  const {isHalloween} = useHalloween()
  const client = usePdsClient()
  const {t: l} = useLingui()
  const source = useQuery({
    queryKey: ['halloweenCostumeSource', currentAccount?.did],
    queryFn: () => loadCostumeSource(client),
    enabled: !!currentAccount && isHalloween,
    refetchOnWindowFocus: false,
    gcTime: 0,
    retry: false,
  })
  if (!currentAccount) return null
  if (!source.data)
    return (
      <Layout.Screen>
        <Layout.Header.Outer>
          <Layout.Header.BackButton />
          <Layout.Header.TitleText>
            <Trans>Costume studio</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Outer>
        {!isHalloween ? (
          <Text>
            <Trans>
              The costume studio is available October 28–November 3.
            </Trans>
          </Text>
        ) : source.isError ? (
          <Button
            label={l`Retry loading costume`}
            onPress={() => source.refetch()}>
            <ButtonText>
              <Trans>Could not load your costume. Retry</Trans>
            </ButtonText>
          </Button>
        ) : (
          <ButtonText>
            <Trans>Loading…</Trans>
          </ButtonText>
        )}
      </Layout.Screen>
    )
  return (
    <Editor
      key={currentAccount.did}
      did={currentAccount.did}
      pdsUrl={currentAccount.pdsUrl ?? currentAccount.service}
      source={source.data}
      {...props}
    />
  )
}

function Editor({
  did,
  pdsUrl,
  navigation,
  source: initialSource,
}: ScreenProps & {did: string; pdsUrl: string; source: CostumeSource}) {
  const [source] = useState(initialSource)
  const {isHalloween} = useHalloween()
  const {t: l} = useLingui()
  const t = useTheme()
  const {bottom} = useSafeAreaInsets()
  const focused = useIsFocused()
  const client = usePdsClient()
  const queryClient = useQueryClient()
  const appviewClient = useAppviewClient()
  const {openComposer} = useOpenComposer()
  const {costumes} = useCostumes()
  const [initial] = useState(
    () => source.costume?.drawing ?? costumes[did] ?? createCostume(),
  )
  const avatar = originalAvatarUrl(did, source, pdsUrl)
  const [published, setPublished] = useState<{
    image: Awaited<ReturnType<typeof createCostumeImageFile>>
    costumeNumber: number
  }>()
  const publishPrompt = Prompt.usePromptControl()
  const collectPrompt = Prompt.usePromptControl()
  const handedToComposer = useRef(false)
  useEffect(
    () => () => {
      if (!handedToComposer.current) published?.image.dispose()
    },
    [published],
  )
  const colorHistory = useColorHistory()
  const samplePhoto = usePhotoSampler(avatar, t.palette.contrast_25)
  const drawing = useDrawing(
    initial,
    () =>
      Toast.show(
        l`This drawing uses all 256 colors. Reuse an existing color or undo a stroke.`,
        {type: 'error'},
      ),
    {
      samplePhoto,
      onColorUsed: color => colorHistory.used(did, color),
      onSampleMiss: () =>
        Toast.show(
          l`Couldn’t pick a color here. Try a painted area or another spot on your avatar.`,
        ),
    },
  )
  const [saving, setSaving] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const clearPrompt = Prompt.usePromptControl()
  const discardPrompt = Prompt.usePromptControl()
  const pendingAction = useRef<NavigationAction | null>(null)
  const setDrawerSwipeDisabled = useSetDrawerSwipeDisabled()

  useFocusEffect(
    useCallback(() => {
      setDrawerSwipeDisabled(true)
      return () => setDrawerSwipeDisabled(false)
    }, [setDrawerSwipeDisabled]),
  )

  usePreventRemove(
    (drawing.dirty || saving) && !leaving && !published,
    ({data}) => {
      if (saving) return
      pendingAction.current = data.action
      discardPrompt.open()
    },
  )

  useEffect(() => {
    if (!IS_WEB || (!drawing.dirty && !saving) || leaving || published) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [drawing.dirty, saving, leaving, published])

  useEffect(() => {
    if (!leaving) return
    const action = pendingAction.current
    if (action) navigation.dispatch(action)
    else if (navigation.canGoBack()) navigation.goBack()
    else navigation.replace('Profile', {name: did})
  }, [leaving, navigation, did])

  const save = async () => {
    if (!isHalloween) return
    const saved = drawing.end()
    pendingAction.current = null
    setSaving(true)
    let stage: 'image' | 'upload' | 'publish' = 'image'
    let publication: {
      image: Awaited<ReturnType<typeof createCostumeImageFile>>
      record: Awaited<ReturnType<typeof publishCostume>>
    }
    try {
      const bytes = await renderCostume(saved, avatar)
      const image = await createCostumeImageFile(bytes)
      try {
        stage = 'upload'
        const {blob} = await uploadBlob(client, image.uri, 'image/png')
        stage = 'publish'
        const record = await publishCostume(client, source, saved, blob)
        publication = {image, record}
      } catch (error) {
        image.dispose()
        throw error
      }
    } catch (error) {
      if (!(error instanceof CostumeConflictError) && !isNetworkError(error)) {
        logger.error('Costume publication failed', {stage, safeMessage: error})
      }
      const reason = cleanError(error)
      const message =
        error instanceof CostumeConflictError
          ? l`Your profile picture or costume changed in another window. Reopen the studio before publishing this drawing.`
          : stage === 'image'
            ? l`Could not prepare your costume image. ${reason}`
            : stage === 'upload'
              ? l`Could not upload your costume image. ${reason}`
              : l`Could not publish your costume. ${reason}`
      Toast.show(message, {type: 'error'})
      return
    } finally {
      setSaving(false)
    }

    /* Publication is already committed; a later UI failure must not report it as a failed write. */
    const {image, record} = publication
    setPublished({image, costumeNumber: record.costumeNumber})
    void waitForCostumeAvatar(appviewClient, did, record.avatar)
      .catch(() => {})
      .then(() => {
        void queryClient.invalidateQueries({queryKey: profileKey(did)})
        void queryClient.invalidateQueries({queryKey: [profilesQueryKeyRoot]})
      })
    queryClient.setQueryData(['halloweenCostume', did], {
      costumeNumber: record.costumeNumber,
    })
    Toast.show(l`Your profile picture has been updated`)
    collectPrompt.open()
  }

  return (
    <Layout.Screen
      minimalShell
      style={[t.atoms.bg, web({height: '100dvh', overflow: 'hidden'})]}
      testID="costumeEditorScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content align="left">
          <Layout.Header.TitleText>
            <Trans>Costume studio</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <View style={{width: 32, height: 32}}>
          <UserAvatar type="user" avatar={avatar} size={32} />
          <PixelLayer costume={drawing.costume} size={32} />
        </View>
        <Button
          testID="costumeSave"
          label={l`Save costume`}
          size="small"
          color="primary"
          disabled={
            !isHalloween ||
            (!drawing.dirty && (Boolean(source.costume) || isEmpty(initial))) ||
            saving ||
            leaving ||
            !!published
          }
          onPress={() => publishPrompt.open()}
          style={{minHeight: 44}}>
          <ButtonText>
            {saving ? <Trans>Saving…</Trans> : <Trans>Save</Trans>}
          </ButtonText>
        </Button>
      </Layout.Header.Outer>
      {!isHalloween && (
        <Text>
          <Trans>
            The costume studio is available October 28–November 3. Your draft
            has not been published.
          </Trans>
        </Text>
      )}
      <KeyboardAvoidingView
        behavior={IS_IOS ? 'padding' : undefined}
        style={[a.flex_1]}>
        <Layout.Center
          style={[a.flex_1, a.overflow_hidden, {paddingBottom: bottom}]}>
          <CostumeWorkspace
            drawing={drawing}
            active={focused}
            recentColors={colorHistory.colors[did] ?? []}
            avatar={avatar}
            disabled={saving || leaving || !!published}
            onClear={() => clearPrompt.open()}
          />
        </Layout.Center>
      </KeyboardAvoidingView>
      <Prompt.Basic
        control={publishPrompt}
        title={l`Update your public profile picture?`}
        description={l`Your costume will replace your profile picture and be visible on other apps too. Turning off Halloween mode won’t restore your old picture.`}
        confirmButtonCta={l`Publish costume`}
        onConfirm={() => {
          void save()
        }}
      />
      <Prompt.Outer control={collectPrompt} onClose={() => setLeaving(true)}>
        <Prompt.TitleText>
          <Trans>Post to collect candy</Trans>
        </Prompt.TitleText>
        <Prompt.DescriptionText>
          <Trans>
            Share your costume so people can give you candy by liking your post.
          </Trans>
        </Prompt.DescriptionText>
        <Prompt.Actions>
          <Prompt.Action
            cta={l`Create post`}
            shouldCloseOnPress={false}
            onPress={() => {
              if (!published) return
              handedToComposer.current = true
              collectPrompt.close(() => {
                openComposer({
                  logContext: 'Other',
                  text: l`Trick or treat! Like this post to give me candy. You can create your own costume on mu.social`,
                  imageUris: [
                    {
                      uri: published.image.uri,
                      width: COSTUME_IMAGE_SIZE,
                      height: COSTUME_IMAGE_SIZE,
                      altText: l`My Halloween costume`,
                    },
                  ],
                  halloweenCostumeNumber: published.costumeNumber,
                  onClose: published.image.dispose,
                })
              })
            }}
          />
          <Prompt.Cancel cta={l`Not now`} />
        </Prompt.Actions>
      </Prompt.Outer>
      <Prompt.Basic
        control={clearPrompt}
        title={l`Clear your drawing?`}
        description={l`Your photo will stay unchanged. You can undo this before saving.`}
        confirmButtonCta={l`Clear drawing`}
        confirmButtonColor="negative"
        onConfirm={drawing.clear}
      />
      <Prompt.Basic
        control={discardPrompt}
        title={l`Discard your costume changes?`}
        description={l`Your changes haven’t been saved.`}
        confirmButtonCta={l`Discard changes`}
        cancelButtonCta={l`Keep drawing`}
        confirmButtonColor="negative"
        onConfirm={() => setLeaving(true)}
      />
    </Layout.Screen>
  )
}
