import {useState} from 'react'
import {Keyboard, Pressable} from 'react-native'
import DatePicker from 'react-native-date-picker'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import * as TextField from '#/components/forms/TextField'
import {useInteractionState} from '#/components/hooks/useInteractionState'
import {CalendarDays_Stroke2_Corner0_Rounded as CalendarDays} from '#/components/icons/CalendarDays'
import {Text} from '#/components/Typography'
import {type DateTimeFieldProps} from './types'

/**
 * Date and time input in the user's local time zone. Looks like a text field,
 * but opens the platform's date and time picker in a modal.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  placeholder,
  initialDate,
  minimumDate,
  isInvalid,
  testID,
}: DateTimeFieldProps) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const [open, setOpen] = useState(false)
  const {
    state: pressed,
    onIn: onPressIn,
    onOut: onPressOut,
  } = useInteractionState()
  const {chromeFocus, chromeError} = TextField.useSharedInputStyles()

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={l`Opens a date and time picker`}
        onPress={() => {
          Keyboard.dismiss()
          setOpen(true)
        }}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        testID={testID}
        style={[
          a.flex_row,
          a.align_center,
          a.w_full,
          {
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: 'transparent',
          },
          t.atoms.bg_contrast_50,
          pressed && chromeFocus,
          isInvalid && chromeError,
        ]}>
        <TextField.Icon icon={CalendarDays} />
        <Text
          style={[
            a.pl_xs,
            a.text_md,
            value ? t.atoms.text : t.atoms.text_contrast_low,
          ]}>
          {value
            ? i18n.date(value, {dateStyle: 'medium', timeStyle: 'short'})
            : placeholder}
        </Text>
      </Pressable>
      {open && (
        <DatePicker
          modal
          open
          mode="datetime"
          title={label}
          theme={t.scheme}
          // Android only takes hex button colors that ignore the theme.
          buttonColor={t.name === 'light' ? '#000000' : '#ffffff'}
          date={value ?? initialDate ?? new Date()}
          minimumDate={minimumDate}
          locale={i18n.locale}
          is24hourSource="locale"
          onConfirm={date => {
            setOpen(false)
            onChange(date)
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  )
}
