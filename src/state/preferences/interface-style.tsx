import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import * as persisted from '#/state/persisted'

type InterfaceStyle = Required<NonNullable<persisted.Schema['interfaceStyle']>>
type SetContext = (next: Partial<InterfaceStyle>) => void

const DEFAULT = persisted.defaults.interfaceStyle as InterfaceStyle

function resolve(value: persisted.Schema['interfaceStyle']): InterfaceStyle {
  return {...DEFAULT, ...value}
}

const stateContext = createContext<InterfaceStyle>(DEFAULT)
stateContext.displayName = 'InterfaceStyleStateContext'

const setContext = createContext<SetContext>((_: Partial<InterfaceStyle>) => {})
setContext.displayName = 'InterfaceStyleSetContext'

export function Provider({children}: React.PropsWithChildren<{}>) {
  const [state, setState] = useState(() =>
    resolve(persisted.get('interfaceStyle')),
  )

  const setStateWrapped = useCallback((next: Partial<InterfaceStyle>) => {
    setState(prev => {
      const merged = {...prev, ...next}
      void persisted.write('interfaceStyle', merged)
      return merged
    })
  }, [])

  useEffect(() => {
    return persisted.onUpdate('interfaceStyle', next => {
      setState(resolve(next))
    })
  }, [])

  return (
    <stateContext.Provider value={state}>
      <setContext.Provider value={setStateWrapped}>
        {children}
      </setContext.Provider>
    </stateContext.Provider>
  )
}

export function useInterfaceStyle() {
  return useContext(stateContext)
}

export function useSetInterfaceStyle() {
  return useContext(setContext)
}
