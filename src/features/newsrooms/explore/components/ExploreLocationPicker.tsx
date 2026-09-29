import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {ChevronBottom_Stroke2_Corner0_Rounded as ChevronDownIcon} from '#/components/icons/Chevron'
import {PinLocation_Stroke2_Corner0_Rounded as PinIcon} from '#/components/icons/PinLocation'
import * as Menu from '#/components/Menu'
import {Text} from '#/components/Typography'
import {useDutchCategoriesQuery} from '../../dutch/queries'

/**
 * Which region Local News is for. A stand-in until there is a real way to
 * declare a reader's locale: the choice lives only on the page, is not saved,
 * and starts on every region at once. The regions are the Dutch labeler's
 * provinces, so picking one narrows the page to stories placed there.
 */
export function ExploreLocationPicker({
  selected,
  onSelect,
}: {
  /** A province label value, e.g. `nl-utrecht`; undefined for all of them. */
  selected?: string
  onSelect: (region: string | undefined) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {categories} = useDutchCategoriesQuery()
  const provinces = categories
    .filter(category => category.kind === 'province')
    .sort((x, y) => x.name.localeCompare(y.name))
  const current = provinces.find(province => province.val === selected)
  const everywhere = l`All of the Netherlands`

  return (
    <Menu.Root>
      <Menu.Trigger label={l`Choose your region`}>
        {({props}) => (
          <Button
            {...props}
            testID="exploreLocationPickerBtn"
            label={l`Choose your region`}
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
            <PinIcon size="sm" style={{color: t.palette.primary_500}} />
            <Text
              emoji
              numberOfLines={1}
              style={[a.text_sm, a.font_bold, {color: t.palette.primary_500}]}>
              {current?.name ?? everywhere}
            </Text>
            <ChevronDownIcon size="xs" style={{color: t.palette.primary_500}} />
          </Button>
        )}
      </Menu.Trigger>
      <Menu.Outer>
        <Menu.Group>
          <Menu.Item label={everywhere} onPress={() => onSelect(undefined)}>
            <Menu.ItemText>{everywhere}</Menu.ItemText>
            <Menu.ItemRadio selected={!selected} />
          </Menu.Item>
        </Menu.Group>
        <Menu.Divider />
        <Menu.Group>
          {provinces.map(province => (
            <Menu.Item
              key={province.val}
              label={province.name}
              onPress={() => onSelect(province.val)}>
              <Menu.ItemText>{province.name}</Menu.ItemText>
              <Menu.ItemRadio selected={province.val === selected} />
            </Menu.Item>
          ))}
        </Menu.Group>
      </Menu.Outer>
    </Menu.Root>
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
