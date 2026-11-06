import {Text} from 'react-native'
import {i18n} from '@lingui/core'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {act, render, renderHook, waitFor} from '@testing-library/react-native'

import {MessagesEventBusProvider} from '#/state/messages/events'
import {MessagesEventBus} from '#/state/messages/events/agent'
import {
  useGetJoinLinkPreview,
  useJoinLinkPreviewsQuery,
  usePrefetchJoinLinkPreviews,
} from '#/state/queries/join-links'
import {useUpdateActorDeclaration} from '#/state/queries/messages/actor-declaration'
import {useConvoQuery} from '#/state/queries/messages/conversation'
import {useGetConvoAvailabilityQuery} from '#/state/queries/messages/get-convo-availability'
import {useChatActorStatusQuery} from '#/state/queries/messages/get-status'
import {
  RQKEY as unreadKey,
  useUnreadCountsQuery,
} from '#/state/queries/messages/get-unread-counts'
import {useListConvoRequests} from '#/state/queries/messages/list-conversation-requests'
import {
  ListConvosProvider,
  useListConvosQuery,
  useUnreadMessageCount,
} from '#/state/queries/messages/list-conversations'
import {useListConvoMembersQuery} from '#/state/queries/messages/list-convo-members'
import {useListJoinRequestsQuery} from '#/state/queries/messages/list-join-requests'
import {useListMutualGroupsQuery} from '#/state/queries/messages/list-mutual-groups'
import {
  useChatNotificationSettingsQuery,
  useNotificationSettingsUpdateMutation,
} from '#/state/queries/notifications/settings'
import {getProduct, PRODUCT} from '#/config/product'
import {chat} from '#/lexicons'
import {MessagingUnavailableError} from './messaging'

const mockCall = jest.fn()
const mockBus = {
  on: jest.fn(() => jest.fn()),
  updateClient: jest.fn(),
  resume: jest.fn(),
  suspend: jest.fn(),
  background: jest.fn(),
}
const mockClient = {did: 'did:plc:alice', call: mockCall}
const mockAccount = {did: 'did:plc:alice', handle: 'alice.test'}

jest.mock('#/config/product', () => {
  const actual = jest.requireActual<{getProduct: typeof getProduct}>(
    '#/config/product',
  )
  return {...actual, PRODUCT: actual.getProduct('social')}
})
jest.mock('#/state/queries/profile', () => ({
  RQKEY: (did: string) => ['profile', did],
}))
jest.mock('#/features/appView/shadow', () => ({
  withAppViewShadowFetch: (fetch: typeof globalThis.fetch) => fetch,
}))
jest.mock('#/state/session', () => ({
  useSession: () => ({hasSession: true, currentAccount: mockAccount}),
  useChatClient: () => mockClient,
  usePdsClient: () => mockClient,
  useAppviewClient: () => mockClient,
}))
jest.mock('#/state/messages/events/agent', () => ({
  MessagesEventBus: jest.fn(() => mockBus),
}))
jest.mock('#/state/messages/events', () => ({
  ...jest.requireActual<object>('#/state/messages/events'),
  useMessagesEventBus: () => mockBus,
}))
jest.mock('#/ageAssurance', () => ({
  useAgeAssurance: () => ({flags: {groupChatDisabled: false}}),
}))
jest.mock('#/alf', () => ({
  platform: ({default: fallback}: {default: unknown}) => fallback,
}))
jest.mock('#/components/Toast', () => ({show: jest.fn()}))
jest.mock('#/logger', () => ({
  logger: {error: jest.fn(), warn: jest.fn(), debug: jest.fn()},
}))
jest.mock('#/analytics/identifiers', () => ({
  getDeviceId: () => undefined,
  getSessionId: () => undefined,
}))

let queryClient: QueryClient
beforeEach(() => {
  i18n.loadAndActivate({locale: 'en', messages: {}})
  queryClient = new QueryClient({
    defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
  })
})
afterEach(() => {
  queryClient.clear()
  jest.restoreAllMocks()
  jest.clearAllMocks()
})
function wrapper({children}: {children: React.ReactNode}) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

it('leaves all chat reads idle even if callers enable them, and hides cached unread counts', async () => {
  jest.replaceProperty(PRODUCT, 'capabilities', getProduct('news').capabilities)
  queryClient.setQueryData(unreadKey(true), {
    unreadAcceptedConvos: 4,
    unreadRequestConvos: 3,
  })
  const {result} = renderHook(
    () => ({
      queries: [
        useUnreadCountsQuery(),
        useChatActorStatusQuery(),
        useGetConvoAvailabilityQuery('did:plc:bob', {enabled: true}),
        useListConvosQuery({enabled: true}),
        useListConvoRequests({enabled: true}),
        useConvoQuery({convoId: 'convo'}),
        useListConvoMembersQuery({convoId: 'convo'}),
        useListMutualGroupsQuery({subject: 'did:plc:bob', enabled: true}),
        useListJoinRequestsQuery({convoId: 'convo', enabled: true}),
        useJoinLinkPreviewsQuery({codes: ['code'], hasSession: false}),
        useChatNotificationSettingsQuery({enabled: true}),
      ],
      unread: useUnreadMessageCount(),
    }),
    {wrapper},
  )
  await act(async () => {
    await Promise.resolve()
  })
  expect(
    result.current.queries.every(query => query.fetchStatus === 'idle'),
  ).toBe(true)
  expect(result.current.unread).toEqual({
    count: 0,
    hasNew: false,
    numUnread: undefined,
  })
  expect(mockCall).not.toHaveBeenCalled()
  expect(mockBus.on).not.toHaveBeenCalled()
})

it('does not prefetch or resolve chat invitations, even through imperative hooks', async () => {
  jest.replaceProperty(PRODUCT, 'capabilities', getProduct('news').capabilities)
  const {result} = renderHook(
    () => ({
      prefetch: usePrefetchJoinLinkPreviews(),
      get: useGetJoinLinkPreview(),
    }),
    {wrapper},
  )
  await result.current.prefetch({codes: ['code'], hasSession: false})
  await expect(
    result.current.get({code: 'code', hasSession: true}),
  ).resolves.toBeUndefined()
  expect(mockCall).not.toHaveBeenCalled()
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
})

it('does not construct a polling bus or subscribe the conversation-list provider in news', () => {
  jest.replaceProperty(PRODUCT, 'capabilities', getProduct('news').capabilities)
  const screen = render(
    <MessagesEventBusProvider>
      <ListConvosProvider>
        <Text>App</Text>
      </ListConvosProvider>
    </MessagesEventBusProvider>,
    {wrapper},
  )
  expect(screen.getByText('App')).toBeTruthy()
  expect(MessagesEventBus).not.toHaveBeenCalled()
  expect(mockBus.on).not.toHaveBeenCalled()
  expect(mockCall).not.toHaveBeenCalled()
})

it('still constructs and resumes the polling bus for social accounts', () => {
  render(
    <MessagesEventBusProvider>
      <Text>App</Text>
    </MessagesEventBusProvider>,
    {wrapper},
  )
  expect(MessagesEventBus).toHaveBeenCalledTimes(1)
  expect(mockBus.resume).toHaveBeenCalled()
})

it('still fetches social unread counts', async () => {
  mockCall.mockResolvedValue({unreadAcceptedConvos: 2, unreadRequestConvos: 0})
  const {result} = renderHook(useUnreadCountsQuery, {wrapper})
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(mockCall).toHaveBeenCalledWith(chat.bsky.convo.getUnreadCounts, {
    includeGroupChats: true,
  })
})

it('blocks chat declaration mutations before PDS writes or optimistic updates', async () => {
  jest.replaceProperty(PRODUCT, 'capabilities', getProduct('news').capabilities)
  const {result} = renderHook(() => useUpdateActorDeclaration({}), {wrapper})
  await act(async () => {
    await expect(
      result.current.mutateAsync({allowIncoming: 'all'}),
    ).rejects.toBeInstanceOf(MessagingUnavailableError)
  })
  expect(mockCall).not.toHaveBeenCalled()
})

it('rejects mixed chat/app notification updates atomically before any request', async () => {
  jest.replaceProperty(PRODUCT, 'capabilities', getProduct('news').capabilities)
  const {result} = renderHook(useNotificationSettingsUpdateMutation, {wrapper})
  await act(async () => {
    await expect(
      result.current.mutateAsync({
        chat: {push: true, include: 'all'},
        like: {include: 'all', list: true, push: true},
      }),
    ).rejects.toBeInstanceOf(MessagingUnavailableError)
  })
  expect(mockCall).not.toHaveBeenCalled()
})
