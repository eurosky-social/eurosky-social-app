import {useSession} from '#/state/session'
import {useAgeAssurance} from '#/ageAssurance'
import {Storage, useStorage} from '#/storage'

/**
 * Oso-owned local store, kept separate from the shared `account` storage so
 * this feature doesn't touch `#/storage/schema`. Scoped by account DID.
 */
const store = new Storage<[string], {declaredUnder18: boolean}>({
  id: 'oso_age_gate',
})

/**
 * Whether the current account declared itself under 18 on this device. This is
 * intentionally never sent to any service: under-18 users are blocked anyway,
 * and with self-declaration they could always just pick "18 or older" instead.
 */
export function useDeclaredUnder18() {
  const {currentAccount} = useSession()
  const [declaredUnder18 = false, setDeclaredUnder18] = useStorage(store, [
    currentAccount?.did ?? '',
    'declaredUnder18',
  ])
  return [!!currentAccount && declaredUnder18, setDeclaredUnder18] as const
}

/**
 * Whether the declared age (local or from the age service, which other mu apps
 * can also write to) is under 18.
 */
export function useIsDeclaredUnder18() {
  const aa = useAgeAssurance()
  const [declaredUnder18] = useDeclaredUnder18()
  return (
    declaredUnder18 ||
    (aa.flags.hasDeclaredAge && aa.flags.isDeclaredUnderAdultAge)
  )
}

/**
 * Oso is 18+ only. Show the gate when the shared age assurance logic denies
 * access (undeclared, or a region that blocks), or when the user declared
 * themselves under 18.
 */
export function useOsoAgeGate() {
  const ageAssurance = useAgeAssurance()
  const isDeclaredUnder18 = useIsDeclaredUnder18()
  return (
    ageAssurance.state.access === ageAssurance.Access.None || isDeclaredUnder18
  )
}
