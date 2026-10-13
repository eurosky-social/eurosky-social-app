import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme, web} from '#/alf'
import {Text} from '#/components/Typography'
import {type EventSort} from '../filters'

/**
 * "Sort by date" / "Sort by recently added", where the underlined part is a
 * text button that switches to the other order.
 */
export function EventSortToggle({
  sort,
  onChange,
}: {
  sort: EventSort
  onChange: (sort: EventSort) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()

  return (
    <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
      {sort === 'date' ? (
        <Trans comment="Events list sort order. The underlined part is a button that switches to sorting by recently added.">
          Sort by{' '}
          <SortButtonText
            label={l`Sorted by date. Sort by recently added instead`}
            onPress={() => onChange('recent')}>
            date
          </SortButtonText>
        </Trans>
      ) : (
        <Trans comment="Events list sort order. The underlined part is a button that switches to sorting by date.">
          Sort by{' '}
          <SortButtonText
            label={l`Sorted by recently added. Sort by date instead`}
            onPress={() => onChange('date')}>
            recently added
          </SortButtonText>
        </Trans>
      )}
    </Text>
  )
}

function SortButtonText({
  label,
  onPress,
  children,
}: {
  label: string
  onPress: () => void
  children?: React.ReactNode
}) {
  const t = useTheme()

  return (
    <Text
      role="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint=""
      onPress={onPress}
      style={[
        a.text_sm,
        a.font_medium,
        t.atoms.text,
        {textDecorationLine: 'underline'},
        web({cursor: 'pointer'}),
      ]}
      testID="eventSortToggle">
      {children}
    </Text>
  )
}
