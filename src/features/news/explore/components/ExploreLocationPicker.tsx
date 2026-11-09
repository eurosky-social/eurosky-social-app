import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {ChevronBottom_Stroke2_Corner0_Rounded as ChevronDownIcon} from '#/components/icons/Chevron'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {Earth_Stroke2_Corner2_Rounded as WorldIcon} from '#/components/icons/Globe'
import {PinLocation_Stroke2_Corner0_Rounded as PinIcon} from '#/components/icons/PinLocation'
import * as Menu from '#/components/Menu'
import {type TriggerChildProps} from '#/components/Menu/types'
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
          <PickerButton
            props={props}
            testID="exploreLocationPickerBtn"
            label={l`Choose a location`}
            icon={Icon}
            text={current ? nameOf(current) : l`World`}
          />
        )}
      </Menu.Trigger>
      <Menu.Outer>
        <Menu.Group>
          {countries.map(region => (
            <PickerItem
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
                <PickerItem
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

/**
 * The pill a picker over the topic chips opens from: what the page is scoped
 * to, with a chevron saying it can change.
 */
export function PickerButton({
  props,
  testID,
  label,
  icon: Icon,
  leading,
  text,
}: {
  /** The trigger props `Menu.Trigger` hands its child. */
  props: TriggerChildProps['props']
  testID: string
  label: string
  icon: React.ComponentType<SVGIconProps>
  /** Shown in place of the icon, e.g. an interest's outlets. */
  leading?: React.ReactElement
  text: string
}) {
  const t = useTheme()
  return (
    <Button
      {...props}
      testID={testID}
      label={label}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_xs,
        a.rounded_full,
        a.px_md,
        a.py_xs,
        a.border,
        pillColors(t),
      ]}>
      {leading ?? <Icon size="sm" style={{color: t.palette.primary_500}} />}
      <Text
        emoji
        numberOfLines={1}
        style={[a.text_sm, a.font_bold, {color: t.palette.primary_500}]}>
        {text}
      </Text>
      <ChevronDownIcon size="xs" style={{color: t.palette.primary_500}} />
    </Button>
  )
}

function pillColors(t: ReturnType<typeof useTheme>) {
  return {
    borderColor: t.palette.primary_500,
    backgroundColor: t.palette.primary_25,
  }
}

/** One choice of a picker, ticked while it is the page's. */
export function PickerItem({
  name,
  selected,
  onPress,
  leading,
  trailing,
}: {
  name: string
  selected: boolean
  onPress: () => void
  /** Shown ahead of the name, e.g. an interest's outlets. */
  leading?: React.ReactNode
  /** Shown after the name, ahead of the radio, e.g. an edit button. */
  trailing?: React.ReactNode
}) {
  return (
    <Menu.Item label={name} onPress={onPress}>
      {leading}
      <Menu.ItemText>{name}</Menu.ItemText>
      {trailing}
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
