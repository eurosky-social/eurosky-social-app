import {publisherFeedDescriptor, publisherFeedSources} from './feedDescriptor'
import {followedPublisherDids} from './following'
import {PUBLISHERS} from './publishers'

it('includes only followed configured publishers, excluding blocked and unrelated accounts', () => {
  expect(
    followedPublisherDids([
      {did: PUBLISHERS[0].did, viewer: {following: 'at://follow/one'}},
      {did: PUBLISHERS[1].did},
      {
        did: PUBLISHERS[2].did,
        viewer: {following: 'at://follow/two', blockedBy: true},
      },
      {
        did: PUBLISHERS[3].did,
        viewer: {following: 'at://follow/three', blockingByList: {}},
      },
      {did: 'did:plc:reader', viewer: {following: 'at://follow/reader'}},
    ]),
  ).toEqual([PUBLISHERS[0].did])
})
it('uses stable, isolated article/video cache identities and never requests foreign authors', () => {
  const selected = [PUBLISHERS[1].did, PUBLISHERS[0].did]
  const desc = publisherFeedDescriptor('articles', selected)
  expect(desc).toBe(
    publisherFeedDescriptor('articles', [...selected].reverse()),
  )
  expect(desc).not.toBe(publisherFeedDescriptor('articles'))
  expect(desc).not.toBe(publisherFeedDescriptor('videos', selected))
  expect(publisherFeedSources(desc)).toEqual([
    PUBLISHERS[0].did,
    PUBLISHERS[1].did,
  ])
  expect(publisherFeedSources('publishers|following|did:plc:reader')).toEqual(
    [],
  )
  expect(publisherFeedSources(publisherFeedDescriptor('articles', []))).toEqual(
    [],
  )
  expect(publisherFeedSources('publishers|articles')).toBeUndefined()
  expect(
    followedPublisherDids([
      {did: PUBLISHERS[0].did, viewer: {following: undefined}},
    ]),
  ).toEqual([])
})
