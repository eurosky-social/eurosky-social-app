import {api} from '@bsky/sdk'
import {moderatePost, type ModerationPrefs} from '@bsky/sdk/moderation'
import {renderHook} from '@testing-library/react-native'

import {EUROSKY_LABELER_DID} from '#/lib/constants'
import {useHiddenPosts, useLabelDefinitions} from '#/state/preferences'
import {usePreferencesQuery} from '#/state/queries/preferences'
import {
  DEFAULT_LOGGED_OUT_LABEL_PREFERENCES,
  DEFAULT_LOGGED_OUT_PREFERENCES,
} from '#/state/queries/preferences/const'
import {useSession} from '#/state/session'
import {makeAccount} from '#/state/session/__tests__/mock-fetch'
import {configureGlobalAppLabelers} from '#/state/session/additional-moderation-authorities'
import {type app} from '#/lexicons'
import {Provider, useModerationOpts} from './moderation-opts'

jest.mock('#/state/preferences', () => ({
  useHiddenPosts: jest.fn(),
  useLabelDefinitions: jest.fn(),
}))
jest.mock('#/state/queries/preferences', () => ({
  usePreferencesQuery: jest.fn(),
}))
jest.mock('#/state/session', () => ({
  useSession: jest.fn(),
}))

const postUri = 'at://did:plc:author/app.bsky.feed.post/labeled'
const post: app.bsky.feed.defs.PostView = {
  uri: postUri,
  cid: 'bafyreier4bw4uezqpkrb6icsi2okglvvnrrle5fivkqoovfmafnu7ravge',
  author: {did: 'did:plc:author', handle: 'author.example.com'},
  record: {
    $type: 'app.bsky.feed.post',
    text: 'Labeled post',
    createdAt: '2026-06-11T00:00:00.000Z',
  },
  indexedAt: '2026-06-11T00:00:00.000Z',
  labels: [
    {
      src: EUROSKY_LABELER_DID,
      uri: postUri,
      val: 'porn',
      cts: '2026-06-11T00:00:00.000Z',
    },
  ],
}

function setCachedPreferences(
  overrides: Partial<ModerationPrefs> = {},
  error: Error | null = null,
) {
  const moderationPrefs: ModerationPrefs = {
    ...DEFAULT_LOGGED_OUT_PREFERENCES.moderationPrefs,
    labels: {porn: 'ignore'},
    labelers: [{did: api.moderation.did, labels: {}}],
    ...overrides,
  }
  jest.mocked(usePreferencesQuery).mockReturnValue({
    data: {...DEFAULT_LOGGED_OUT_PREFERENCES, moderationPrefs},
    error,
    isFetching: !error,
  } as ReturnType<typeof usePreferencesQuery>)
  return moderationPrefs
}

beforeEach(() => {
  jest.resetAllMocks()
  configureGlobalAppLabelers([api.moderation.did, EUROSKY_LABELER_DID])
  const viewer = makeAccount({did: 'did:plc:viewer'})
  jest.mocked(useSession).mockReturnValue({
    accounts: [viewer],
    currentAccount: viewer,
    hasSession: true,
  })
  jest.mocked(useHiddenPosts).mockReturnValue([])
  jest
    .mocked(useLabelDefinitions)
    .mockReturnValue({labelDefs: {}, labelers: []})
  setCachedPreferences()
})

afterEach(() => {
  configureGlobalAppLabelers([])
})

describe('moderation options with cached preferences', () => {
  it.each([
    {state: 'pending', error: null},
    {state: 'failed', error: new Error('Preferences refresh failed')},
  ])(
    'enforces Eurosky adult labels while a preferences refresh is $state',
    ({error}) => {
      const cachedPrefs = setCachedPreferences({}, error)
      Object.freeze(cachedPrefs.labelers)

      const {result} = renderHook(useModerationOpts, {wrapper: Provider})
      const decision = moderatePost(post, result.current!)

      expect(decision.ui('contentList').filter).toBe(true)
      expect(decision.ui('contentMedia').blur).toBe(true)
      expect(decision.ui('contentMedia').noOverride).toBe(true)
      expect(cachedPrefs.labelers).toEqual([
        {did: api.moderation.did, labels: {}},
      ])
    },
  )

  it('preserves existing labeler settings and user subscriptions without duplicates', () => {
    const cachedPrefs = setCachedPreferences({
      adultContentEnabled: true,
      labelers: [
        {did: api.moderation.did, labels: {porn: 'warn'}},
        {did: EUROSKY_LABELER_DID, labels: {porn: 'ignore'}},
        {did: 'did:plc:user-labeler', labels: {spam: 'hide'}},
      ],
    })

    const {result} = renderHook(useModerationOpts, {wrapper: Provider})

    expect(result.current?.prefs.labelers).toEqual(cachedPrefs.labelers)
    expect(moderatePost(post, result.current!).ui('contentMedia').blur).toBe(
      false,
    )
  })

  it('uses global content preferences for newly added labelers when signed in', () => {
    setCachedPreferences({adultContentEnabled: true, labels: {porn: 'warn'}})

    const {result} = renderHook(useModerationOpts, {wrapper: Provider})
    const decision = moderatePost(post, result.current!)

    expect(result.current?.prefs.labelers).toContainEqual({
      did: EUROSKY_LABELER_DID,
      labels: {},
    })
    expect(decision.ui('contentList').filter).toBe(false)
    expect(decision.ui('contentMedia').blur).toBe(true)
    expect(decision.ui('contentMedia').noOverride).toBe(false)
  })

  it('adds every missing app labeler rather than only Eurosky', () => {
    const additionalLabeler = 'did:plc:additional-app-labeler'
    configureGlobalAppLabelers([
      api.moderation.did,
      EUROSKY_LABELER_DID,
      additionalLabeler,
    ])

    const {result} = renderHook(useModerationOpts, {wrapper: Provider})

    expect(result.current?.prefs.labelers.map(labeler => labeler.did)).toEqual([
      api.moderation.did,
      EUROSKY_LABELER_DID,
      additionalLabeler,
    ])
  })

  it('keeps strict logged-out defaults for app labelers', () => {
    jest.mocked(useSession).mockReturnValue({
      accounts: [],
      currentAccount: undefined,
      hasSession: false,
    })
    setCachedPreferences(DEFAULT_LOGGED_OUT_PREFERENCES.moderationPrefs)

    const {result} = renderHook(useModerationOpts, {wrapper: Provider})

    expect(result.current?.prefs.labelers).toEqual([
      {did: api.moderation.did, labels: DEFAULT_LOGGED_OUT_LABEL_PREFERENCES},
      {did: EUROSKY_LABELER_DID, labels: DEFAULT_LOGGED_OUT_LABEL_PREFERENCES},
    ])
    expect(moderatePost(post, result.current!).ui('contentList').filter).toBe(
      true,
    )
  })

  it('waits for preferences when there is no cached data', () => {
    jest.mocked(usePreferencesQuery).mockReturnValue({
      data: undefined,
    } as ReturnType<typeof usePreferencesQuery>)

    const {result} = renderHook(useModerationOpts, {wrapper: Provider})

    expect(result.current).toBeUndefined()
  })
})
