import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import * as persisted from '#/state/persisted'

type PetRestBreaks = NonNullable<persisted.Schema['petRestBreaks']>
type SetContext = (next: Partial<PetRestBreaks>) => void

const defaultState = persisted.defaults.petRestBreaks!

const stateContext = createContext<PetRestBreaks>(defaultState)
stateContext.displayName = 'PetRestBreaksStateContext'

const setContext = createContext<SetContext>((_: Partial<PetRestBreaks>) => {})
setContext.displayName = 'PetRestBreaksSetContext'

export function Provider({children}: React.PropsWithChildren<{}>) {
  const [state, setState] = useState<PetRestBreaks>(
    () => persisted.get('petRestBreaks') ?? defaultState,
  )

  const setStateWrapped = useCallback((next: Partial<PetRestBreaks>) => {
    setState(prev => {
      const merged = {...prev, ...next}
      void persisted.write('petRestBreaks', merged)
      return merged
    })
  }, [])

  useEffect(() => {
    return persisted.onUpdate('petRestBreaks', next => {
      setState(next ?? defaultState)
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

export function usePetRestBreaks() {
  return useContext(stateContext)
}

export function useSetPetRestBreaks() {
  return useContext(setContext)
}
