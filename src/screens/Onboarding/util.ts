import {TID} from '@atproto/common-web'
import {type $Typed, type Client} from '@atproto/lex'
import {
  type AtIdentifierString,
  type DidString,
  toDatetimeString,
} from '@atproto/syntax'
import chunk from 'lodash.chunk'

import {until} from '#/lib/async/until'
import {app, com} from '#/lexicons'

export async function bulkWriteFollows(
  pdsClient: Client,
  appviewClient: Client,
  dids: string[],
  via?: com.atproto.repo.strongRef.Main,
) {
  const did = pdsClient.assertDid

  const followRecords: $Typed<app.bsky.graph.follow.Main>[] = dids.map(did => {
    return {
      $type: 'app.bsky.graph.follow',
      // the helper takes the dids as plain strings
      subject: did as DidString,
      createdAt: toDatetimeString(new Date()),
      via,
    }
  })

  const followWrites: $Typed<com.atproto.repo.applyWrites.Create>[] =
    followRecords.map(r => ({
      $type: 'com.atproto.repo.applyWrites#create',
      collection: 'app.bsky.graph.follow',
      rkey: TID.nextStr(),
      value: r,
    }))

  const chunks = chunk(followWrites, 50)
  for (const chunk of chunks) {
    await pdsClient.call(com.atproto.repo.applyWrites, {
      repo: did,
      writes: chunk,
    })
  }
  await whenFollowsIndexed(appviewClient, did, res => !!res.follows.length)

  const followUris = new Map<string, string>()
  for (const r of followWrites) {
    followUris.set(
      r.value.subject as string,
      `at://${did}/app.bsky.graph.follow/${r.rkey}`,
    )
  }
  return followUris
}

/**
 * Creates `app.bsky.feed.like` records for the given post strong refs (uri + cid)
 * in the current user's repo. Used during onboarding to seed the personalized
 * feed with a like per selected interest (each interest maps to a picker-account
 * "interest post"; refs are discovered by interestPostRefsFor).
 */
export async function bulkWriteLikes(
  pdsClient: Client,
  subjects: com.atproto.repo.strongRef.Main[],
) {
  if (subjects.length === 0) return

  const did = pdsClient.assertDid
  const likeWrites: $Typed<com.atproto.repo.applyWrites.Create>[] =
    subjects.map(subject => ({
      $type: 'com.atproto.repo.applyWrites#create',
      collection: 'app.bsky.feed.like',
      rkey: TID.nextStr(),
      value: {
        $type: 'app.bsky.feed.like',
        subject,
        createdAt: toDatetimeString(new Date()),
      } satisfies $Typed<app.bsky.feed.like.Main>,
    }))

  const chunks = chunk(likeWrites, 50)
  for (const chunk of chunks) {
    await pdsClient.call(com.atproto.repo.applyWrites, {
      repo: did,
      writes: chunk,
    })
  }
}

async function whenFollowsIndexed(
  appviewClient: Client,
  actor: string,
  fn: (res: app.bsky.graph.getFollows.$OutputBody) => boolean,
) {
  await until(
    5, // 5 tries
    1e3, // 1s delay between tries
    fn,
    () =>
      appviewClient.call(app.bsky.graph.getFollows, {
        actor: actor as AtIdentifierString,
        limit: 1,
      }),
  )
}
