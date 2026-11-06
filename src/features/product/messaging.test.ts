import {createLexClient} from '#/lib/lexClient'
import {getProduct, PRODUCT} from '#/config/product'
import {app, chat} from '#/lexicons'
import {
  assertMessagingEnabled,
  isMessagingRequestAllowed,
  isProductRouteAvailable,
  MessagingUnavailableError,
} from './messaging'

/** Exercise lex's real payload encoding, not the legacy CID mock. */
jest.unmock('multiformats/cid')

jest.mock('#/analytics/identifiers', () => ({
  getDeviceId: () => undefined,
  getSessionId: () => undefined,
}))
jest.mock('#/features/appView/shadow', () => ({
  withAppViewShadowFetch: (fetch: typeof globalThis.fetch) => fetch,
}))

const news = getProduct('news')
const social = getProduct('social')
const did = 'did:plc:alicealicealicealicealice'
afterEach(() => jest.restoreAllMocks())

it('keeps social messaging and rejects unsupported actions independently of login', () => {
  expect(() => assertMessagingEnabled(social)).not.toThrow()
  expect(() => assertMessagingEnabled(news)).toThrow(MessagingUnavailableError)
})

it.each([
  'Messages',
  'MessagesTab',
  'MessagesConversation',
  'MessagesConversationSettings',
  'MessagesJoinRequests',
  'MessagesSettings',
  'MessagesInbox',
])('disables %s without unregistering routes', name => {
  expect(isProductRouteAvailable(name, news)).toBe(false)
  expect(isProductRouteAvailable(name, social)).toBe(true)
})
it.each([
  'Home',
  'HomeTab',
  'Profile',
  'MyProfile',
  'Settings',
  'NotificationSettings',
  'NotFound',
])('retains non-messaging route %s', name =>
  expect(isProductRouteAvailable(name, news)).toBe(true),
)
it.each([
  '/xrpc/chat.bsky.convo.getLog',
  'https://pds.test/xrpc/chat.bsky.convo.sendMessage',
  '/xrpc/chat.bsky.group.requestJoin',
  '/xrpc/chat.bsky.notification.getPreferences',
])('rejects chat transport %s', path =>
  expect(isMessagingRequestAllowed(path, news)).toBe(false),
)

it('keeps account deletion cleanup and non-chat traffic independent of messaging', () => {
  expect(
    isMessagingRequestAllowed('/xrpc/chat.bsky.actor.deleteAccount', news),
  ).toBe(true)
  expect(
    isMessagingRequestAllowed('/xrpc/com.atproto.server.deleteAccount', news),
  ).toBe(true)
  expect(
    isMessagingRequestAllowed('/xrpc/app.bsky.feed.getTimeline', news),
  ).toBe(true)
  expect(
    isMessagingRequestAllowed('/xrpc/chat.bsky.actor.exportAccountData', news),
  ).toBe(false)
})

it('blocks actual read, write, group, and notification calls before reaching the session', async () => {
  jest.replaceProperty(PRODUCT, 'capabilities', news.capabilities)
  const fetchHandler = jest.fn()
  const client = createLexClient({did, fetchHandler})
  expect(client.did).toBe(did)
  const calls = [
    () => client.call(chat.bsky.convo.listConvos, {}),
    () => client.call(chat.bsky.convo.getLog, {}),
    () =>
      client.call(chat.bsky.convo.sendMessage, {
        convoId: 'test',
        message: {text: 'Hello'},
      }),
    () =>
      client.call(chat.bsky.convo.addReaction, {
        convoId: 'test',
        messageId: 'message',
        value: '👍',
      }),
    () =>
      client.call(chat.bsky.group.createGroup, {name: 'Group', members: [did]}),
    () => client.call(chat.bsky.group.requestJoin, {code: 'code'}),
    () => client.call(chat.bsky.notification.getPreferences),
  ]
  for (const [index, call] of calls.entries()) {
    const failure = await call().catch((error: Error & {cause?: unknown}) => ({
      index,
      cause: error.cause,
    }))
    expect(failure).toMatchObject({
      index,
      cause: expect.any(MessagingUnavailableError),
    })
  }
  expect(fetchHandler).not.toHaveBeenCalled()
})

it('blocks unauthenticated/public chat clients too, including a per-call service override', async () => {
  jest.replaceProperty(PRODUCT, 'capabilities', news.capabilities)
  const fetch = jest.fn()
  const client = createLexClient({service: 'https://chat.test', fetch})
  await expect(
    client.call(
      chat.bsky.group.getJoinLinkPreviews,
      {codes: ['code']},
      {service: 'did:web:other-chat.test#bsky_chat'},
    ),
  ).rejects.toMatchObject({cause: expect.any(MessagingUnavailableError)})
  expect(fetch).not.toHaveBeenCalled()
})

it('continues to dispatch ordinary news reads and explicit account-deletion cleanup', async () => {
  jest.replaceProperty(PRODUCT, 'capabilities', news.capabilities)
  const fetchHandler = jest.fn((path: string) =>
    Promise.resolve(
      new Response(
        JSON.stringify(
          path.includes('getProfile') ? {did, handle: 'alice.test'} : {},
        ),
        {headers: {'content-type': 'application/json'}},
      ),
    ),
  )
  const client = createLexClient({did, fetchHandler})
  await expect(
    client.call(app.bsky.actor.getProfile, {actor: did}),
  ).resolves.toMatchObject({did})
  await client.call(chat.bsky.actor.deleteAccount)
  expect(fetchHandler).toHaveBeenCalledTimes(2)
})

it('preserves real social chat client requests', async () => {
  jest.replaceProperty(PRODUCT, 'capabilities', social.capabilities)
  const fetchHandler = jest.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({convos: []}), {
        headers: {'content-type': 'application/json'},
      }),
    ),
  )
  const client = createLexClient({did, fetchHandler})
  await expect(client.call(chat.bsky.convo.listConvos, {})).resolves.toEqual({
    convos: [],
  })
  expect(fetchHandler).toHaveBeenCalledTimes(1)
})
