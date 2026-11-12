import {pdsAccountLink} from './pdsAccountLink'

describe('pdsAccountLink', () => {
  it('sends Bluesky-hosted accounts to bsky.social, not their PDS', () => {
    expect(
      pdsAccountLink({
        pdsUrl: 'https://morel.us-east.host.bsky.network',
        service: 'https://bsky.social/',
      }),
    ).toEqual({
      host: 'Bluesky',
      url: 'https://bsky.social/account',
      isBlueskyHosted: true,
    })
  })

  it('uses the PDS when it is its own authorization server', () => {
    expect(
      pdsAccountLink({
        pdsUrl: 'https://pds.example.com',
        service: 'https://pds.example.com/',
      }),
    ).toEqual({
      host: 'pds.example.com',
      url: 'https://pds.example.com/account',
      isBlueskyHosted: false,
    })
  })

  it('falls back to the PDS when the issuer is missing', () => {
    expect(pdsAccountLink({pdsUrl: 'https://pds.example.com'})).toEqual({
      host: 'pds.example.com',
      url: 'https://pds.example.com/account',
      isBlueskyHosted: false,
    })
  })

  it('returns no link without a known server', () => {
    expect(pdsAccountLink({})).toEqual({
      host: '',
      url: '',
      isBlueskyHosted: false,
    })
  })
})
