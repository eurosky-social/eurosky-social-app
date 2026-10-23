import {createContext, useContext, useEffect, useState} from 'react'

import {onAppStateChange} from '#/lib/appState'
import * as persisted from '#/state/persisted'
import {CostumesProvider} from '#/features/halloween/costumes/state'
import {
  getHalloweenDate,
  getNextDateCheckDelay,
  type HalloweenPreference,
  resolveHalloween,
} from '#/features/halloween/date'

const DEFAULT: HalloweenPreference = {enabled: false}
const previewEnabled =
  __DEV__ && process.env.EXPO_PUBLIC_HALLOWEEN_PREVIEW === 'true'

function readDate() {
  const date = getHalloweenDate(new Date())
  return previewEnabled ? {...date, isHalloween: true} : date
}

type HalloweenContext = ReturnType<typeof resolveHalloween> & {
  setEnabled: (enabled: boolean) => void
  dismissInvitation: () => void
  dismissCostumeInvitation: () => void
}

const Context = createContext<HalloweenContext>({
  ...resolveHalloween(DEFAULT, {year: 0, isHalloween: false}),
  setEnabled: () => {},
  dismissInvitation: () => {},
  dismissCostumeInvitation: () => {},
})
Context.displayName = 'HalloweenContext'

/** Must wrap ALF so palette selection and decorations share the same state. */
export function HalloweenProvider({children}: React.PropsWithChildren<{}>) {
  const [preference, setPreference] = useState(
    () => persisted.get('halloween') ?? DEFAULT,
  )
  const [date, setDate] = useState(readDate)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      const next = readDate()
      setDate(previous =>
        previous.year === next.year && previous.isHalloween === next.isHalloween
          ? previous
          : next,
      )
      timer = setTimeout(refresh, getNextDateCheckDelay(new Date()))
    }
    refresh()
    const subscription = onAppStateChange(state => {
      if (state === 'active') refresh()
    })
    return () => {
      clearTimeout(timer)
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    return persisted.onUpdate('halloween', next => {
      setPreference(next ?? DEFAULT)
    })
  }, [])

  const update = (next: HalloweenPreference) => {
    setPreference(next)
    void persisted.write('halloween', next)
  }

  const setEnabled = (enabled: boolean) => {
    /* Read fresh storage so another web tab's invitation state is preserved. */
    const previous = persisted.readLatest('halloween') ?? DEFAULT
    update({
      ...previous,
      enabled,
      promptedYear: readDate().isHalloween
        ? readDate().year
        : previous.promptedYear,
    })
  }

  const dismissInvitation = () => {
    update({
      ...(persisted.readLatest('halloween') ?? DEFAULT),
      promptedYear: readDate().year,
    })
  }

  const dismissCostumeInvitation = () => {
    update({
      ...(persisted.readLatest('halloween') ?? DEFAULT),
      costumePromptedYear: readDate().year,
    })
  }

  return (
    <Context.Provider
      value={{
        ...resolveHalloween(preference, date),
        setEnabled,
        dismissInvitation,
        dismissCostumeInvitation,
      }}>
      <CostumesProvider>{children}</CostumesProvider>
    </Context.Provider>
  )
}

/** isActive gates the opt-in theme; isHalloween gates independent costume and candy UI. */
export function useHalloween() {
  return useContext(Context)
}
