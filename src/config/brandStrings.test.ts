import {BRAND} from '#/config/brand'
import {rebrandMessages} from '#/config/brandStrings'

it.each([
  [
    '6oSz7c',
    'Bluesky now makes full use of your iPad’s screen, in any orientation. It’s still in beta, so if something looks off, let us know in Settings → Beta features.',
  ],
  [
    'SdoOAM',
    'Bluesky adapts to your iPad’s screen in any orientation or window size.',
  ],
])(
  'rebrands iPad app copy in %s without mutating the catalog',
  (id, message) => {
    const catalog = {[id]: message}

    expect(rebrandMessages(catalog)[id]).toBe(
      message.replace('Bluesky', BRAND.name),
    )
    expect(catalog[id]).toBe(message)
  },
)

it('rebrands translated iPad settings copy with the same message ID', () => {
  expect(
    rebrandMessages({
      SdoOAM: 'Bluesky past zich aan het scherm van je iPad aan.',
    }).SdoOAM,
  ).toBe(`${BRAND.name} past zich aan het scherm van je iPad aan.`)
})

it('does not rebrand an unlisted reference to the Bluesky network', () => {
  const message = 'Bluesky is an open network.'

  expect(rebrandMessages({network: message}).network).toBe(message)
})
