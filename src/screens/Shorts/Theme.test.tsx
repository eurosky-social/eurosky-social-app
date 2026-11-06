import {useContext} from 'react'
import {render} from '@testing-library/react-native'

import {type Alf, Context} from '#/alf'
import {ShortsTheme} from './Theme'

jest.mock('#/alf', () => {
  const React = require('react') as typeof import('react')
  const Context = React.createContext<unknown>(undefined)
  return {Context, useAlf: () => React.useContext(Context)}
})
const seen = jest.fn((_label: string, _alf: Alf) => {})
function Probe({label}: {label: string}) {
  seen(label, useContext(Context))
  return null
}
beforeEach(() => seen.mockClear())

it.each(['light', 'dim', 'dark'] as const)(
  'uses dark colors over Shorts without changing the saved %s theme, accent or fonts',
  themeName => {
    const themes = {
      light: {
        atoms: {text: {color: '#111111'}},
        palette: {primary_500: '#12abcd'},
      },
      dark: {
        atoms: {text: {color: '#ffffff'}},
        palette: {primary_500: '#12abcd'},
      },
      dim: {
        atoms: {text: {color: '#dddddd'}},
        palette: {primary_500: '#12abcd'},
      },
    }
    const saved = Object.freeze({
      themeName,
      themes,
      theme: themes[themeName],
      fonts: {scale: 1.2, setFontScale: jest.fn()},
      flags: {},
    }) as unknown as Alf
    function tree(active: boolean) {
      return (
        <Context.Provider value={saved}>
          <Probe label="outside" />
          {active ? (
            <ShortsTheme>
              <Probe label="sidebar" />
            </ShortsTheme>
          ) : (
            <Probe label="sidebar" />
          )}
        </Context.Provider>
      )
    }
    const {rerender} = render(tree(true))
    const inside = seen.mock.calls.find(([label]) => label === 'sidebar')![1]
    expect(inside.themeName).toBe('dark')
    expect(inside.theme.atoms.text.color).toBe('#ffffff')
    expect(inside.theme).toBe(saved.themes.dark)
    expect(inside.themes).toBe(saved.themes)
    expect(inside.fonts).toBe(saved.fonts)
    expect(inside.flags).toBe(saved.flags)
    expect(seen.mock.calls.find(([label]) => label === 'outside')![1]).toBe(
      saved,
    )
    expect(saved.themeName).toBe(themeName)
    rerender(tree(false))
    expect(seen.mock.calls.at(-1)![1]).toBe(saved)
  },
)
