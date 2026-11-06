import {isDidString} from '@atproto/lex'

import {router} from '#/routes'
import {findPublisher, PUBLISHERS} from './publishers'

it('has unique stable IDs and valid account DIDs', () => {
  expect(new Set(PUBLISHERS.map(publisher => publisher.id)).size).toBe(
    PUBLISHERS.length,
  )
  expect(new Set(PUBLISHERS.map(publisher => publisher.did)).size).toBe(
    PUBLISHERS.length,
  )
  expect(PUBLISHERS.every(publisher => isDidString(publisher.did))).toBe(true)
})
it('requires explicit selection rather than silently opening the first publisher', () => {
  expect(findPublisher()).toBeUndefined()
  expect(findPublisher('unknown')).toBeUndefined()
  expect(findPublisher('')).toBeUndefined()
})
it('registers separate directory and publisher-detail URLs', () => {
  expect(router.matchName('PublisherDirectory')?.build()).toBe('/publishers')
  expect(router.matchName('Publisher')?.build({publisher: 'the-verge'})).toBe(
    '/publisher/the-verge',
  )
  expect(router.matchPath('/publishers')).toEqual(['PublisherDirectory', {}])
  expect(router.matchPath('/publisher')).toEqual(['PublisherDirectory', {}])
  expect(router.matchPath('/publisher/the-verge')).toEqual([
    'Publisher',
    {publisher: 'the-verge'},
  ])
})
