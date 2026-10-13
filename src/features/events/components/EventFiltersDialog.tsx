import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {ClearableInput} from '#/screens/Search/components/AdvancedSearchDialog/ClearableInput'
import {atoms as a, native} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {SettingsSliderVertical_Stroke2_Corner0_Rounded as SettingsSliderIcon} from '#/components/icons/SettingsSlider'
import {type EventFilters, hasActiveFilters} from '../filters'

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

  const onPressApply = () => {
    control.close(() => {
      onApply({location: location.trim() || undefined})
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
      </View>
    </Dialog.ScrollableInner>
  )
}
