import {defaults, tryParse, tryStringify} from './schema'

jest.mock('#/logger', () => ({logger: {error: jest.fn()}}))
jest.mock('#/locale/deviceLocales', () => ({
  deviceLanguageCodes: ['en'],
  deviceLocales: [{languageTag: 'en'}],
}))
jest.mock('#/locale/helpers', () => ({findSupportedAppLanguage: () => 'en'}))

it('accepts obsolete seasonal data without discarding sessions or preferences', () => {
  const account = {
    did: 'did:plc:alice',
    handle: 'alice.test',
    service: 'https://pds.test',
    accessJwt: 'saved-access-token',
    refreshJwt: 'saved-refresh-token',
  }
  const saved = {
    ...defaults,
    colorMode: 'light',
    accentColor: 'blue',
    session: {accounts: [account], currentAccount: account},
    halloween: {enabled: true, promptedYear: 2026},
    halloweenCostumes: {'did:plc:alice': {pixels: 'obsolete art'}},
    halloweenCostumeColors: {'did:plc:alice': ['not a valid color']},
  }
  const restored = tryParse(JSON.stringify(saved))
  expect(restored).toBeDefined()
  expect(restored?.session).toEqual(saved.session)
  expect(restored?.colorMode).toBe('light')
  expect(restored?.accentColor).toBe('blue')
  expect(tryStringify(restored!)).toBeDefined()
})
