import {describe, expect, it, jest} from '@jest/globals'

import {BRAND} from '../../../src/config/brand'

const HOST = BRAND.web.hosts[0]

/** The url helpers as built for Oso (or not), freshly loaded. */
function loadHelpers(isOso: boolean) {
  let helpers!: typeof import('../../../src/lib/strings/url-helpers')
  jest.isolateModules(() => {
    jest.doMock('#/env', () => ({
      ...jest.requireActual<object>('#/env'),
      IS_PARTNER_PREVIEW: isOso,
    }))
    helpers = require('../../../src/lib/strings/url-helpers')
  })
  return helpers
}

describe('Oso static pages', () => {
  it('opens /about/ pages as web pages in the Oso build', () => {
    const {isBskyAppUrl, convertBskyAppUrlIfNeeded, isTrustedUrl} =
      loadHelpers(true)
    const url = `https://${HOST}/about/faq.html`
    expect(isBskyAppUrl(url)).toBe(false)
    expect(convertBskyAppUrlIfNeeded(url)).toBe(url)
    // Still first-party, so no leaving-the-app warning.
    expect(isTrustedUrl(url)).toBe(true)
  })

  it('keeps routing other paths inside the app', () => {
    const {isBskyAppUrl, convertBskyAppUrlIfNeeded} = loadHelpers(true)
    const url = `https://${HOST}/profile/alice.test`
    expect(isBskyAppUrl(url)).toBe(true)
    expect(convertBskyAppUrlIfNeeded(url)).toBe('/profile/alice.test')
  })

  it('leaves /about/ to the app outside the Oso build', () => {
    const {isBskyAppUrl} = loadHelpers(false)
    expect(isBskyAppUrl(`https://${HOST}/about/faq.html`)).toBe(true)
  })
})
