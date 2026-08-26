import BroadcastChannel from '#/lib/broadcast'

const OWNER_STORAGE_KEY = 'EUROSKY_PET_REST_BREAK_OWNER'
const PROBE_TIMEOUT_MS = 300

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getOwnerId() {
  try {
    const existing = sessionStorage.getItem(OWNER_STORAGE_KEY)
    if (existing) return existing

    const created = createId()
    sessionStorage.setItem(OWNER_STORAGE_KEY, created)
    return created
  } catch {
    return createId()
  }
}

export const TIMER_OWNER_ID = getOwnerId()

const channel = new BroadcastChannel('EUROSKY_PET_REST_BREAK_TIMER')
const pendingProbes = new Map<string, (alive: boolean) => void>()
let isAlive = false

channel.onmessage = (event: MessageEvent) => {
  const data: unknown = event.data
  if (!data || typeof data !== 'object') return

  const message = data as Record<string, unknown>
  if (
    message.type === 'probe' &&
    message.ownerId === TIMER_OWNER_ID &&
    typeof message.probeId === 'string' &&
    isAlive
  ) {
    channel.postMessage({type: 'alive', probeId: message.probeId})
  } else if (message.type === 'alive' && typeof message.probeId === 'string') {
    pendingProbes.get(message.probeId)?.(true)
  }
}

export function setTimerOwnerAlive(next: boolean) {
  isAlive = next
}

export function isTimerOwnerAlive(ownerId: string): Promise<boolean> {
  if (ownerId === TIMER_OWNER_ID) return Promise.resolve(isAlive)

  return new Promise(resolve => {
    const probeId = createId()
    const finish = (alive: boolean) => {
      clearTimeout(timeout)
      pendingProbes.delete(probeId)
      resolve(alive)
    }
    const timeout = setTimeout(() => finish(false), PROBE_TIMEOUT_MS)

    pendingProbes.set(probeId, finish)
    channel.postMessage({type: 'probe', ownerId, probeId})
  })
}
