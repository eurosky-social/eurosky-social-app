import {beforeEach, describe, expect, it, jest} from '@jest/globals'

const mockCallback = jest.fn<(params: URLSearchParams) => Promise<unknown>>()

jest.mock('../oauth-web-client', () => ({
  getWebOAuthClient: () => ({callback: mockCallback}),
  OAUTH_HANDLE_STEPUP_STATE: 'handle-stepup',
  OAUTH_SIGNUP_STATE: 'signup',
}))
jest.mock('#/logger', () => ({logger: {warn: jest.fn()}}))

const CALLBACK_HASH =
  '#state=Ok4Bnf5IWgb8WnVuQ9OlHQ&iss=https%3A%2F%2Fpds.oso.social&code=cod-1'

let href: URL
const replaceState = jest.fn((_data: unknown, _unused: string, url: string) => {
  href = new URL(url, href)
})

function setUrl(url: string) {
  href = new URL(url)
}

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    get location() {
      return {
        get hash() {
          return href.hash
        },
        get search() {
          return href.search
        },
        get pathname() {
          return href.pathname
        },
      }
    },
    history: {replaceState},
  },
})

const mockLogin = () =>
  jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined)

function load() {
  let mod: typeof import('../oauth-web-callback') | undefined
  jest.isolateModules(() => {
    mod = require('../oauth-web-callback')
  })
  return mod!
}

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return {promise, resolve, reject}
}

describe('tryFinishWebOAuthSignIn', () => {
  beforeEach(() => {
    mockCallback.mockReset()
    replaceState.mockClear()
  })

  it('ignores a URL without callback params', async () => {
    setUrl('https://oso.social/')
    const {tryFinishWebOAuthSignIn} = load()
    const login = mockLogin()
    await expect(tryFinishWebOAuthSignIn(login, jest.fn())).resolves.toBe(false)
    expect(mockCallback).not.toHaveBeenCalled()
    expect(replaceState).not.toHaveBeenCalled()
  })

  it('clears the URL before exchanging the code', () => {
    setUrl(`https://oso.social/${CALLBACK_HASH}`)
    mockCallback.mockReturnValue(new Promise(() => {}))
    const {tryFinishWebOAuthSignIn} = load()
    void tryFinishWebOAuthSignIn(mockLogin(), jest.fn())
    expect(href.href).toBe('https://oso.social/')
    expect(mockCallback).toHaveBeenCalledTimes(1)
    const params = mockCallback.mock.calls[0][0]
    expect(params.get('code')).toBe('cod-1')
    expect(params.get('iss')).toBe('https://pds.oso.social')
  })

  it('exchanges the code once when the startup effect runs twice', async () => {
    setUrl(`https://oso.social/${CALLBACK_HASH}`)
    const exchange = deferred<unknown>()
    mockCallback.mockReturnValue(exchange.promise)
    const {tryFinishWebOAuthSignIn} = load()
    const login = mockLogin()

    const first = tryFinishWebOAuthSignIn(login, jest.fn())
    // The effect re-runs (new `login` identity) while the exchange is pending.
    const second = tryFinishWebOAuthSignIn(login, jest.fn())
    exchange.resolve({session: {sub: 'did:plc:x'}, state: null})

    await expect(first).resolves.toBe(true)
    await expect(second).resolves.toBe(true)
    expect(mockCallback).toHaveBeenCalledTimes(1)
    expect(login).toHaveBeenCalledTimes(1)
  })

  it('returns false on a failed callback so the stored account resumes', async () => {
    setUrl(`https://oso.social/${CALLBACK_HASH}`)
    mockCallback.mockRejectedValue(new Error('Unknown authorization session'))
    const {tryFinishWebOAuthSignIn} = load()
    const login = mockLogin()
    await expect(tryFinishWebOAuthSignIn(login, jest.fn())).resolves.toBe(false)
    expect(login).not.toHaveBeenCalled()
    expect(href.href).toBe('https://oso.social/')
  })

  it('lands a handle step-up on account settings', async () => {
    setUrl(`https://oso.social/${CALLBACK_HASH}`)
    mockCallback.mockResolvedValue({session: {}, state: 'handle-stepup'})
    const {tryFinishWebOAuthSignIn} = load()
    await expect(tryFinishWebOAuthSignIn(mockLogin(), jest.fn())).resolves.toBe(
      true,
    )
    expect(href.pathname).toBe('/settings/account')
  })
})
