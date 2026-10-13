export type DateTimeFieldProps = {
  label: string
  /** Undefined renders the placeholder. */
  value?: Date
  onChange: (date: Date | undefined) => void
  /** Shown on native when value is empty; web shows the browser's own. */
  placeholder?: string
  /** Where the picker opens when value is empty. Defaults to now. */
  initialDate?: Date
  minimumDate?: Date
  isInvalid?: boolean
  testID?: string
}
