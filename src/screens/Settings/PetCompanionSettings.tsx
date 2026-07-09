import {Pressable, View} from 'react-native'
import {type MessageDescriptor} from '@lingui/core'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {
  usePetCompanion,
  useSetPetCompanion,
} from '#/state/preferences/pet-companion'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import * as Toggle from '#/components/forms/Toggle'
import {Heart2_Stroke2_Corner0_Rounded as HeartIcon} from '#/components/icons/Heart2'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {PetSprite} from '#/features/petCompanion/PetSprite'
import {
  getSpecies,
  PET_LIST,
  resolveVariant,
} from '#/features/petCompanion/registry'
import {type Species} from '#/features/petCompanion/types'

const SWATCH_SIZE = 64

type Props = NativeStackScreenProps<
  CommonNavigatorParams,
  'PetCompanionSettings'
>
export function PetCompanionSettingsScreen({}: Props) {
  const {t: l, i18n} = useLingui()
  const t = useTheme()
  const {enabled, species: speciesId, variant} = usePetCompanion()
  const setPetCompanion = useSetPetCompanion()

  const species = getSpecies(speciesId)
  const currentVariant = resolveVariant(species, variant)

  // Switching species keeps the current coat if that species has it, otherwise
  // falls back to its default.
  const onSelectSpecies = (s: Species) =>
    setPetCompanion({species: s.id, variant: resolveVariant(s, variant)})

  // The animal picker collapses each family into a single entry: the family's
  // currently selected member when active, otherwise its first member.
  type AnimalOption = {
    key: string
    label: MessageDescriptor
    species: Species
    selected: boolean
  }
  const animalOptions: AnimalOption[] = []
  const seenFamilies = new Set<string>()
  for (const s of PET_LIST) {
    if (s.family) {
      if (seenFamilies.has(s.family.id)) continue
      seenFamilies.add(s.family.id)
      const selected = species.family?.id === s.family.id
      animalOptions.push({
        key: `family:${s.family.id}`,
        label: s.family.label,
        species: selected ? species : s,
        selected,
      })
    } else {
      animalOptions.push({
        key: s.id,
        label: s.label,
        species: s,
        selected: s.id === species.id,
      })
    }
  }

  // Members of the selected species' family, offered as breeds.
  const breeds = species.family
    ? PET_LIST.filter(s => s.family?.id === species.family?.id)
    : []

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Companion</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <SettingsList.Group contentContainerStyle={[a.gap_sm]}>
            <SettingsList.ItemIcon icon={HeartIcon} />
            <SettingsList.ItemText>
              <Trans>Companion</Trans>
            </SettingsList.ItemText>
            <Text
              style={[
                a.text_sm,
                a.leading_snug,
                t.atoms.text_contrast_medium,
                a.w_full,
              ]}>
              {i18n._(species.description)}
            </Text>
            <Toggle.Item
              name="pet_companion_enabled"
              label={l`Show the companion`}
              value={enabled}
              onChange={value => setPetCompanion({enabled: value})}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Show the companion</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
          </SettingsList.Group>

          {enabled && animalOptions.length > 1 && (
            <>
              <SettingsList.Divider />
              <View style={[a.px_xl, a.py_md, a.gap_md]}>
                <Text style={[a.text_md, a.font_bold, t.atoms.text]}>
                  <Trans>Animal</Trans>
                </Text>
                <View style={[a.flex_row, a.flex_wrap, a.gap_md]}>
                  {animalOptions.map(o => {
                    const label = i18n._(o.label)
                    return (
                      <Pressable
                        key={o.key}
                        accessibilityRole="button"
                        accessibilityState={{selected: o.selected}}
                        accessibilityLabel={label}
                        accessibilityHint={l`Selects this animal`}
                        onPress={() => onSelectSpecies(o.species)}
                        style={[a.align_center, a.gap_xs]}>
                        <Swatch selected={o.selected}>
                          <PetSprite
                            species={o.species}
                            variant={resolveVariant(o.species, variant)}
                            state={o.species.behavior.idle}
                            size={SWATCH_SIZE}
                          />
                        </Swatch>
                        <SwatchLabel selected={o.selected}>{label}</SwatchLabel>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            </>
          )}

          {enabled && breeds.length > 1 && (
            <>
              <SettingsList.Divider />
              <View style={[a.px_xl, a.py_md, a.gap_md]}>
                <Text style={[a.text_md, a.font_bold, t.atoms.text]}>
                  <Trans>Breed</Trans>
                </Text>
                <View style={[a.flex_row, a.flex_wrap, a.gap_md]}>
                  {breeds.map(s => {
                    const selected = s.id === species.id
                    const label = i18n._(s.label)
                    return (
                      <Pressable
                        key={s.id}
                        accessibilityRole="button"
                        accessibilityState={{selected}}
                        accessibilityLabel={label}
                        accessibilityHint={l`Selects this breed`}
                        onPress={() => onSelectSpecies(s)}
                        style={[a.align_center, a.gap_xs]}>
                        <Swatch selected={selected}>
                          <PetSprite
                            species={s}
                            variant={resolveVariant(s, variant)}
                            state={s.behavior.idle}
                            size={SWATCH_SIZE}
                          />
                        </Swatch>
                        <SwatchLabel selected={selected}>{label}</SwatchLabel>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            </>
          )}

          {enabled && species.variants.length > 1 && (
            <>
              <SettingsList.Divider />
              <View style={[a.px_xl, a.py_md, a.gap_md]}>
                <Text style={[a.text_md, a.font_bold, t.atoms.text]}>
                  <Trans>Color</Trans>
                </Text>
                <View style={[a.flex_row, a.flex_wrap, a.gap_md]}>
                  {species.variants.map(v => {
                    const selected = v === currentVariant
                    const label = i18n._(species.variantLabels[v])
                    return (
                      <Pressable
                        key={v}
                        accessibilityRole="button"
                        accessibilityState={{selected}}
                        accessibilityLabel={label}
                        accessibilityHint={l`Selects this coat color`}
                        onPress={() => setPetCompanion({variant: v})}
                        style={[a.align_center, a.gap_xs]}>
                        <Swatch selected={selected}>
                          <PetSprite
                            species={species}
                            variant={v}
                            state={species.behavior.idle}
                            size={SWATCH_SIZE}
                          />
                        </Swatch>
                        <SwatchLabel selected={selected}>{label}</SwatchLabel>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            </>
          )}
        </SettingsList.Container>
      </Layout.Content>
    </Layout.Screen>
  )
}

function Swatch({
  selected,
  children,
}: React.PropsWithChildren<{selected: boolean}>) {
  const t = useTheme()
  return (
    <View
      style={[
        a.align_center,
        a.justify_end,
        a.rounded_md,
        a.border,
        {width: SWATCH_SIZE + 12, height: SWATCH_SIZE + 12, paddingBottom: 2},
        selected
          ? {
              borderColor: t.palette.primary_500,
              borderWidth: 2,
              backgroundColor: t.palette.primary_25,
            }
          : [t.atoms.border_contrast_low, t.atoms.bg_contrast_25],
      ]}>
      {children}
    </View>
  )
}

function SwatchLabel({
  selected,
  children,
}: React.PropsWithChildren<{selected: boolean}>) {
  const t = useTheme()
  return (
    <Text
      style={[
        a.text_xs,
        selected
          ? {color: t.palette.primary_500}
          : t.atoms.text_contrast_medium,
      ]}>
      {children}
    </Text>
  )
}
