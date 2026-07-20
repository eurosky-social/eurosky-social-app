import {
  type $Typed,
  type AppBskyFeedLike,
  type AppBskyGraphFollow,
  type AppBskyGraphGetFollows,
  type AtpAgent,
  type ComAtprotoRepoApplyWrites,
  type ComAtprotoRepoStrongRef,
} from '@atproto/api'
import {TID} from '@atproto/common-web'
import chunk from 'lodash.chunk'

import {until} from '#/lib/async/until'

export async function bulkWriteFollows(
  agent: AtpAgent,
  dids: string[],
  via?: ComAtprotoRepoStrongRef.Main,
) {
  const session = agent.session

  if (!session) {
    throw new Error(`bulkWriteFollows failed: no session`)
  }

  const followRecords: $Typed<AppBskyGraphFollow.Record>[] = dids.map(did => {
    return {
      $type: 'app.bsky.graph.follow',
      subject: did,
      createdAt: new Date().toISOString(),
      via,
    }
  })

  const followWrites: $Typed<ComAtprotoRepoApplyWrites.Create>[] =
    followRecords.map(r => ({
      $type: 'com.atproto.repo.applyWrites#create',
      collection: 'app.bsky.graph.follow',
      rkey: TID.nextStr(),
      value: r,
    }))

  const chunks = chunk(followWrites, 50)
  for (const chunk of chunks) {
    await agent.com.atproto.repo.applyWrites({
      repo: session.did,
      writes: chunk,
    })
  }
  await whenFollowsIndexed(agent, session.did, res => !!res.data.follows.length)

  const followUris = new Map<string, string>()
  for (const r of followWrites) {
    followUris.set(
      r.value.subject as string,
      `at://${session.did}/app.bsky.graph.follow/${r.rkey}`,
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
  agent: AtpAgent,
  subjects: ComAtprotoRepoStrongRef.Main[],
) {
  const session = agent.session

  if (!session) {
    throw new Error(`bulkWriteLikes failed: no session`)
  }

  if (subjects.length === 0) return

  const likeWrites: $Typed<ComAtprotoRepoApplyWrites.Create>[] = subjects.map(
    subject => ({
      $type: 'com.atproto.repo.applyWrites#create',
      collection: 'app.bsky.feed.like',
      rkey: TID.nextStr(),
      value: {
        $type: 'app.bsky.feed.like',
        subject,
        createdAt: new Date().toISOString(),
      } satisfies $Typed<AppBskyFeedLike.Record>,
    }),
  )

  const chunks = chunk(likeWrites, 50)
  for (const chunk of chunks) {
    await agent.com.atproto.repo.applyWrites({
      repo: session.did,
      writes: chunk,
    })
  }
}

async function whenFollowsIndexed(
  agent: AtpAgent,
  actor: string,
  fn: (res: AppBskyGraphGetFollows.Response) => boolean,
) {
  await until(
    5, // 5 tries
    1e3, // 1s delay between tries
    fn,
    () =>
      agent.app.bsky.graph.getFollows({
        actor,
        limit: 1,
      }),
  )
}
