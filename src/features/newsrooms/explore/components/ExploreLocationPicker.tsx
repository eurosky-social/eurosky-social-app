import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {ChevronBottom_Stroke2_Corner0_Rounded as ChevronDownIcon} from '#/components/icons/Chevron'
import {Earth_Stroke2_Corner2_Rounded as WorldIcon} from '#/components/icons/Globe'
import {PinLocation_Stroke2_Corner0_Rounded as PinIcon} from '#/components/icons/PinLocation'
import * as Menu from '#/components/Menu'
import {Text} from '#/components/Typography'
import {type NewsRegion} from '#/features/newsFeed/sources'
import {WORLD_REGION} from '../locations'

/**
 * Which part of the world the spread is for. The regions are the news
 * settings' own, narrowed to those picked there (see `pickerRegions`), so the
 * menu lists the places the reader follows. The choice itself lives only on
 * the page and is not saved.
 */
export function ExploreLocationPicker({
  regions,
  selected,
  onSelect,
}: {
  /** The world first, then the countries and provinces on offer. */
  regions: NewsRegion[]
  /** A region id from the news settings, e.g. `global` or `nl-utrecht`. */
  selected: string
  onSelect: (regionId: string) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const countries = regions.filter(region => !region.parent)
  const provinces = regions.filter(region => region.parent)

  /* The settings call these by what they are; the menu by what they show. */
  function nameOf(region: NewsRegion) {
    if (region.id === WORLD_REGION) return l`World`
    if (region.id === 'netherlands') return l`All of the Netherlands`
    return region.label
  }

  const current = regions.find(region => region.id === selected)
  const Icon = selected === WORLD_REGION ? WorldIcon : PinIcon

  return (
    <Menu.Root>
      <Menu.Trigger label={l`Choose a location`}>
        {({props}) => (
          <Button
            {...props}
            testID="exploreLocationPickerBtn"
            label={l`Choose a location`}
            style={[
              a.flex_row,
              a.align_center,
              a.gap_xs,
              a.rounded_full,
              a.px_md,
              a.py_xs,
              a.border,
              {
                borderColor: t.palette.primary_500,
                backgroundColor: t.palette.primary_25,
              },
            ]}>
            <Icon size="sm" style={{color: t.palette.primary_500}} />
            <Text
              emoji
              numberOfLines={1}
              style={[a.text_sm, a.font_bold, {color: t.palette.primary_500}]}>
              {current ? nameOf(current) : l`World`}
            </Text>
            <ChevronDownIcon size="xs" style={{color: t.palette.primary_500}} />
          </Button>
        )}
      </Menu.Trigger>
      <Menu.Outer>
        <Menu.Group>
          {countries.map(region => (
            <LocationItem
              key={region.id}
              name={nameOf(region)}
              selected={region.id === selected}
              onPress={() => onSelect(region.id)}
            />
          ))}
        </Menu.Group>
        {provinces.length > 0 && (
          <>
            <Menu.Divider />
            <Menu.Group>
              {provinces.map(region => (
                <LocationItem
                  key={region.id}
                  name={nameOf(region)}
                  selected={region.id === selected}
                  onPress={() => onSelect(region.id)}
                />
              ))}
            </Menu.Group>
          </>
        )}
      </Menu.Outer>
    </Menu.Root>
  )
}

function LocationItem({
  name,
  selected,
  onPress,
}: {
  name: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Menu.Item label={name} onPress={onPress}>
      <Menu.ItemText>{name}</Menu.ItemText>
      <Menu.ItemRadio selected={selected} />
    </Menu.Item>
  )
}

/** The rule between the picker and the topic chips. */
export function LocationPickerRule() {
  const t = useTheme()
  return (
    <View
      style={[
        a.self_stretch,
        a.border_l,
        a.mx_2xs,
        t.atoms.border_contrast_low,
      ]}
    />
  )
}
