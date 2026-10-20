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

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {useCurrentAccountProfile} from '#/state/queries/useCurrentAccountProfile'
import {useSession} from '#/state/session'
import {useSetDrawerSwipeDisabled} from '#/state/shell'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Layout from '#/components/Layout'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {IS_IOS, IS_WEB} from '#/env'
import {useColorHistory} from '#/features/halloween/costumes/colorHistory'
import {createCostume} from '#/features/halloween/costumes/model'
import {usePhotoSampler} from '#/features/halloween/costumes/photoPixels/usePhotoSampler'
import {PixelLayer} from '#/features/halloween/costumes/PixelLayer'
import {useCostumes} from '#/features/halloween/costumes/state'
import {useDrawing} from '#/features/halloween/costumes/useDrawing'
import {CostumeWorkspace} from '#/features/halloween/costumes/Workspace'

type ScreenProps = NativeStackScreenProps<
  CommonNavigatorParams,
  'CostumeEditor'
>

export function CostumeEditorScreen(props: ScreenProps) {
  const {currentAccount} = useSession()
  return currentAccount ? (
    <Editor key={currentAccount.did} did={currentAccount.did} {...props} />
  ) : null
}

function Editor({did, navigation}: ScreenProps & {did: string}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const {bottom} = useSafeAreaInsets()
  const focused = useIsFocused()
  const profile = useCurrentAccountProfile()
  const {costumes, saveCostume} = useCostumes()
  const [initial] = useState(() => costumes[did] ?? createCostume())
  const colorHistory = useColorHistory()
  const samplePhoto = usePhotoSampler(
    profile?.did === did ? profile.avatar : undefined,
    t.palette.contrast_25,
  )
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

  usePreventRemove(drawing.dirty && !leaving, ({data}) => {
    if (saving) return
    pendingAction.current = data.action
    discardPrompt.open()
  })

  useEffect(() => {
    if (!IS_WEB || !drawing.dirty || leaving) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [drawing.dirty, leaving])

  useEffect(() => {
    if (!leaving) return
    const action = pendingAction.current
    if (action) navigation.dispatch(action)
    else if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate('Profile', {name: did})
  }, [leaving, navigation, did])

  const save = async () => {
    const saved = drawing.end()
    pendingAction.current = null
    setSaving(true)
    try {
      await saveCostume(did, saved)
      Toast.show(l`Costume saved on this device`)
      setLeaving(true)
    } catch {
      Toast.show(l`Could not save your costume. Please try again.`, {
        type: 'error',
      })
    } finally {
      setSaving(false)
    }
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
          <UserAvatar
            type="user"
            avatar={profile?.did === did ? profile.avatar : undefined}
            size={32}
          />
          <PixelLayer costume={drawing.costume} size={32} />
        </View>
        <Button
          testID="costumeSave"
          label={l`Save costume`}
          size="small"
          color="primary"
          disabled={!drawing.dirty || saving || leaving}
          onPress={save}
          style={{minHeight: 44}}>
          <ButtonText>
            {saving ? <Trans>Saving…</Trans> : <Trans>Save</Trans>}
          </ButtonText>
        </Button>
      </Layout.Header.Outer>
      <KeyboardAvoidingView
        behavior={IS_IOS ? 'padding' : undefined}
        style={[a.flex_1]}>
        <Layout.Center
          style={[a.flex_1, a.overflow_hidden, {paddingBottom: bottom}]}>
          <CostumeWorkspace
            drawing={drawing}
            active={focused}
            recentColors={colorHistory.colors[did] ?? []}
            avatar={profile?.did === did ? profile.avatar : undefined}
            disabled={saving || leaving}
            onClear={() => clearPrompt.open()}
          />
        </Layout.Center>
      </KeyboardAvoidingView>
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
