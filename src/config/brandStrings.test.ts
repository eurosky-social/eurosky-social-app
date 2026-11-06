import {BRAND} from '#/config/brand'
import {rebrandMessages} from '#/config/brandStrings'

it.each([
  ['PiFjQA', 'Sign in to Bluesky or create a new account'],
  ['dKRV7a', 'Post it to Bluesky or share anywhere.'],
])('rebrands app copy in %s without mutating the catalog', (id, message) => {
  const catalog = {[id]: message}

  expect(rebrandMessages(catalog)[id]).toBe(
    message.replace('Bluesky', BRAND.name),
  )
  expect(catalog[id]).toBe(message)
})

it('rebrands translated app copy with the same message ID', () => {
  expect(
    rebrandMessages({
      PiFjQA: 'Log in bij Bluesky of maak een nieuw account aan',
    }).PiFjQA,
  ).toBe(`Log in bij ${BRAND.name} of maak een nieuw account aan`)
})

it('does not rebrand an unlisted reference to the Bluesky network', () => {
  const message = 'Bluesky is an open network.'

  expect(rebrandMessages({network: message}).network).toBe(message)
})
