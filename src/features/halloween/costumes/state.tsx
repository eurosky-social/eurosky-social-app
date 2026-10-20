import {createContext, useContext, useEffect, useState} from 'react'

import * as persisted from '#/state/persisted'
import {ColorHistoryProvider} from '#/features/halloween/costumes/colorHistory'
import {
  type Costume,
  costumeSchema,
  isEmpty,
  parseCostumes,
} from '#/features/halloween/costumes/model'

type Costumes = Record<string, Costume>
const EMPTY: Costumes = {}
const Context = createContext<{
  costumes: Costumes
  saveCostume: (did: string, costume: Costume | null) => Promise<void>
}>({costumes: EMPTY, saveCostume: async () => {}})

/** The only persistence boundary; rendering and editing only consume Costume. */
export function CostumesProvider({children}: React.PropsWithChildren<{}>) {
  const [costumes, setCostumes] = useState(() =>
    parseCostumes(persisted.get('halloweenCostumes')),
  )
  useEffect(() => {
    return persisted.onUpdate('halloweenCostumes', next => {
      setCostumes(parseCostumes(next))
    })
  }, [])

  const saveCostume = async (did: string, costume: Costume | null) => {
    if (!did.startsWith('did:'))
      throw new Error('A costume needs an account DID')
    const next = parseCostumes(persisted.readLatest('halloweenCostumes'))
    const validated = costume
      ? costumeSchema.parse({...costume, updatedAt: new Date().toISOString()})
      : null
    if (validated && !isEmpty(validated)) next[did] = validated
    else delete next[did]
    await persisted.write('halloweenCostumes', next)
    setCostumes(next)
  }

  return (
    <Context.Provider value={{costumes, saveCostume}}>
      <ColorHistoryProvider>{children}</ColorHistoryProvider>
    </Context.Provider>
  )
}

export function useCostumes() {
  return useContext(Context)
}
