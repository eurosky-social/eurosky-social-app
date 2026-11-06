import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a} from '#/alf'
import * as Prompt from '#/components/Prompt'
import {AccountActionIdentity} from './AccountActionIdentity'
import {type AccountAction, AccountActionWarning} from './AccountActionWarning'

/**
 * First screen of the delete and deactivate flows. Both continue on the
 * account footprint dialog, where the real action lives.
 */
export function AccountActionIntro({
  action,
  onPressWhatWillILose,
}: {
  action: AccountAction
  onPressWhatWillILose: () => void
}) {
  const {t: l} = useLingui()

  return (
    <>
      <Prompt.Content>
        <AccountActionIdentity />
        <Prompt.TitleText>
          {action === 'delete' ? (
            <Trans>Delete your account</Trans>
          ) : (
            <Trans>Deactivate your account</Trans>
          )}
        </Prompt.TitleText>
        <View style={[a.mt_xs]}>
          <AccountActionWarning action={action} />
        </View>
      </Prompt.Content>
      <Prompt.Actions>
        <Prompt.Action
          testID={`${action}AccountWhatWillILoseButton`}
          color="primary"
          cta={
            action === 'delete'
              ? l`See what will be deleted`
              : l`See what will be hidden`
          }
          shouldCloseOnPress={false}
          onPress={onPressWhatWillILose}
        />
        <Prompt.Cancel />
      </Prompt.Actions>
    </>
  )
}
