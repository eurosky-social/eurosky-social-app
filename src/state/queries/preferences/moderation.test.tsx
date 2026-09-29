import {Client} from '@atproto/lex'
import {api} from '@bsky/sdk'
import {renderHook} from '@testing-library/react-native'

import {EUROSKY_LABELER_DID} from '#/lib/constants'
import {
  configureGlobalAppLabelers,
  DE_LABELER,
} from '#/state/session/additional-moderation-authorities'
import {configureModerationForGuest} from '#/state/session/moderation'
import {useLabelersDetailedInfoQuery} from '../labeler'
import {DEFAULT_LOGGED_OUT_PREFERENCES} from './const'
import {usePreferencesQuery} from './index'
import {useMyLabelersQuery} from './moderation'
import {type UsePreferencesQueryResponse} from './types'

jest.mock('#/storage', () => ({
  device: {get: jest.fn()},
}))
jest.mock('../labeler', () => ({
  useLabelersDetailedInfoQuery: jest.fn(),
}))
jest.mock('./index', () => ({
  usePreferencesQuery: jest.fn(),
}))

beforeEach(() => {
  jest.resetAllMocks()
  configureModerationForGuest()
  jest.mocked(usePreferencesQuery).mockReturnValue({
    data: DEFAULT_LOGGED_OUT_PREFERENCES,
    isLoading: false,
    error: null,
  } as ReturnType<typeof usePreferencesQuery>)
  jest.mocked(useLabelersDetailedInfoQuery).mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useLabelersDetailedInfoQuery>)
})

afterEach(() => {
  configureGlobalAppLabelers([])
})

describe('useMyLabelersQuery', () => {
  it('offers Eurosky alongside Bluesky for reporting without a stored subscription', () => {
    renderHook(() => useMyLabelersQuery({excludeNonConfigurableLabelers: true}))

    expect(useLabelersDetailedInfoQuery).toHaveBeenCalledWith({
      dids: [api.moderation.did, EUROSKY_LABELER_DID],
    })
  })

  it('keeps user subscriptions without duplicating either app labeler', () => {
    const preferences: UsePreferencesQueryResponse = {
      ...DEFAULT_LOGGED_OUT_PREFERENCES,
      moderationPrefs: {
        ...DEFAULT_LOGGED_OUT_PREFERENCES.moderationPrefs,
        labelers: [
          {did: api.moderation.did, labels: {}},
          {did: EUROSKY_LABELER_DID, labels: {}},
          {did: 'did:plc:account-labeler', labels: {}},
        ],
      },
    }
    jest.mocked(usePreferencesQuery).mockReturnValue({
      data: preferences,
      isLoading: false,
      error: null,
    } as ReturnType<typeof usePreferencesQuery>)

    renderHook(() => useMyLabelersQuery({excludeNonConfigurableLabelers: true}))

    expect(useLabelersDetailedInfoQuery).toHaveBeenCalledWith({
      dids: [
        api.moderation.did,
        EUROSKY_LABELER_DID,
        'did:plc:account-labeler',
      ],
    })
  })

  it('excludes regional authorities from reporting but not Eurosky or Bluesky', () => {
    configureGlobalAppLabelers([...Client.appLabelers, DE_LABELER])

    renderHook(() => useMyLabelersQuery({excludeNonConfigurableLabelers: true}))

    expect(useLabelersDetailedInfoQuery).toHaveBeenCalledWith({
      dids: [api.moderation.did, EUROSKY_LABELER_DID],
    })
  })
})
