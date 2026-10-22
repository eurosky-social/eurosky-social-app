import {type TextStyle, type ViewStyle} from 'react-native'

/**
 * Oso's logo green and the text colour on these buttons. The green is too
 * light for the app's accent ramp, so the sign-in buttons set it here.
 */
const OSO_GREEN = '#55FF80'
const OSO_GREEN_HOVER = '#3DF06C'
const OSO_BLACK = '#000000'

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
