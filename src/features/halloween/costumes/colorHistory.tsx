import {createContext, useContext, useEffect, useState} from 'react'
import {z} from 'zod'

import * as persisted from '#/state/persisted'
import {normalizeHex} from '#/features/halloween/costumes/colors'

const schema = z.record(z.array(z.string().regex(/^#[0-9A-F]{6}$/)).max(24))
type History = z.infer<typeof schema>
const Context = createContext<{
  colors: History
  used: (did: string, color: string) => void
}>({colors: {}, used: () => {}})
const parse = (value: unknown): History => {
  const result = schema.safeParse(value)
  return result.success ? result.data : {}
}

/** Device-only editor preference, deliberately separate from portable costume data. */
export function ColorHistoryProvider({children}: React.PropsWithChildren<{}>) {
  const [colors, setColors] = useState(() =>
    parse(persisted.get('halloweenCostumeColors')),
  )
  useEffect(
    () =>
      persisted.onUpdate('halloweenCostumeColors', next =>
        setColors(parse(next)),
      ),
    [],
  )
  const used = (did: string, value: string) => {
    const color = normalizeHex(value)
    if (!color || !did.startsWith('did:')) return
    const latest = parse(persisted.readLatest('halloweenCostumeColors'))
    if (latest[did]?.[0] === color) return
    const next = {
      ...latest,
      [did]: [
        color,
        ...(latest[did] ?? []).filter(item => item !== color),
      ].slice(0, 24),
    }
    setColors(next)
    void persisted.write('halloweenCostumeColors', next)
  }
  return <Context.Provider value={{colors, used}}>{children}</Context.Provider>
}

export function useColorHistory() {
  return useContext(Context)
}
