import {describe, expect, it} from '@jest/globals'

import {canShowFeedMoments} from '../feed'

const video = {
  $type: 'app.bsky.embed.video#view',
  cid: 'bafy',
  playlist: 'https://video.example/playlist.m3u8',
}

function moderation(blurred: string[] = []) {
  return {
    ui: (context: string) => ({blur: blurred.includes(context)}),
  } as never
}

describe('canShowFeedMoments', () => {
  it('shows moments for a video post with replies', () => {
    expect(
      canShowFeedMoments({embed: video as never, replyCount: 3}, moderation()),
    ).toBe(true)
  })

  it.each([
    ['no replies', {embed: video, replyCount: 0}],
    ['no reply count', {embed: video}],
    ['a GIF', {embed: {...video, presentation: 'gif'}, replyCount: 3}],
    ['no video', {embed: {$type: 'app.bsky.embed.images#view'}, replyCount: 3}],
    ['no embed', {replyCount: 3}],
  ])('shows none for %s', (_name, post) => {
    expect(canShowFeedMoments(post as never, moderation())).toBe(false)
  })

  it.each(['contentList', 'contentMedia'])(
    'shows none while %s is hidden behind a warning',
    context => {
      expect(
        canShowFeedMoments(
          {embed: video as never, replyCount: 3},
          moderation([context]),
        ),
      ).toBe(false)
    },
  )
})
