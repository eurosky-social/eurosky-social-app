import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {FU_FEED_URI} from '#/lib/constants'
import {preferencesQueryKey} from '#/state/queries/preferences'
import {usePdsClient} from '#/state/session'
import {useSetSelectedFeed} from '#/state/shell/selected-feed'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {useNuxDialogContext} from '#/components/dialogs/nuxs'
import {createIsEnabledCheck} from '#/components/dialogs/nuxs/utils'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {IS_E2E} from '#/env'
import {isMuForYouFeed, pinMuForYouFeed} from './preferences'

export const enabled = createIsEnabledCheck(({preferences}) => {
  return (
    !IS_E2E &&
    !preferences.savedFeeds.some(feed => isMuForYouFeed(feed) && feed.pinned)
  )
})

/** Uses the shared NUX queue so dismissal is persisted per account on the server. */
export function MuForYouFeedAnnouncement() {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogControl()
  const {dismissActiveNux} = useNuxDialogContext()
  const client = usePdsClient()
  const queryClient = useQueryClient()
  const setSelectedFeed = useSetSelectedFeed()
  const {
    mutate: pinFeed,
    isPending,
    isError,
  } = useMutation({
    mutationFn: () => pinMuForYouFeed(client),
    onSuccess: async () => {
      await queryClient.invalidateQueries({queryKey: preferencesQueryKey})
      control.close(() => setSelectedFeed(`feedgen|${FU_FEED_URI}`))
    },
  })

  Dialog.useAutoOpen(control)

  return (
    <Dialog.Outer
      control={control}
      onClose={dismissActiveNux}
      testID="muForYouFeedAnnouncement"
      nativeOptions={{preventExpansion: true, preventDismiss: isPending}}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={l`Try Mu’s For You feed`}
        style={[web({maxWidth: 440})]}>
        <View style={[a.gap_xl]}>
          <View style={[a.gap_md]}>
            <Text style={[a.text_2xl, a.font_bold]}>
              <Trans>Try Mu’s For You feed</Trans>
            </Text>
            <Text style={[a.text_md, a.leading_snug]}>
              <Trans>
                Discover posts picked for you based on your interests. Add Mu’s
                personalized feed as your first pinned feed?
              </Trans>
            </Text>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              <Trans>
                Your other feeds will stay as they are. This change syncs with
                your account, and you can unpin or reorder the feed anytime.
              </Trans>
            </Text>
          </View>
          {isError && (
            <Text role="alert" style={[{color: t.palette.negative_500}]}>
              <Trans>Could not add the feed. Please try again.</Trans>
            </Text>
          )}
          <View style={[a.gap_sm]}>
            <Button
              testID="muForYouFeedAdd"
              label={l`Add as first feed`}
              size="large"
              color="primary"
              disabled={isPending}
              onPress={() => pinFeed()}>
              <ButtonText>
                <Trans>Add as first feed</Trans>
              </ButtonText>
              {isPending && <ButtonIcon icon={Loader} />}
            </Button>
            <Button
              testID="muForYouFeedDismiss"
              label={l`No thanks`}
              size="large"
              color="secondary"
              disabled={isPending}
              onPress={() => control.close()}>
              <ButtonText>
                <Trans>No thanks</Trans>
              </ButtonText>
            </Button>
          </View>
        </View>
        {!isPending && <Dialog.Close />}
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}
