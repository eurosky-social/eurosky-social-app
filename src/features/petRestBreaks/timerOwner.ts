export const TIMER_OWNER_ID = 'native'

let isAlive = false

export function setTimerOwnerAlive(next: boolean) {
  isAlive = next
}

export function isTimerOwnerAlive(ownerId: string) {
  return Promise.resolve(ownerId === TIMER_OWNER_ID && isAlive)
}
