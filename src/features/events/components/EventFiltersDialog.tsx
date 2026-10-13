import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  ClearableDateField,
  DEFAULT_DATE,
} from '#/screens/Search/components/AdvancedSearchDialog/ClearableDateField'
import {ClearableInput} from '#/screens/Search/components/AdvancedSearchDialog/ClearableInput'
import {atoms as a, native} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {SettingsSliderVertical_Stroke2_Corner0_Rounded as SettingsSliderIcon} from '#/components/icons/SettingsSlider'
import {type EventFilters, hasActiveFilters} from '../filters'

/** ClearableDateField caps dates at today by default; events are mostly ahead. */
const MAX_DATE = '2100-12-31'

/**
 * A "Filters" button that opens a dialog for narrowing the event feeds,
 * modelled on the search screen's AdvancedSearchDialog.
 */
export function EventFiltersDialog({
  filters,
  onApply,
}: {
  filters: EventFilters
  onApply: (filters: EventFilters) => void
}) {
  const {t: l} = useLingui()
  const control = Dialog.useDialogControl()

  return (
    <>
      <Button
        label={l`Open event filters`}
        size="small"
        color={hasActiveFilters(filters) ? 'primary_subtle' : 'secondary'}
        style={native([a.py_sm, a.px_sm])}
        onPress={() => control.open()}
        testID="eventFiltersBtn">
        <ButtonIcon icon={SettingsSliderIcon} />
        <ButtonText>
          <Trans context="events">Filters</Trans>
        </ButtonText>
      </Button>

      <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
        <Dialog.Handle />
        <DialogInner
          // Start from the applied filters each time the dialog opens.
          key={JSON.stringify(filters)}
          filters={filters}
          onApply={onApply}
        />
      </Dialog.Outer>
    </>
  )
}

function DialogInner({
  filters,
  onApply,
}: {
  filters: EventFilters
  onApply: (filters: EventFilters) => void
}) {
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const [location, setLocation] = useState(filters.location ?? '')
  const [from, setFrom] = useState(filters.from)
  const [to, setTo] = useState(filters.to)

  const onPressApply = () => {
    control.close(() => {
      onApply({location: location.trim() || undefined, from, to})
    })
  }

  return (
    <Dialog.ScrollableInner
      label={l`Dialog: Set event filters`}
      contentContainerStyle={[a.px_0, a.pt_0]}
      header={
        <Dialog.Header
          renderLeft={() => (
            <Button
              label={l`Cancel`}
              onPress={() => control.close()}
              size="small"
              color="secondary"
              variant="ghost"
              style={[a.rounded_full]}>
              <ButtonText>
                <Trans>Cancel</Trans>
              </ButtonText>
            </Button>
          )}
          renderRight={() => (
            <Button
              label={l`Apply filters`}
              onPress={onPressApply}
              size="small"
              color="primary"
              style={[a.rounded_full]}
              testID="applyEventFiltersBtn">
              <ButtonText>
                <Trans context="action">Apply</Trans>
              </ButtonText>
            </Button>
          )}>
          <Dialog.HeaderText>
            <Trans context="events">Filters</Trans>
          </Dialog.HeaderText>
        </Dialog.Header>
      }>
      <View style={[a.mt_xl, a.px_xl, a.gap_xl]}>
        <View>
          <TextField.LabelText>
            <Trans>Location</Trans>
          </TextField.LabelText>
          <ClearableInput
            label={l`Location`}
            defaultValue={location}
            placeholder={l({
              message: 'Amsterdam',
              comment:
                'Events filter: example of a place to filter events by, e.g. a city.',
            })}
            onChangeText={setLocation}
            onSubmitEditing={onPressApply}
          />
        </View>

        <View style={[a.flex_row, a.gap_lg]}>
          <View style={[a.flex_1]}>
            <TextField.LabelText>
              <Trans context="events">From</Trans>
            </TextField.LabelText>
            <ClearableDateField
              label={l({message: 'From', context: 'events'})}
              value={from ?? DEFAULT_DATE}
              active={!!from}
              accessibilityHint={l`Include events starting on or after this date`}
              // Can't choose a start later than the chosen end.
              maximumDate={to ?? MAX_DATE}
              onConfirm={setFrom}
              onClear={() => setFrom(undefined)}
            />
          </View>
          <View style={[a.flex_1]}>
            <TextField.LabelText>
              <Trans context="events">To</Trans>
            </TextField.LabelText>
            <ClearableDateField
              label={l({message: 'To', context: 'events'})}
              value={to ?? from ?? DEFAULT_DATE}
              active={!!to}
              accessibilityHint={l`Include events starting on or before this date`}
              maximumDate={MAX_DATE}
              // Can't choose an end earlier than the chosen start.
              minimumDate={from}
              onConfirm={setTo}
              onClear={() => setTo(undefined)}
            />
          </View>
        </View>
      </View>
    </Dialog.ScrollableInner>
  )
}
