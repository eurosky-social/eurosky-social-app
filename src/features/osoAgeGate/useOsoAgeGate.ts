import {useAgeAssurance} from '#/ageAssurance'

/**
 * Oso is 18+ only. Show the gate when the shared age assurance logic denies
 * access (undeclared, or a region that blocks), or when the age service (which
 * other mu apps can also write to) has the user as under 18.
 */
export function useOsoAgeGate() {
  const aa = useAgeAssurance()
  return (
    aa.state.access === aa.Access.None ||
    (aa.flags.hasDeclaredAge && aa.flags.isDeclaredUnderAdultAge)
  )
}
