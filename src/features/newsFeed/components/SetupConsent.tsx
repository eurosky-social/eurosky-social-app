import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Divider} from '#/components/Divider'
import * as Toggle from '#/components/forms/Toggle'
import {Text} from '#/components/Typography'
import {SetupFooter} from './SetupFooter'

/**
 * The last step's footer: the selections are published as a public record, so
 * finishing waits on the reader agreeing to that.
 */
export function SetupConsent({onDone}: {onDone: () => void}) {
  const {t: l} = useLingui()
  const [consented, setConsented] = useState(false)

  return (
    <SetupFooter>
      <View style={[a.gap_md]}>
        <Toggle.Item
          name="newsFeedConsent"
          label={l`Agree to publish your selections as a public record`}
          value={consented}
          onChange={setConsented}
          style={[a.align_start, a.gap_sm]}>
          <Toggle.Checkbox />
          <Text style={[a.flex_1, a.text_sm, a.leading_snug]}>
            <Trans>
              I understand my topic and source selections will be published as a
              public record linked to my account, and agree to share them.
            </Trans>
          </Text>
        </Toggle.Item>

        <Divider />

        <Button
          testID="newsFeedSourcesDoneBtn"
          label={l`Done`}
          size="large"
          color="primary"
          disabled={!consented}
          onPress={onDone}>
          <ButtonText>
            <Trans>Done</Trans>
          </ButtonText>
        </Button>
      </View>
    </SetupFooter>
  )
}
