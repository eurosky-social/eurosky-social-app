import {
  type AtIdentifierString,
  type Client,
  type Service,
  XrpcError,
  XrpcFetchError,
  XrpcResponseError,
} from '@atproto/lex'

import {type AppViewPreference} from '#/features/appView/types'
import {app} from '#/lexicons'
import {
  APP_VIEW_TRANSFER_COLLECTIONS,
  type AppViewTransferCheckpoint,
  type AppViewTransferCollectionId,
  type AppViewTransferCollectionProgress,
} from './types'

const MAX_PAGES = 500
const PROFILE_BATCH_SIZE = 25

type TransferItem = {
  key: string
  value: unknown
}

type TransferPage = {
  items: TransferItem[]
  cursor?: string
  /** Keys the AppView listed but would not give a value for. */
  hiddenKeys?: string[]
}

type RequestTarget = {
  client: Client
  service: Service
  signal: AbortSignal
}

type CollectionAdapter = {
  id: AppViewTransferCollectionId
  readPage: (target: RequestTarget, cursor?: string) => Promise<TransferPage>
  write: (target: RequestTarget, item: TransferItem) => Promise<void>
  valuesEqual?: (left: unknown, right: unknown) => boolean
  mergeValues?: (source: unknown, destination: unknown) => unknown
  sortForWrite?: (items: TransferItem[]) => TransferItem[]
  /**
   * Stops after a retryable write failure when later writes must not overtake
   * the failed item.
   */
  stopOnRetryableFailure?: boolean
  /**
   * Finds destination items that the collection's list endpoint does not
   * expose, so the write pass can leave them unchanged.
   */
  findHiddenDestinationKeys?: (
    target: RequestTarget,
    keys: string[],
  ) => Promise<string[]>
}

type MuteFlavor = {
  onlyReposts: boolean
  onlyQuoteposts: boolean
}

const collectionAdapters: Record<
  AppViewTransferCollectionId,
  CollectionAdapter
> = {
  mutedAccounts: {
    id: 'mutedAccounts',
    async readPage(target, cursor) {
      const data = await callWithRetry(
        () =>
          target.client.call(
            app.bsky.graph.getMutes,
            {cursor, limit: 100},
            {service: target.service, signal: target.signal},
          ),
        target.signal,
      )
      return {
        cursor: data.cursor,
        items: data.mutes.map(profile => ({
          key: profile.did,
          value: {
            onlyReposts: Boolean(profile.viewer?.mutedOnlyReposts),
            onlyQuoteposts: Boolean(profile.viewer?.mutedOnlyQuoteposts),
          } satisfies MuteFlavor,
        })),
      }
    },
    async write(target, item) {
      const flavor = item.value as MuteFlavor
      await callWithRetry(
        () =>
          target.client.call(
            app.bsky.graph.muteActor,
            {
              actor: item.key as AtIdentifierString,
              ...(flavor.onlyReposts ? {onlyReposts: true} : {}),
              ...(flavor.onlyQuoteposts ? {onlyQuoteposts: true} : {}),
            },
            {service: target.service, signal: target.signal},
          ),
        target.signal,
      )
    },
    /** A mute present on both sides keeps its destination scope. */
    valuesEqual: () => true,
    async findHiddenDestinationKeys(target, keys) {
      const hidden: string[] = []
      for (let start = 0; start < keys.length; start += PROFILE_BATCH_SIZE) {
        const actors = keys.slice(
          start,
          start + PROFILE_BATCH_SIZE,
        ) as AtIdentifierString[]
        const data = await callWithRetry(
          () =>
            target.client.call(
              app.bsky.actor.getProfiles,
              {actors},
              {service: target.service, signal: target.signal},
            ),
          target.signal,
        )
        for (const profile of data.profiles) {
          if (
            profile.viewer?.mutedOnlyReposts ||
            profile.viewer?.mutedOnlyQuoteposts
          ) {
            hidden.push(profile.did)
          }
        }
      }
      return hidden
    },
  },
  mutedLists: {
    id: 'mutedLists',
    async readPage(target, cursor) {
      const data = await callWithRetry(
        () =>
          target.client.call(
            app.bsky.graph.getListMutes,
            {cursor, limit: 100},
            {service: target.service, signal: target.signal},
          ),
        target.signal,
      )
      return {
        cursor: data.cursor,
        items: data.lists.map(list => ({key: list.uri, value: list.uri})),
      }
    },
    async write(target, item) {
      await callWithRetry(
        () =>
          target.client.call(
            app.bsky.graph.muteActorList,
            {
              list: item.value as app.bsky.graph.muteActorList.$Input['body']['list'],
            },
            {service: target.service, signal: target.signal},
          ),
        target.signal,
      )
    },
  },
  bookmarks: {
    id: 'bookmarks',
    async readPage(target, cursor) {
      const data = await callWithRetry(
        () =>
          target.client.call(
            app.bsky.bookmark.getBookmarks,
            {cursor, limit: 100},
            {service: target.service, signal: target.signal},
          ),
        target.signal,
      )
      return {
        cursor: data.cursor,
        items: data.bookmarks.map(bookmark => ({
          key: bookmark.subject.uri,
          value: bookmark.subject,
        })),
      }
    },
    async write(target, item) {
      const subject = item.value as app.bsky.bookmark.defs.Bookmark['subject']
      await callWithRetry(
        () =>
          target.client.call(
            app.bsky.bookmark.createBookmark,
            {uri: subject.uri, cid: subject.cid},
            {service: target.service, signal: target.signal},
          ),
        target.signal,
      )
    },
    /** A bookmark is identified by URI; a historical CID is not a new item. */
    valuesEqual: () => true,
    /**
     * AppViews stamp bookmarks when they accept a write and list newest first.
     * Writing the source's newest-first list in reverse preserves its order.
     */
    sortForWrite: items => [...items].reverse(),
    /** A resume must write a transiently failed bookmark before newer ones. */
    stopOnRetryableFailure: true,
  },
  activitySubscriptions: {
    id: 'activitySubscriptions',
    async readPage(target, cursor) {
      const data = await callWithRetry(
        () =>
          target.client.call(
            app.bsky.notification.listActivitySubscriptions,
            {cursor, limit: 100},
            {service: target.service, signal: target.signal},
          ),
        target.signal,
      )
      const items: TransferItem[] = []
      const hiddenKeys: string[] = []
      for (const profile of data.subscriptions) {
        const subscription = profile.viewer?.activitySubscription
        if (!subscription) {
          hiddenKeys.push(profile.did)
          continue
        }
        items.push({
          key: profile.did,
          value: {
            post: subscription.post,
            reply: subscription.reply,
          } satisfies app.bsky.notification.defs.ActivitySubscription,
        })
      }
      return {cursor: data.cursor, items, hiddenKeys}
    },
    async write(target, item) {
      await callWithRetry(
        () =>
          target.client.call(
            app.bsky.notification.putActivitySubscription,
            {
              subject:
                item.key as app.bsky.notification.putActivitySubscription.$Input['body']['subject'],
              activitySubscription:
                item.value as app.bsky.notification.defs.ActivitySubscription,
            },
            {service: target.service, signal: target.signal},
          ),
        target.signal,
      )
    },
    valuesEqual: deepEqual,
    mergeValues(source, destination) {
      const sourceSubscription =
        source as app.bsky.notification.defs.ActivitySubscription
      const destinationSubscription =
        destination as app.bsky.notification.defs.ActivitySubscription
      return {
        post: sourceSubscription.post || destinationSubscription.post,
        reply: sourceSubscription.reply || destinationSubscription.reply,
      } satisfies app.bsky.notification.defs.ActivitySubscription
    },
  },
  notificationPreferences: {
    id: 'notificationPreferences',
    async readPage(target) {
      const data = await callWithRetry(
        () =>
          target.client.call(
            app.bsky.notification.getPreferences,
            {},
            {service: target.service, signal: target.signal},
          ),
        target.signal,
      )
      const {chat: _chat, $type: _type, ...preferences} = data.preferences
      return {
        items: [{key: 'preferences', value: preferences}],
      }
    },
    async write(target, item) {
      await callWithRetry(
        () =>
          target.client.call(
            app.bsky.notification.putPreferencesV2,
            item.value as app.bsky.notification.putPreferencesV2.$Input['body'],
            {service: target.service, signal: target.signal},
          ),
        target.signal,
      )
    },
    valuesEqual: deepEqual,
  },
}

export function createTransferCheckpoint({
  accountDid,
  source,
  destination,
  selectedCollections,
}: {
  accountDid: string
  source: AppViewPreference
  destination: AppViewPreference
  selectedCollections: AppViewTransferCollectionId[]
}): AppViewTransferCheckpoint {
  const now = new Date().toISOString()
  const ordered = APP_VIEW_TRANSFER_COLLECTIONS.filter(id =>
    selectedCollections.includes(id),
  )
  return {
    version: 1,
    accountDid,
    source,
    destination,
    selectedCollections: ordered,
    status: 'paused',
    startedAt: now,
    updatedAt: now,
    collections: Object.fromEntries(
      ordered.map(id => [id, initialCollectionProgress()]),
    ),
  }
}

export async function runAppViewTransfer({
  client,
  initialCheckpoint,
  signal,
  onProgress,
  onCollectionError,
}: {
  client: Client
  initialCheckpoint: AppViewTransferCheckpoint
  signal: AbortSignal
  onProgress: (checkpoint: AppViewTransferCheckpoint) => void
  onCollectionError?: (id: AppViewTransferCollectionId, error: unknown) => void
}): Promise<AppViewTransferCheckpoint> {
  let checkpoint = initialCheckpoint

  const emit = (
    patch: Partial<AppViewTransferCheckpoint>,
  ): AppViewTransferCheckpoint => {
    checkpoint = {
      ...checkpoint,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    onProgress(checkpoint)
    return checkpoint
  }

  const updateCollection = (
    id: AppViewTransferCollectionId,
    patch: Partial<AppViewTransferCollectionProgress>,
  ) => {
    const previous = checkpoint.collections[id] ?? initialCollectionProgress()
    emit({
      collections: {
        ...checkpoint.collections,
        [id]: {...previous, ...patch},
      },
    })
  }

  emit({status: 'running'})

  for (const id of APP_VIEW_TRANSFER_COLLECTIONS) {
    if (!checkpoint.selectedCollections.includes(id)) continue
    const existing = checkpoint.collections[id] ?? initialCollectionProgress()
    if (existing.status === 'complete' || existing.status === 'unsupported') {
      continue
    }

    const adapter = collectionAdapters[id]
    let endpoint: 'source' | 'destination' = 'destination'

    try {
      throwIfAborted(signal)
      endpoint = 'source'
      updateCollection(id, {
        status: 'countingSource',
        sourceScanned: false,
        processedCount: 0,
        failedCount: undefined,
        destinationScanned: false,
        destinationAfter: undefined,
        unsupportedAt: undefined,
        failureAt: undefined,
        failureStatus: undefined,
        failureName: undefined,
      })
      const sourceRead = await readAllItems({
        adapter,
        target: makeTarget(client, checkpoint.source, signal),
      })
      const sourceItems = sourceRead.items
      updateCollection(id, {
        sourceCount: sourceItems.size + sourceRead.hiddenKeys.size,
        sourceScanned: true,
      })

      endpoint = 'destination'
      updateCollection(id, {status: 'countingDestination'})
      const destinationRead = await readAllItems({
        adapter,
        target: makeTarget(client, checkpoint.destination, signal),
      })
      const destinationItems = destinationRead.items
      const listedHiddenCount = destinationRead.hiddenKeys.size
      const destinationCount = () => destinationItems.size + listedHiddenCount
      const progressAfterCount =
        checkpoint.collections[id] ?? initialCollectionProgress()
      const destinationBefore =
        progressAfterCount.destinationBefore ?? destinationCount()
      updateCollection(id, {
        destinationBefore,
        destinationScanned: true,
        destinationAfter: destinationCount(),
        status: 'transferring',
      })

      const hiddenKeys = new Set(destinationRead.hiddenKeys)
      if (adapter.findHiddenDestinationKeys) {
        const candidates = [...sourceItems.keys()].filter(
          key => !destinationItems.has(key),
        )
        if (candidates.length > 0) {
          const hidden = await adapter.findHiddenDestinationKeys(
            makeTarget(client, checkpoint.destination, signal),
            candidates,
          )
          for (const key of hidden) hiddenKeys.add(key)
        }
      }

      const {failedCount, firstError} = await writeMissingItems({
        adapter,
        items: [...sourceItems.values()],
        target: makeTarget(client, checkpoint.destination, signal),
        destinationItems,
        hiddenKeys,
        onPrepared(pendingCount) {
          updateCollection(id, {
            processedCount: sourceItems.size - pendingCount,
          })
        },
        onWritten() {
          const progress =
            checkpoint.collections[id] ?? initialCollectionProgress()
          updateCollection(id, {
            processedCount: (progress.processedCount ?? 0) + 1,
            transferredCount: progress.transferredCount + 1,
            destinationAfter: destinationCount(),
          })
        },
      })

      const missedCount = failedCount + sourceRead.hiddenKeys.size
      if (missedCount > 0) {
        if (firstError) onCollectionError?.(id, firstError)
        updateCollection(id, {
          status: 'failed',
          failedCount: missedCount,
          failureAt: failedCount > 0 ? 'destination' : 'source',
          destinationAfter: destinationCount(),
          ...(firstError ? safeFailureDetails(firstError) : {}),
        })
        continue
      }

      /**
       * Successful idempotent writes update the in-memory destination set, so
       * another full pagination pass would only slow large collections down.
       */
      updateCollection(id, {
        status: 'complete',
        destinationAfter: destinationCount(),
      })
    } catch (error) {
      if (signal.aborted) throw error
      if (isUnsupportedCollectionError(error)) {
        updateCollection(id, {
          status: 'unsupported',
          unsupportedAt: endpoint,
          failureAt: undefined,
          failureStatus: undefined,
          failureName: undefined,
        })
      } else {
        onCollectionError?.(id, error)
        updateCollection(id, {
          status: 'failed',
          failureAt: endpoint,
          ...safeFailureDetails(error),
        })
      }
    }
  }

  return emit({status: 'complete'})
}

function initialCollectionProgress(): AppViewTransferCollectionProgress {
  return {
    status: 'pending',
    sourceCount: 0,
    processedCount: 0,
    transferredCount: 0,
  }
}

function makeTarget(
  client: Client,
  preference: AppViewPreference,
  signal: AbortSignal,
): RequestTarget {
  return {
    client,
    service: `${preference.did}#bsky_appview` as Service,
    signal,
  }
}

async function writeMissingItems({
  adapter,
  items,
  target,
  destinationItems,
  hiddenKeys,
  onPrepared,
  onWritten,
}: {
  adapter: CollectionAdapter
  items: TransferItem[]
  target: RequestTarget
  destinationItems: Map<string, TransferItem>
  hiddenKeys: Set<string>
  onPrepared: (pendingCount: number) => void
  onWritten: () => void
}): Promise<{failedCount: number; firstError?: unknown}> {
  const valuesEqual = adapter.valuesEqual ?? deepEqual
  const missing = items.flatMap(item => {
    if (hiddenKeys.has(item.key)) return []
    const destinationItem = destinationItems.get(item.key)
    const desiredItem =
      destinationItem && adapter.mergeValues
        ? {
            ...item,
            value: adapter.mergeValues(item.value, destinationItem.value),
          }
        : item
    return !destinationItem ||
      !valuesEqual(destinationItem.value, desiredItem.value)
      ? [desiredItem]
      : []
  })
  const pending = adapter.sortForWrite?.(missing) ?? missing
  onPrepared(pending.length)
  let firstError: unknown
  let writtenCount = 0

  for (const item of pending) {
    throwIfAborted(target.signal)
    try {
      await adapter.write(target, item)
      destinationItems.set(item.key, item)
      writtenCount++
      onWritten()
    } catch (error) {
      if (target.signal.aborted || isUnsupportedCollectionError(error)) {
        throw error
      }
      firstError ??= error
      if (adapter.stopOnRetryableFailure && isRetryableError(error)) break
    }
  }

  return {failedCount: pending.length - writtenCount, firstError}
}

async function readAllItems({
  adapter,
  target,
}: {
  adapter: CollectionAdapter
  target: RequestTarget
}): Promise<{items: Map<string, TransferItem>; hiddenKeys: Set<string>}> {
  const items = new Map<string, TransferItem>()
  const hiddenKeys = new Set<string>()
  const seenCursors = new Set<string>()
  let cursor: string | undefined

  while (true) {
    throwIfAborted(target.signal)
    const page = await adapter.readPage(target, cursor)
    for (const item of page.items) {
      items.set(item.key, item)
      hiddenKeys.delete(item.key)
    }
    for (const key of page.hiddenKeys ?? []) {
      if (!items.has(key)) hiddenKeys.add(key)
    }
    if (!page.cursor) return {items, hiddenKeys}
    if (seenCursors.has(page.cursor)) {
      throw new Error('AppView returned a repeated pagination cursor')
    }
    if (seenCursors.size >= MAX_PAGES) {
      throw new Error('AppView exceeded the pagination page limit')
    }
    seenCursors.add(page.cursor)
    cursor = page.cursor
  }
}

async function callWithRetry<T>(
  call: () => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    throwIfAborted(signal)
    try {
      return await call()
    } catch (error) {
      if (
        signal.aborted ||
        attempt >= maxRetries(error) ||
        !isRetryableError(error)
      ) {
        throw error
      }
      await sleep(retryDelay(error, attempt), signal)
    }
  }
}

function maxRetries(error: unknown): number {
  return error instanceof XrpcResponseError && error.status === 429 ? 4 : 2
}

function isRetryableError(error: unknown): boolean {
  return error instanceof XrpcError && error.shouldRetry()
}

function retryDelay(error: unknown, attempt: number): number {
  if (error instanceof XrpcResponseError) {
    const retryAfter = error.response.headers.get('retry-after')
    if (retryAfter) {
      const seconds = Number(retryAfter)
      if (Number.isFinite(seconds)) {
        return Math.min(60_000, Math.max(0, seconds * 1000))
      }
      const dateDelay = new Date(retryAfter).getTime() - Date.now()
      if (Number.isFinite(dateDelay)) {
        return Math.min(60_000, Math.max(0, dateDelay))
      }
    }
  }
  return 500 * 2 ** attempt + Math.floor(Math.random() * 250)
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout)
      signal.removeEventListener('abort', onAbort)
      reject(new Error('Transfer paused'))
    }
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal.addEventListener('abort', onAbort, {once: true})
    if (signal.aborted) onAbort()
  })
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw new Error('Transfer paused')
}

function isUnsupportedCollectionError(error: unknown): boolean {
  return (
    error instanceof XrpcResponseError &&
    (error.status === 404 ||
      error.status === 501 ||
      ['XRPCNotSupported', 'MethodNotFound', 'NotSupported'].includes(
        error.error,
      ))
  )
}

function safeFailureDetails(error: unknown): {
  failureStatus?: number
  failureName: string
} {
  if (error instanceof XrpcResponseError) {
    return {failureStatus: error.status, failureName: error.error}
  }
  if (error instanceof XrpcFetchError) {
    return {failureName: 'NetworkError'}
  }
  return {failureName: 'UnexpectedError'}
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (
    !left ||
    !right ||
    typeof left !== 'object' ||
    typeof right !== 'object'
  ) {
    return false
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false
    return (
      left.length === right.length &&
      left.every((value, index) => deepEqual(value, right[index]))
    )
  }
  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord).sort()
  const rightKeys = Object.keys(rightRecord).sort()
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        deepEqual(leftRecord[key], rightRecord[key]),
    )
  )
}
