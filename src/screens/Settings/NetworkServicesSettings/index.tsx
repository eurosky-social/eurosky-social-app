import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {Earth_Stroke2_Corner2_Rounded as EarthIcon} from '#/components/icons/Globe'
import * as Layout from '#/components/Layout'

type Props = NativeStackScreenProps<
  CommonNavigatorParams,
  'NetworkServicesSettings'
>

export function NetworkServicesSettingsScreen({}: Props) {
  const {t: l} = useLingui()

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Network services</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <SettingsList.LinkItem
            to="/settings/network-services/content-service"
            label={l`Content service`}>
            <SettingsList.ItemIcon icon={EarthIcon} />
            <SettingsList.ItemText>
              <Trans>Content service</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
        </SettingsList.Container>
      </Layout.Content>
    </Layout.Screen>
  )
}
