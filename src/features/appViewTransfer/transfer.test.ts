import {type Client, type Service, XrpcResponseError} from '@atproto/lex'

import {app} from '#/lexicons'
import {createTransferCheckpoint, runAppViewTransfer} from './transfer'

const SOURCE = {
  url: 'https://source.example',
  did: 'did:web:source.example',
}
const DESTINATION = {
  url: 'https://destination.example',
  did: 'did:web:destination.example',
}
const SOURCE_SERVICE = `${SOURCE.did}#bsky_appview`
const DESTINATION_SERVICE = `${DESTINATION.did}#bsky_appview`

type FakeCall = (
  method: {main: {nsid: string}},
  input: Record<string, unknown>,
  options: {service?: Service | null},
) => Promise<unknown>

test('transfers every supported collection with per-request service targets', async () => {
  const source = {
    mutes: new Set(['did:plc:alice', 'did:plc:bob']),
    lists: new Set(['at://did:plc:alice/app.bsky.graph.list/one']),
    bookmarks: new Map([
      ['at://did:plc:alice/app.bsky.feed.post/one', 'bafysourceone'],
    ]),
    subscriptions: new Map([['did:plc:carol', {post: true, reply: false}]]),
    preferences: {like: {include: 'all', list: true, push: true}},
  }
  const destination = {
    mutes: new Set(['did:plc:bob']),
    lists: new Set<string>(),
    bookmarks: new Map([
      ['at://did:plc:dave/app.bsky.feed.post/two', 'bafydestinationtwo'],
    ]),
    subscriptions: new Map([['did:plc:carol', {post: false, reply: true}]]),
    preferences: {like: {include: 'follows', list: false, push: false}},
  }

  const call = jest.fn<ReturnType<FakeCall>, Parameters<FakeCall>>(
    async (method, input, options) => {
      await Promise.resolve()
      const state =
        options.service === SOURCE_SERVICE
          ? source
          : options.service === DESTINATION_SERVICE
            ? destination
            : undefined
      if (!state) throw new Error(`Unexpected service: ${options.service}`)

      switch (method.main.nsid) {
        case 'app.bsky.graph.getMutes':
          return {
            mutes: [...state.mutes].map(did => ({did})),
          }
        case 'app.bsky.graph.muteActor':
          destination.mutes.add(input.actor as string)
          return undefined
        case 'app.bsky.graph.getListMutes':
          return {
            lists: [...state.lists].map(uri => ({uri})),
          }
        case 'app.bsky.graph.muteActorList':
          destination.lists.add(input.list as string)
          return undefined
        case 'app.bsky.bookmark.getBookmarks':
          return {
            bookmarks: [...state.bookmarks].map(([uri, cid]) => ({
              subject: {uri, cid},
            })),
          }
        case 'app.bsky.bookmark.createBookmark':
          destination.bookmarks.set(input.uri as string, input.cid as string)
          return undefined
        case 'app.bsky.notification.listActivitySubscriptions':
          return {
            subscriptions: [...state.subscriptions].map(
              ([did, activitySubscription]) => ({
                did,
                viewer: {activitySubscription},
              }),
            ),
          }
        case 'app.bsky.notification.putActivitySubscription':
          destination.subscriptions.set(
            input.subject as string,
            input.activitySubscription as {post: boolean; reply: boolean},
          )
          return {
            subject: input.subject,
            activitySubscription: input.activitySubscription,
          }
        case 'app.bsky.notification.getPreferences':
          return {preferences: state.preferences}
        case 'app.bsky.notification.putPreferencesV2':
          destination.preferences = input as typeof destination.preferences
          return {preferences: input}
        default:
          throw new Error(`Unexpected method: ${method.main.nsid}`)
      }
    },
  )
  const client = {call} as unknown as Client
  const initial = createTransferCheckpoint({
    accountDid: 'did:plc:account',
    source: SOURCE,
    destination: DESTINATION,
    selectedCollections: [
      'mutedAccounts',
      'mutedLists',
      'bookmarks',
      'activitySubscriptions',
      'notificationPreferences',
    ],
  })

  const result = await runAppViewTransfer({
    client,
    initialCheckpoint: initial,
    signal: new AbortController().signal,
    onProgress: () => {},
  })

  expect(result.status).toBe('complete')
  expect(result.collections.mutedAccounts).toMatchObject({
    status: 'complete',
    sourceCount: 2,
    transferredCount: 1,
    destinationBefore: 1,
    destinationAfter: 2,
  })
  expect(result.collections.mutedLists).toMatchObject({
    status: 'complete',
    sourceCount: 1,
    transferredCount: 1,
    destinationBefore: 0,
    destinationAfter: 1,
  })
  expect(result.collections.bookmarks).toMatchObject({
    status: 'complete',
    sourceCount: 1,
    transferredCount: 1,
    destinationBefore: 1,
    destinationAfter: 2,
  })
  expect(result.collections.activitySubscriptions).toMatchObject({
    status: 'complete',
    sourceCount: 1,
    transferredCount: 1,
    destinationBefore: 1,
    destinationAfter: 1,
  })
  expect(result.collections.notificationPreferences).toMatchObject({
    status: 'complete',
    sourceCount: 1,
    transferredCount: 1,
    destinationBefore: 1,
    destinationAfter: 1,
  })
  expect(destination.mutes).toEqual(new Set(['did:plc:alice', 'did:plc:bob']))
  expect(destination.preferences).toEqual(source.preferences)
  expect(destination.subscriptions.get('did:plc:carol')).toEqual({
    post: true,
    reply: true,
  })
  expect(call).toHaveBeenCalled()
  for (const invocation of call.mock.calls) {
    expect([SOURCE_SERVICE, DESTINATION_SERVICE]).toContain(
      invocation[2].service,
    )
  }
})

test('resumes an interrupted page without duplicating writes or counts', async () => {
  const sourceMutes = new Set(['did:plc:alice', 'did:plc:bob'])
  const destinationMutes = new Set(['did:plc:alice'])
  const call = jest.fn<ReturnType<FakeCall>, Parameters<FakeCall>>(
    async (method, input, options) => {
      await Promise.resolve()
      if (method.main.nsid === 'app.bsky.graph.getMutes') {
        const mutes =
          options.service === SOURCE_SERVICE ? sourceMutes : destinationMutes
        return {mutes: [...mutes].map(did => ({did}))}
      }
      if (method.main.nsid === 'app.bsky.graph.muteActor') {
        destinationMutes.add(input.actor as string)
        return undefined
      }
      throw new Error(`Unexpected method: ${method.main.nsid}`)
    },
  )
  const initial = createTransferCheckpoint({
    accountDid: 'did:plc:account',
    source: SOURCE,
    destination: DESTINATION,
    selectedCollections: ['mutedAccounts'],
  })
  initial.collections.mutedAccounts = {
    status: 'failed',
    sourceCount: 1,
    transferredCount: 1,
    destinationBefore: 0,
  }

  const result = await runAppViewTransfer({
    client: {call} as unknown as Client,
    initialCheckpoint: initial,
    signal: new AbortController().signal,
    onProgress: () => {},
  })

  expect(result.collections.mutedAccounts).toMatchObject({
    status: 'complete',
    sourceCount: 2,
    transferredCount: 2,
    destinationBefore: 0,
    destinationAfter: 2,
  })
  expect(destinationMutes).toEqual(new Set(['did:plc:alice', 'did:plc:bob']))
  expect(
    call.mock.calls.filter(
      invocation => invocation[0].main.nsid === 'app.bsky.graph.muteActor',
    ),
  ).toHaveLength(1)
})

test('keeps source and destination stats when destination writes fail', async () => {
  const call = jest.fn<ReturnType<FakeCall>, Parameters<FakeCall>>(
    async (method, _input, options) => {
      await Promise.resolve()
      if (method.main.nsid === 'app.bsky.bookmark.getBookmarks') {
        return options.service === SOURCE_SERVICE
          ? {
              bookmarks: ['one', 'two', 'three'].map(id => ({
                subject: {
                  uri: `at://did:plc:alice/app.bsky.feed.post/${id}`,
                  cid: `bafy${id}`,
                },
              })),
            }
          : {bookmarks: []}
      }
      throw new XrpcResponseError(
        app.bsky.bookmark.createBookmark.main,
        new Response(
          JSON.stringify({
            error: 'InvalidRequest',
            message: 'Bookmark storage is unavailable',
          }),
          {
            status: 400,
            headers: {'content-type': 'application/json'},
          },
        ),
        {
          encoding: 'application/json',
          body: {
            error: 'InvalidRequest',
            message: 'Bookmark storage is unavailable',
          },
        },
      )
    },
  )
  const initial = createTransferCheckpoint({
    accountDid: 'did:plc:account',
    source: SOURCE,
    destination: DESTINATION,
    selectedCollections: ['bookmarks'],
  })

  const result = await runAppViewTransfer({
    client: {call} as unknown as Client,
    initialCheckpoint: initial,
    signal: new AbortController().signal,
    onProgress: () => {},
  })

  expect(result.collections.bookmarks).toMatchObject({
    status: 'failed',
    sourceCount: 3,
    sourceScanned: true,
    destinationBefore: 0,
    destinationAfter: 0,
    destinationScanned: true,
    transferredCount: 0,
    failureAt: 'destination',
    failureStatus: 400,
    failureName: 'InvalidRequest',
  })
})

test('marks an unsupported destination collection without failing the run', async () => {
  const call = jest.fn<ReturnType<FakeCall>, Parameters<FakeCall>>(
    async (_method, _input, options) => {
      await Promise.resolve()
      if (options.service === SOURCE_SERVICE) return {bookmarks: []}
      throw new XrpcResponseError(
        app.bsky.bookmark.getBookmarks.main,
        new Response(
          JSON.stringify({
            error: 'XRPCNotSupported',
            message: 'Method is not supported',
          }),
          {
            status: 404,
            headers: {'content-type': 'application/json'},
          },
        ),
        {
          encoding: 'application/json',
          body: {
            error: 'XRPCNotSupported',
            message: 'Method is not supported',
          },
        },
      )
    },
  )
  const initial = createTransferCheckpoint({
    accountDid: 'did:plc:account',
    source: SOURCE,
    destination: DESTINATION,
    selectedCollections: ['bookmarks'],
  })

  const result = await runAppViewTransfer({
    client: {call} as unknown as Client,
    initialCheckpoint: initial,
    signal: new AbortController().signal,
    onProgress: () => {},
  })

  expect(result.status).toBe('complete')
  expect(result.collections.bookmarks).toMatchObject({
    status: 'unsupported',
    unsupportedAt: 'destination',
  })
  expect(call).toHaveBeenCalledTimes(2)
})
