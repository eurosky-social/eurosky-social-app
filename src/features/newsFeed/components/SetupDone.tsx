import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Divider} from '#/components/Divider'
import {Text} from '#/components/Typography'
import {SetupFooter} from './SetupFooter'

/**
 * The last step's footer. The selections are saved to the account's private
 * preferences (see `state/prefs.ts`), so finishing asks for no consent.
 */
export function SetupDone({onDone}: {onDone: () => void}) {
  const {t: l} = useLingui()
  const t = useTheme()

  return (
    <SetupFooter>
      <View style={[a.gap_md]}>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            Your selections are saved privately to your account. Only you can
            see them.
          </Trans>
        </Text>

        <Divider />

        <Button
          testID="newsFeedSourcesDoneBtn"
          label={l`Done`}
          size="large"
          color="primary"
          onPress={onDone}>
          <ButtonText>
            <Trans>Done</Trans>
          </ButtonText>
        </Button>
      </View>
    </SetupFooter>
  )
}
