import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {HELP_DESK_URL as HELP_DESK_LINK} from '#/lib/constants'
import {usePalette} from '#/lib/hooks/usePalette'
import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {s} from '#/lib/styles'
import {TextLink} from '#/view/com/util/Link'
import {Text} from '#/view/com/util/text/Text'
import {ViewHeader} from '#/view/com/util/ViewHeader'
import {CenteredView} from '#/view/com/util/Views'
import * as Layout from '#/components/Layout'

/*
 * The help desk as shown in text: an email address without `mailto:`. It
 * keeps the name HELP_DESK_URL, which the translated sentence refers to.
 */
const HELP_DESK_URL = HELP_DESK_LINK.replace(/^mailto:/, '')

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Support'>
export const SupportScreen = (_props: Props) => {
  const pal = usePalette('default')
  const {_} = useLingui()

  return (
    <Layout.Screen>
      <ViewHeader title={_(msg`Support`)} />
      <CenteredView>
        <Text type="title-xl" style={[pal.text, s.p20, s.pb5]}>
          <Trans>Support</Trans>
        </Text>
        <Text style={[pal.text, s.p20]}>
          <Trans>
            The support form has been moved. If you need help, please{' '}
            <TextLink
              href={HELP_DESK_LINK}
              text={_(msg`click here`)}
              style={pal.link}
            />{' '}
            or visit {HELP_DESK_URL} to get in touch with us.
          </Trans>
        </Text>
      </CenteredView>
    </Layout.Screen>
  )
}
