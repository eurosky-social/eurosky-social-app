import {
  type Client,
  type Service,
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

type TransferItem = {
  key: string
  value: unknown
}

type TransferPage = {
  items: TransferItem[]
  cursor?: string
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
  writeConcurrency?: number
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
          value: profile.did,
        })),
      }
    },
    async write(target, item) {
      await callWithRetry(
        () =>
          target.client.call(
            app.bsky.graph.muteActor,
            {
              actor:
                item.value as app.bsky.graph.muteActor.$Input['body']['actor'],
            },
            {service: target.service, signal: target.signal},
          ),
        target.signal,
      )
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
    /* A bookmark is identified by URI; a differing historical CID is not a second bookmark. */
    valuesEqual: () => true,
    /* Bookmark writes are independent but numerous, so use a bounded pool. */
    writeConcurrency: 5,
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
      return {
        cursor: data.cursor,
        items: data.subscriptions.map(profile => {
          const subscription = profile.viewer?.activitySubscription
          if (!subscription) {
            throw new UnsupportedCollectionDataError()
          }
          return {
            key: profile.did,
            value: {
              post: subscription.post,
              reply: subscription.reply,
            } satisfies app.bsky.notification.defs.ActivitySubscription,
          }
        }),
      }
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

class UnsupportedCollectionDataError extends Error {}

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
  return {
    version: 1,
    accountDid,
    source,
    destination,
    selectedCollections,
    status: 'paused',
    startedAt: now,
    updatedAt: now,
    collections: Object.fromEntries(
      selectedCollections.map(id => [id, initialCollectionProgress()]),
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
        destinationScanned: false,
        destinationAfter: undefined,
        unsupportedAt: undefined,
        failureAt: undefined,
        failureStatus: undefined,
        failureName: undefined,
      })
      const sourceItems = await readAllItems({
        adapter,
        target: makeTarget(client, checkpoint.source, signal),
      })
      updateCollection(id, {
        sourceCount: sourceItems.size,
        sourceScanned: true,
      })

      endpoint = 'destination'
      updateCollection(id, {status: 'countingDestination'})
      const destinationItems = await readAllItems({
        adapter,
        target: makeTarget(client, checkpoint.destination, signal),
      })
      const progressAfterCount =
        checkpoint.collections[id] ?? initialCollectionProgress()
      const destinationBefore =
        progressAfterCount.destinationBefore ?? destinationItems.size
      updateCollection(id, {
        destinationBefore,
        destinationScanned: true,
        destinationAfter: destinationItems.size,
        status: 'transferring',
      })

      await writeMissingItems({
        adapter,
        items: [...sourceItems.values()],
        target: makeTarget(client, checkpoint.destination, signal),
        destinationItems,
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
            destinationAfter: destinationItems.size,
          })
        },
      })

      /* Successful idempotent writes update the in-memory destination set, so
       * another full pagination pass would only slow large collections down. */
      updateCollection(id, {
        status: 'complete',
        destinationAfter: destinationItems.size,
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
  onPrepared,
  onWritten,
}: {
  adapter: CollectionAdapter
  items: TransferItem[]
  target: RequestTarget
  destinationItems: Map<string, TransferItem>
  onPrepared: (pendingCount: number) => void
  onWritten: () => void
}): Promise<void> {
  const valuesEqual = adapter.valuesEqual ?? deepEqual
  const pending = items.flatMap(item => {
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
  onPrepared(pending.length)
  let nextIndex = 0
  let firstError: unknown
  let failed = false

  const worker = async () => {
    while (!failed) {
      const index = nextIndex++
      const item = pending[index]
      if (!item) return
      try {
        throwIfAborted(target.signal)
        await adapter.write(target, item)
        destinationItems.set(item.key, item)
        onWritten()
      } catch (error) {
        if (!failed) firstError = error
        failed = true
      }
    }
  }

  const concurrency = Math.min(
    adapter.writeConcurrency ?? 1,
    Math.max(1, pending.length),
  )
  await Promise.all(Array.from({length: concurrency}, worker))
  if (failed) throw firstError
}

async function readAllItems({
  adapter,
  target,
}: {
  adapter: CollectionAdapter
  target: RequestTarget
}): Promise<Map<string, TransferItem>> {
  const items = new Map<string, TransferItem>()
  const seenCursors = new Set<string>()
  let cursor: string | undefined

  while (true) {
    throwIfAborted(target.signal)
    const page = await adapter.readPage(target, cursor)
    for (const item of page.items) {
      items.set(item.key, item)
    }
    if (!page.cursor) return items
    if (seenCursors.has(page.cursor)) {
      throw new Error('AppView returned a repeated pagination cursor')
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
  if (error instanceof XrpcFetchError) return true
  return (
    error instanceof XrpcResponseError &&
    [408, 425, 429, 500, 502, 503, 504].includes(error.status)
  )
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
    error instanceof UnsupportedCollectionDataError ||
    (error instanceof XrpcResponseError &&
      (error.status === 404 ||
        error.status === 501 ||
        ['XRPCNotSupported', 'MethodNotFound', 'NotSupported'].includes(
          error.error,
        )))
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
