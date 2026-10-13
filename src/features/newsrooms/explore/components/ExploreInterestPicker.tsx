import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {Earth_Stroke2_Corner2_Rounded as WorldIcon} from '#/components/icons/Globe'
import {PinLocation_Stroke2_Corner0_Rounded as PinIcon} from '#/components/icons/PinLocation'
import {SettingsGear2_Stroke2_Corner0_Rounded as SettingsGearIcon} from '#/components/icons/SettingsGear2'
import * as Menu from '#/components/Menu'
import {type NewsInterest} from '#/features/newsFeed/state/prefs'
import {SUB_LOCATIONS} from '../interests'
import {countryName, useInterestTitle} from '../useInterestTitle'
import {PickerButton, PickerItem} from './ExploreLocationPicker'

/**
 * Which of the reader's interests the spread shows. It takes the location
 * picker's place ahead of the topic chips, which then narrow within it. The
 * choice lives only on the page and is not saved. The news settings, where
 * the interests are made, close the menu.
 */
export function ExploreInterestPicker({
  interests,
  selectedId,
  onSelect,
  grouped,
}: {
  interests: NewsInterest[]
  selectedId: string
  onSelect: (interestId: string) => void
  /** Inside a `PickerGroup`. */
  grouped?: boolean
}) {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const titleOf = useInterestTitle()
  const current = interests.find(interest => interest.id === selectedId)

  return (
    <Menu.Root>
      <Menu.Trigger label={l`Choose an interest`}>
        {({props}) => (
          <PickerButton
            props={props}
            testID="exploreInterestPickerBtn"
            grouped={grouped}
            label={l`Choose an interest`}
            icon={current && current.countries.length > 0 ? PinIcon : WorldIcon}
            text={current ? titleOf(current) : ''}
          />
        )}
      </Menu.Trigger>
      <Menu.Outer>
        <Menu.Group>
          {interests.map(interest => (
            <PickerItem
              key={interest.id}
              name={titleOf(interest)}
              selected={interest.id === selectedId}
              onPress={() => onSelect(interest.id)}
            />
          ))}
        </Menu.Group>
        <Menu.Divider />
        <Menu.Group>
          <Menu.Item
            testID="newsSettingsBtn"
            label={l`Choose your news interests`}
            onPress={() => navigation.navigate('NewsSettings')}>
            <Menu.ItemIcon icon={SettingsGearIcon} />
            <Menu.ItemText>
              <Trans>Settings</Trans>
            </Menu.ItemText>
          </Menu.Item>
        </Menu.Group>
      </Menu.Outer>
    </Menu.Root>
  )
}

/**
 * Narrows one of the interest's countries to a place inside it - for now the
 * Netherlands to a province - or leaves the whole country. Not saved.
 */
export function ExploreSubLocationPicker({
  country,
  selectedId,
  onSelect,
  grouped,
}: {
  /** An ISO code with sub-locations (see `SUB_LOCATIONS`). */
  country: string
  /** A sub-location id, e.g. `nl-utrecht`; undefined is the whole country. */
  selectedId?: string
  onSelect: (subLocationId: string | undefined) => void
  /** Inside a `PickerGroup`. */
  grouped?: boolean
}) {
  const {t: l, i18n} = useLingui()
  const regions = SUB_LOCATIONS[country] ?? []
  const current = regions.find(region => region.id === selectedId)
  const name = countryName(country, i18n.locale)
  const wholeName = l`All of ${name}`

  return (
    <Menu.Root>
      <Menu.Trigger label={l`Narrow ${name} down`}>
        {({props}) => (
          <PickerButton
            props={props}
            testID="exploreSubLocationPickerBtn"
            grouped={grouped}
            label={l`Narrow ${name} down`}
            icon={PinIcon}
            text={current ? current.label : wholeName}
          />
        )}
      </Menu.Trigger>
      <Menu.Outer>
        <Menu.Group>
          <PickerItem
            name={wholeName}
            selected={!current}
            onPress={() => onSelect(undefined)}
          />
        </Menu.Group>
        <Menu.Divider />
        <Menu.Group>
          {regions.map(region => (
            <PickerItem
              key={region.id}
              name={region.label}
              selected={region.id === current?.id}
              onPress={() => onSelect(region.id)}
            />
          ))}
        </Menu.Group>
      </Menu.Outer>
    </Menu.Root>
  )
}
