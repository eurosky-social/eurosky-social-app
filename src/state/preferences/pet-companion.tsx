import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import * as persisted from '#/state/persisted'

type PetCompanion = NonNullable<persisted.Schema['petCompanion']>

type SetContext = (next: Partial<PetCompanion>) => void

const stateContext = createContext<PetCompanion>(
  persisted.defaults.petCompanion!,
)
stateContext.displayName = 'PetCompanionStateContext'

const setContext = createContext<SetContext>((_: Partial<PetCompanion>) => {})
setContext.displayName = 'PetCompanionSetContext'

export function Provider({children}: React.PropsWithChildren<{}>) {
  const [state, setState] = useState<PetCompanion>(
    () => persisted.get('petCompanion') ?? persisted.defaults.petCompanion!,
  )

  const setStateWrapped = useCallback(
    (next: Partial<PetCompanion>) => {
      setState(prev => {
        const merged = {...prev, ...next}
        void persisted.write('petCompanion', merged)
        return merged
      })
    },
    [setState],
  )

  useEffect(() => {
    return persisted.onUpdate('petCompanion', next => {
      if (next) setState(next)
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

export function usePetCompanion() {
  return useContext(stateContext)
}

export function useSetPetCompanion() {
  return useContext(setContext)
}
