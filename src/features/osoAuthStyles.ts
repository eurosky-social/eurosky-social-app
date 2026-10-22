import {type TextStyle, type ViewStyle} from 'react-native'

/**
 * Oso's logo green and the text colour on it. The green is too light for the
 * app's accent ramp, so Oso's buttons and fields set it directly.
 */
const OSO_GREEN = '#55FF80'
const OSO_GREEN_HOVER = '#3DF06C'
/** A disabled green button. */
const OSO_GREEN_DISABLED = '#BFFFD0'
/** Border of a focused field, darker so focus reads against the green. */
const OSO_GREEN_FOCUS = '#1FCF58'
const OSO_BLACK = '#000000'
/** The purple of the logo's lettering. */
const OSO_PURPLE = '#563FFF'

export const osoColors = {
  green: OSO_GREEN,
  greenHover: OSO_GREEN_HOVER,
  greenDisabled: OSO_GREEN_DISABLED,
  greenFocus: OSO_GREEN_FOCUS,
  black: OSO_BLACK,
  purple: OSO_PURPLE,
}

/**
 * Styles for the signed-out screens' buttons. Pass `style` and `hoverStyle` to
 * a `Button` (any variant) and `text` to its `ButtonText`.
 */
export const osoButton: Record<
  'greenOutline' | 'greenFilled',
  {style: ViewStyle; hoverStyle: ViewStyle; text: TextStyle}
> = {
  /** White with a green border, for second actions such as "Back". */
  greenOutline: {
    style: {
      backgroundColor: '#FFFFFF',
      borderColor: OSO_GREEN,
      borderWidth: 2,
    },
    hoverStyle: {
      backgroundColor: '#EDFFF1',
      borderColor: OSO_GREEN,
      // Same width as at rest, or the button resizes on hover.
      borderWidth: 2,
    },
    // Black, since the button stays white in dark mode too.
    text: {color: OSO_BLACK},
  },
  /** Filled green, like the logo, for the action the screen is ready for. */
  greenFilled: {
    style: {
      backgroundColor: OSO_GREEN,
      borderColor: OSO_GREEN,
      borderWidth: 2,
    },
    hoverStyle: {
      backgroundColor: OSO_GREEN_HOVER,
      borderColor: OSO_GREEN_HOVER,
      // Same width as at rest, or the button resizes on hover.
      borderWidth: 2,
    },
    text: {color: OSO_BLACK},
  },
}

/**
 * Styles for a text field on the signed-out screens: white with a green
 * border, black text and icon. Pass `chrome` as the input's `chromeStyle`,
 * `text` as its `style` and `iconColor` to `TextField.Icon`.
 */
export const osoField: {chrome: ViewStyle; text: TextStyle; iconColor: string} =
  {
    chrome: {
      backgroundColor: '#FFFFFF',
      borderColor: OSO_GREEN,
      borderWidth: 2,
    },
    // Black, since the field stays white in dark mode too.
    text: {color: OSO_BLACK},
    iconColor: OSO_BLACK,
  }
