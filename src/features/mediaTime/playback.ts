/*
 * In-memory register of video positions and of players that can jump, keyed
 * by the URI of the post the video belongs to. Players report where they are;
 * the composer reads that to link a reply to the second being watched, and
 * time pills ask a visible player to jump instead of opening a new screen.
 */

/** How long a reported position stays usable for a new reply. */
export const POSITION_MAX_AGE_MS = 10 * 60 * 1000

/** A queued jump is dropped if no player picks it up within this time. */
export const QUEUED_SEEK_MAX_AGE_MS = 30 * 1000

/** Positions below this are treated as "not really watched yet". */
const MIN_COMMENTABLE_SECONDS = 1

/** Keep the register small; old entries are dropped first. */
const MAX_POSITIONS = 200

type Position = {seconds: number; duration?: number; updatedAt: number}

export type SeekTarget = {
  /** Jumps to `seconds` and starts playing. */
  seek: (seconds: number) => void
  /**
   * Whether the player is on the screen the user is looking at. Players on
   * screens further back in the navigation stack must not take the jump.
   */
  isActive: () => boolean
}

const positions = new Map<string, Position>()
const targets = new Map<string, SeekTarget[]>()
const queuedSeeks = new Map<string, {seconds: number; queuedAt: number}>()
const positionListeners = new Set<() => void>()

/** Records where the video of `postUri` currently is. */
export function reportPlaybackPosition(
  postUri: string,
  seconds: number,
  duration?: number,
  now = Date.now(),
): void {
  if (!Number.isFinite(seconds) || seconds < 0) return
  const previousSecond = getPlaybackSecond(postUri)
  positions.delete(postUri)
  positions.set(postUri, {
    seconds,
    duration:
      duration !== undefined && Number.isFinite(duration) && duration > 0
        ? duration
        : undefined,
    updatedAt: now,
  })
  if (positions.size > MAX_POSITIONS) {
    const oldest = positions.keys().next().value
    if (oldest !== undefined) positions.delete(oldest)
  }
  if (Math.floor(seconds) !== previousSecond) {
    for (const listener of positionListeners) listener()
  }
}

/** The whole second the video of `postUri` was last reported at. */
export function getPlaybackSecond(postUri: string): number | undefined {
  const position = positions.get(postUri)
  return position ? Math.floor(position.seconds) : undefined
}

/** The length of the video of `postUri` in seconds, once a player knows it. */
export function getPlaybackDuration(postUri: string): number | undefined {
  return positions.get(postUri)?.duration
}

/**
 * Calls `listener` whenever a video reaches another whole second. Returns
 * the function that stops it.
 */
export function subscribePlaybackPositions(listener: () => void): () => void {
  positionListeners.add(listener)
  return () => {
    positionListeners.delete(listener)
  }
}

/**
 * The second a new reply to `postUri` should be linked to, or `undefined` if
 * the video was not watched recently, barely started, or watched to the end
 * (a reply then is about the whole video, not a moment).
 */
export function getCommentableMediaTime(
  postUri: string,
  now = Date.now(),
): number | undefined {
  const position = positions.get(postUri)
  if (!position) return undefined
  if (now - position.updatedAt > POSITION_MAX_AGE_MS) return undefined
  if (position.seconds < MIN_COMMENTABLE_SECONDS) return undefined
  if (
    position.duration !== undefined &&
    position.seconds >= position.duration - 1
  ) {
    return undefined
  }
  return Math.floor(position.seconds)
}

/**
 * Registers a player that can jump. Picks up a queued jump for the same post
 * right away. Returns the function that unregisters it.
 */
export function registerSeekTarget(
  postUri: string,
  target: SeekTarget,
  now = Date.now(),
): () => void {
  const list = targets.get(postUri) ?? []
  list.push(target)
  targets.set(postUri, list)

  const queued = queuedSeeks.get(postUri)
  if (queued) {
    queuedSeeks.delete(postUri)
    if (now - queued.queuedAt <= QUEUED_SEEK_MAX_AGE_MS) {
      target.seek(queued.seconds)
    }
  }

  return () => {
    const current = targets.get(postUri)
    if (!current) return
    const next = current.filter(t => t !== target)
    if (next.length) {
      targets.set(postUri, next)
    } else {
      targets.delete(postUri)
    }
  }
}

/**
 * Asks the most recently registered active player of `postUri` to jump.
 * Returns `false` when no such player exists, so the caller can open one.
 */
export function seekIfVisible(postUri: string, seconds: number): boolean {
  const list = targets.get(postUri)
  if (!list) return false
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].isActive()) {
      list[i].seek(seconds)
      return true
    }
  }
  return false
}

/**
 * Remembers a jump for the next player of `postUri` that registers, e.g. when
 * a thread opens from a link with a `t` parameter, or when a player first has
 * to scroll into view before it mounts its video.
 */
export function queueSeek(
  postUri: string,
  seconds: number,
  now = Date.now(),
): void {
  queuedSeeks.set(postUri, {seconds, queuedAt: now})
}

/** Test helper: forget everything. */
export function resetPlaybackRegister(): void {
  positions.clear()
  targets.clear()
  queuedSeeks.clear()
}
