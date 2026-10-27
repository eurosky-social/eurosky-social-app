import {type PropsWithChildren} from 'react'
import {type Un$Typed} from '@atproto/lex'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {act, renderHook, waitFor} from '@testing-library/react-native'

import {app} from '#/lexicons'
import {mergeLegacyWebsite} from './legacy'
import {useLegacyWebsiteCheck} from './legacyState'
import {prepareProfileSave} from './profileSave'
import {checkSafelink} from './safelink'
import {
  useOwnProfileLinksQuery,
  usePrepareProfileLinksSave,
  useSaveProfileLinksMutation,
} from './state'
import {type OwnProfileLinks} from './types'

type ProfileRecord = Un$Typed<app.bsky.actor.profile.Main>
const mockPds = {
  get: jest.fn<Promise<unknown>, [unknown, unknown?]>(),
  put: jest.fn<
    Promise<{uri: string; cid: string}>,
    [unknown, unknown, {repo: string; rkey: string; swapRecord?: string}]
  >(),
  delete: jest.fn<Promise<void>, [unknown, {repo: string; rkey: string}]>(),
}
const mockUpdateProfile = jest.fn<
  Promise<void>,
  [{updates: (record: ProfileRecord) => ProfileRecord}]
>()
let mockRestricted = false

jest.mock('#/lib/api', () => ({uploadBlob: jest.fn()}))
jest.mock('#/lib/media/util', () => ({blobToDataUri: jest.fn()}))
jest.mock('#/lib/xrpc-error', () => ({
  isRecordNotFoundError: () => false,
  matchXrpcError: () => undefined,
}))
jest.mock('#/logger', () => ({logger: {error: jest.fn()}}))
jest.mock('#/state/preferences/moderation-opts', () => ({
  useModerationOpts: () => undefined,
}))
jest.mock('#/state/queries', () => ({STALE: {MINUTES: {ONE: 60000}}}))
jest.mock('#/state/queries/profile', () => ({
  useProfileUpdateMutation: () => ({
    mutateAsync: mockUpdateProfile,
    isPending: false,
  }),
}))
jest.mock('#/state/queries/util', () => ({
  createQueryKey: (root: string, args: unknown) => [root, args],
}))
jest.mock('#/state/session', () => ({usePdsClient: () => mockPds}))
jest.mock('#/ageAssurance', () => ({
  useAgeAssurance: () => ({flags: {isAgeRestricted: mockRestricted}}),
}))
jest.mock('./safelink', () => ({checkSafelink: jest.fn()}))

const did = 'did:plc:alice' as const
const website = 'https://portfolio.example/' as const
const profile = {
  did,
  handle: 'alice.example',
} as app.bsky.actor.defs.ProfileViewDetailed
const nativeUri = `at://${did}/app.bsky.actor.link/3laaaaaaaaaaa` as const

function snapshot(): OwnProfileLinks {
  return {
    links: mergeLegacyWebsite([], website, [], true),
    refs: [],
    website,
    urls: [],
  }
}

function setup<T>(hook: () => T) {
  const queryClient = new QueryClient({
    defaultOptions: {queries: {retry: false, gcTime: Infinity}},
  })
  const wrapper = ({children}: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return {...renderHook(hook, {wrapper}), queryClient}
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRestricted = false
  jest.mocked(checkSafelink).mockResolvedValue('none')
  const records = new Map<string, {uri: string; cid: string; value: unknown}>()
  mockPds.get.mockImplementation((schema, options) => {
    if (schema === app.bsky.actor.link) {
      const key = (options as {rkey: string}).rkey
      return Promise.resolve(records.get(key))
    }
    return Promise.resolve({value: {website}})
  })
  mockPds.put.mockImplementation((_schema, record, options) => {
    const saved = {
      uri: `at://${did}/app.bsky.actor.link/${options.rkey}`,
      cid: 'new-cid',
      value: record,
    }
    records.set(options.rkey, saved)
    return Promise.resolve(saved)
  })
  mockPds.delete.mockResolvedValue(undefined)
  mockUpdateProfile.mockResolvedValue(undefined)
})

describe('repo snapshot', () => {
  it('retains explicit-save display order through an unchanged repo refetch only', async () => {
    const {result, queryClient} = setup(() => useOwnProfileLinksQuery(did))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    await act(async () => {
      queryClient.setQueryData(['ownProfileLinks', {did}], {
        ...result.current.data,
        locallySaved: true,
      })
      await result.current.refetch()
    })
    await waitFor(() => expect(result.current.data?.locallySaved).toBe(true))
    mockPds.get.mockResolvedValue({
      value: {website: 'https://changed.example/'},
    })
    await act(async () => {
      await result.current.refetch()
    })
    await waitFor(() => {
      expect(result.current.data?.website).toBe('https://changed.example/')
      expect(result.current.data?.locallySaved).toBeUndefined()
    })
  })

  it('reads the authoritative website, retains hidden refs, and merges the editor links', async () => {
    const hidden = {uri: nativeUri, cid: 'hidden-cid'}
    mockPds.get.mockImplementation(schema =>
      Promise.resolve(
        schema === app.bsky.actor.profile
          ? {value: {website, links: [hidden]}}
          : {
              uri: nativeUri,
              cid: 'hidden-cid',
              value: {
                url: 'http://hidden.example/',
                createdAt: '2026-10-01T00:00:00.000Z',
              },
            },
      ),
    )
    const {result} = setup(() => useOwnProfileLinksQuery(did))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({
      ...snapshot(),
      refs: [hidden],
      urls: ['http://hidden.example/'],
    })
    expect(mockPds.put).not.toHaveBeenCalled()
  })
})

describe('legacy link safety feedback', () => {
  it('shares a blocked result between the editor warning and migration', async () => {
    jest.mocked(checkSafelink).mockResolvedValue('block')
    const baseline = snapshot()
    const {result} = setup(() => ({
      check: useLegacyWebsiteCheck(website),
      prepare: usePrepareProfileLinksSave(),
    }))
    await waitFor(() => expect(result.current.check.data).toBe('block'))
    const prepared = await result.current.prepare(did, baseline.links, baseline)
    expect(prepared.updates({website}).website).toBe(website)
    expect(checkSafelink).toHaveBeenCalledTimes(1)
    expect(mockPds.put).not.toHaveBeenCalled()
  })

  it('does not request a safety check without a legacy destination', () => {
    setup(() => useLegacyWebsiteCheck(undefined))
    expect(checkSafelink).not.toHaveBeenCalled()
  })
})

describe('prepared migration (Edit Profile save path)', () => {
  it('creates a real link and clears the website in the same profile update', async () => {
    const baseline = snapshot()
    const {result, queryClient} = setup(() => usePrepareProfileLinksSave())
    const prepared = await result.current(did, baseline.links, baseline)
    const record = prepared.updates({website, description: 'Keep my bio'})
    expect(record.website).toBeUndefined()
    expect(record.description).toBe('Keep my bio')
    expect(record.links).toHaveLength(1)
    expect(mockPds.put).toHaveBeenCalledWith(
      app.bsky.actor.link,
      expect.objectContaining({url: website}),
      expect.objectContaining({
        rkey: expect.stringMatching(/^[234567a-z]{13}$/),
      }),
    )
    expect(queryClient.getQueryData(['ownProfileLinks', {did}])).toBeUndefined()
    await act(async () => prepared.onSuccess())
    const cached = queryClient.getQueryData<OwnProfileLinks>([
      'ownProfileLinks',
      {did},
    ])!
    expect(cached.website).toBeUndefined()
    expect(cached.links[0].uri).toBe(record.links![0].uri)
    expect(cached.links[0].legacyWebsite).toBeUndefined()
  })

  it('leaves the old value and cache intact when record creation fails', async () => {
    const baseline = snapshot()
    mockPds.put.mockRejectedValueOnce(new Error('Offline'))
    const {result, queryClient} = setup(() => usePrepareProfileLinksSave())
    await expect(result.current(did, baseline.links, baseline)).rejects.toThrow(
      'Offline',
    )
    expect(baseline.website).toBe(website)
    expect(queryClient.getQueryData(['ownProfileLinks', {did}])).toBeUndefined()
    expect(mockUpdateProfile).not.toHaveBeenCalled()
  })

  it('reuses a valid TID when a profile write failed and migration is retried', async () => {
    const baseline = snapshot()
    const {result} = setup(() => usePrepareProfileLinksSave())
    const first = await result.current(did, baseline.links, baseline)
    const retry = await result.current(did, baseline.links, baseline)
    expect(first.updates({website}).links).toEqual(
      retry.updates({website}).links,
    )
    expect(mockPds.put).toHaveBeenCalledTimes(1)
  })

  it('checks concurrency before creating records and again before the profile write', async () => {
    const baseline = snapshot()
    const {result} = setup(() => usePrepareProfileLinksSave())
    mockPds.get.mockResolvedValueOnce({
      value: {website: 'https://changed.example/'},
    })
    await expect(result.current(did, baseline.links, baseline)).rejects.toThrow(
      'Profile links changed',
    )
    expect(mockPds.put).not.toHaveBeenCalled()
    const prepared = await result.current(did, baseline.links, baseline)
    expect(() =>
      prepared.updates({website: 'https://changed.example/'}),
    ).toThrow('Profile links changed')
  })

  it('saves ordinary fields when the repo changes after migration preparation', async () => {
    const baseline = snapshot()
    const {result, queryClient} = setup(() => usePrepareProfileLinksSave())
    const prepared = await result.current(did, baseline.links, baseline)
    const save = prepareProfileSave({
      fields: {displayName: '', description: 'New bio', pronouns: ''},
      links: prepared,
      linksDirty: false,
    })
    const latest: ProfileRecord = {
      website: 'https://concurrent.example/',
      links: [{uri: nativeUri, cid: 'concurrent-cid'}],
    }
    if (typeof save.updates !== 'function')
      throw new Error('Expected prepared update')
    expect(save.updates(latest)).toEqual({
      ...latest,
      displayName: undefined,
      description: 'New bio',
      pronouns: undefined,
    })
    await act(async () => save.onSuccess())
    expect(queryClient.getQueryData(['ownProfileLinks', {did}])).toBeUndefined()
    expect(mockPds.delete).not.toHaveBeenCalled()
  })

  it('allocates a fresh draft key after a successful save in the same hook session', async () => {
    const baseline = snapshot()
    const {result, queryClient} = setup(() => usePrepareProfileLinksSave())
    const first = await result.current(did, baseline.links, baseline)
    const firstRecord = first.updates({website})
    await act(async () => first.onSuccess())
    const saved = queryClient.getQueryData<OwnProfileLinks>([
      'ownProfileLinks',
      {did},
    ])!
    mockPds.get.mockResolvedValue({value: firstRecord})
    const second = await result.current(did, [{url: website}], saved)
    const secondRecord = second.updates(firstRecord)
    expect(secondRecord.links![0].uri).not.toBe(firstRecord.links![0].uri)
    await act(async () => second.onSuccess())
    expect(mockPds.delete).toHaveBeenCalledWith(app.bsky.actor.link, {
      repo: did,
      rkey: mockPds.put.mock.calls[0][2].rkey,
    })
    expect(mockPds.delete).not.toHaveBeenCalledWith(app.bsky.actor.link, {
      repo: did,
      rkey: mockPds.put.mock.calls[1][2].rkey,
    })
  })

  it('preserves Safelink-blocked websites instead of claiming to migrate them', async () => {
    jest.mocked(checkSafelink).mockResolvedValue('block')
    const baseline = snapshot()
    const {result} = setup(() => usePrepareProfileLinksSave())
    const prepared = await result.current(did, baseline.links, baseline)
    expect(prepared.updates({website}).website).toBe(website)
    expect(mockPds.put).not.toHaveBeenCalled()
  })
})

describe('inline save path', () => {
  it('migrates the website when another link is saved, and caches only after success', async () => {
    const baseline = snapshot()
    const {result, queryClient} = setup(() => useSaveProfileLinksMutation())
    mockUpdateProfile.mockImplementation(({updates}) => {
      const record = updates({website})
      expect(record.website).toBeUndefined()
      expect(record.links).toHaveLength(2)
      expect(
        queryClient.getQueryData(['ownProfileLinks', {did}]),
      ).toBeUndefined()
      return Promise.resolve()
    })
    await act(async () =>
      result.current.save(
        profile,
        [...baseline.links, {url: 'https://new.example/'}],
        baseline,
      ),
    )
    expect(
      queryClient.getQueryData<OwnProfileLinks>(['ownProfileLinks', {did}])!
        .website,
    ).toBeUndefined()
  })

  it('does not update the cache or delete records when the profile write fails', async () => {
    const baseline = snapshot()
    mockUpdateProfile.mockRejectedValueOnce(new Error('Profile write failed'))
    const {result, queryClient} = setup(() => useSaveProfileLinksMutation())
    await expect(
      result.current.save(profile, baseline.links, baseline),
    ).rejects.toThrow('Profile write failed')
    expect(queryClient.getQueryData(['ownProfileLinks', {did}])).toBeUndefined()
    expect(mockPds.delete).not.toHaveBeenCalled()
  })

  it('allows restricted accounts to remove their old website without creating links', async () => {
    mockRestricted = true
    const baseline = snapshot()
    const {result} = setup(() => useSaveProfileLinksMutation())
    await act(async () => result.current.save(profile, [], baseline))
    const updates = mockUpdateProfile.mock.calls[0][0].updates
    expect(updates({website}).website).toBeUndefined()
    expect(mockPds.put).not.toHaveBeenCalled()
    expect(checkSafelink).not.toHaveBeenCalled()
  })

  it('deletes removed native records only after the profile no longer references them', async () => {
    const native = {
      url: 'https://native.example/',
      uri: nativeUri,
      cid: 'native-cid',
    }
    const baseline = {
      ...snapshot(),
      refs: [{uri: nativeUri, cid: 'native-cid'}],
      links: [native, ...snapshot().links],
      urls: [native.url],
    }
    mockPds.get.mockResolvedValue({value: {website, links: baseline.refs}})
    mockUpdateProfile.mockImplementation(() => {
      expect(mockPds.delete).not.toHaveBeenCalled()
      return Promise.resolve()
    })
    const {result} = setup(() => useSaveProfileLinksMutation())
    await act(async () =>
      result.current.save(profile, snapshot().links, baseline),
    )
    expect(mockPds.delete).toHaveBeenCalledWith(app.bsky.actor.link, {
      repo: did,
      rkey: '3laaaaaaaaaaa',
    })
  })
})
