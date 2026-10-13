import {forwardRef} from 'react'
import {StyleSheet, type TextInput, type TextInputProps} from 'react-native'
// @ts-expect-error untyped
import {unstable_createElement} from 'react-native-web'

import * as TextField from '#/components/forms/TextField'
import {CalendarDays_Stroke2_Corner0_Rounded as CalendarDays} from '#/components/icons/CalendarDays'
import {type DateTimeFieldProps} from './types'

const InputBase = forwardRef<HTMLInputElement, TextInputProps>(
  ({style, ...props}, ref) => {
    // oxlint-disable-next-line typescript/no-unsafe-call
    return unstable_createElement('input', {
      ...props,
      ref,
      type: 'datetime-local',
      style: [
        StyleSheet.flatten(style),
        {
          background: 'transparent',
          border: 0,
        },
      ],
    })
  },
)

InputBase.displayName = 'InputBase'

const Input = TextField.createInput(InputBase as unknown as typeof TextInput)

/**
 * Date and time input in the user's local time zone, using the browser's
 * `datetime-local` input.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  minimumDate,
  isInvalid,
  testID,
}: DateTimeFieldProps) {
  return (
    <TextField.Root isInvalid={isInvalid}>
      <TextField.Icon icon={CalendarDays} />
      <Input
        value={value ? toLocalInputValue(value) : ''}
        label={label}
        // A `datetime-local` value has no zone, so it parses as local time.
        onChange={e => {
          // On web, the event target is the underlying <input>.
          const raw = (e.target as unknown as HTMLInputElement).value
          const next = raw ? new Date(raw) : undefined
          onChange(next && !isNaN(next.getTime()) ? next : undefined)
        }}
        testID={testID}
        // @ts-expect-error not typed as <input type="datetime-local">
        min={minimumDate ? toLocalInputValue(minimumDate) : undefined}
      />
    </TextField.Root>
  )
}

/** Formats as `YYYY-MM-DDTHH:mm` in local time, as the input expects. */
function toLocalInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}
