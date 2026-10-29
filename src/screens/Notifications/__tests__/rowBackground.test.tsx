import {describe, expect, it, jest} from '@jest/globals'
import {renderHook} from '@testing-library/react-native'

import {useRowBackgroundColor} from '#/screens/Notifications/components/NotificationItem/Item/Root'
import {ThemeProvider} from '#/alf'
import {buildThemes} from '#/alf/themes'
import {type AccentKey, ACCENTS} from '#/config/brand-theme'

jest.mock('#/view/com/util/WebAuxClickWrapper', () => ({}))
jest.mock('#/components/Layout', () => ({}))
jest.mock('#/components/Link', () => ({}))
jest.mock('#/components/SubtleHover', () => ({}))

describe('notification row backgrounds', () => {
  for (const accent of Object.keys(ACCENTS) as AccentKey[]) {
    const themes = buildThemes(accent)
    for (const name of ['light', 'dim', 'dark'] as const) {
      it(`uses the ${accent} palette in the ${name} theme`, () => {
        const {result, rerender} = renderHook(
          ({isRead}: {isRead: boolean}) => useRowBackgroundColor(isRead),
          {
            initialProps: {isRead: false},
            wrapper: ({children}) => (
              <ThemeProvider theme={name} themesOverride={themes}>
                {children}
              </ThemeProvider>
            ),
          },
        )

        expect(result.current).toBe(themes[name].palette.primary_25)
        expect(result.current).not.toBe(themes[name].atoms.bg.backgroundColor)
        rerender({isRead: true})
        expect(result.current).toBe(themes[name].atoms.bg.backgroundColor)
      })
    }
  }
})
