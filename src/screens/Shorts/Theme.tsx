import {Context, useAlf} from '#/alf'

/** Match the black canvas without resetting parent fonts, accent themes or preferences. */
export function ShortsTheme({children}: React.PropsWithChildren<{}>) {
  const alf = useAlf()
  return (
    <Context.Provider
      value={{...alf, themeName: 'dark', theme: alf.themes.dark}}>
      {children}
    </Context.Provider>
  )
}
