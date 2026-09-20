import {ScrollView} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {Text} from '#/components/Typography'
import {type ExploreSection} from '../sections'

/**
 * Narrows the spread to one section. Filtering rather than jumping: sections
 * the reader is not asking for leave the page, so a phone-width column does not
 * become a long scroll to reach the section they wanted.
 */
export function ExploreSectionChips({
  sections,
  selectedId,
  onSelect,
}: {
  /** Only the topics that actually have stories today. */
  sections: ExploreSection[]
  /** Undefined shows every topic. */
  selectedId?: string
  onSelect: (sectionId: string | undefined) => void
}) {
  const {i18n, t: l} = useLingui()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[a.flex_row, a.align_center, a.gap_sm, a.px_lg]}>
      <Chip
        active={!selectedId}
        text={l`All`}
        label={l`Show every topic`}
        onPress={() => onSelect(undefined)}
      />
      {sections.map(section => (
        <Chip
          key={section.id}
          active={section.id === selectedId}
          text={i18n._(section.label)}
          label={l`Show only ${i18n._(section.label)}`}
          onPress={() => onSelect(section.id)}
        />
      ))}
    </ScrollView>
  )
}

function Chip({
  active,
  text,
  label,
  onPress,
}: {
  active: boolean
  /** The section name shown on the chip. */
  text: string
  /** What pressing it does, for assistive tech. */
  label: string
  onPress: () => void
}) {
  const t = useTheme()

  return (
    <Button
      label={label}
      onPress={onPress}
      style={[
        a.rounded_full,
        a.px_md,
        a.py_xs,
        a.border,
        active
          ? {
              borderColor: t.atoms.text.color,
              backgroundColor: t.atoms.text.color,
            }
          : [t.atoms.border_contrast_low, t.atoms.bg],
      ]}>
      <Text
        style={[
          a.text_sm,
          a.font_bold,
          active
            ? {color: t.atoms.bg.backgroundColor}
            : t.atoms.text_contrast_medium,
        ]}>
        {text}
      </Text>
    </Button>
  )
}
