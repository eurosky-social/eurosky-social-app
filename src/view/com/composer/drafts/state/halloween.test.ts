import {type LinkResolvers} from '#/lib/api/resolve'
import {
  composerReducer,
  createComposerState,
} from '#/view/com/composer/state/composer'
import {app} from '#/lexicons'
import {composerStateToDraft, draftToComposerPosts} from './api'

jest.mock('#/lib/api/resolve', () => ({resolveLink: jest.fn()}))
jest.mock('#/lib/deviceName', () => ({getDeviceName: () => 'Test device'}))
jest.mock('#/lib/media/manip', () => ({getImageDim: jest.fn()}))
jest.mock('#/lib/media/video/util', () => ({mimeToExt: jest.fn()}))
jest.mock('#/analytics/identifiers', () => ({getDeviceId: () => 'test-device'}))
jest.mock('#/state/gallery', () => ({createInitialImages: jest.fn()}))
jest.mock('#/state/queries/threadgate/util', () => ({
  threadgateAllowUISettingToAllowRecordValue: () => [],
}))
jest.mock('#/state/queries/threadgate', () => ({
  threadgateRecordToAllowUISetting: () => [],
}))
jest.mock('#/state/queries/postgate/util', () => ({
  createPostgateRecord: () => ({}),
}))
jest.mock('./logger', () => ({logger: {debug: jest.fn()}}))
jest.mock('./storage', () => ({}))

it('preserves the costume number through server-draft serialization, schema processing, and restoration', async () => {
  let state = createComposerState({
    halloweenCostumeNumber: 3,
    initText: 'Trick or treat',
    initExternalUri: undefined,
    initEditPost: undefined,
    initMention: undefined,
    initImageUris: undefined,
    initQuoteUri: undefined,
    initInteractionSettings: undefined,
  })
  state = composerReducer(state, {type: 'add_post'})
  const {draft} = await composerStateToDraft({} as LinkResolvers, state)
  const parsed = app.bsky.draft.defs.draft.parse(draft)
  const {posts} = await draftToComposerPosts(parsed, new Map())
  expect(posts[0].halloweenCostumeNumber).toBe(3)
  expect(posts[1].halloweenCostumeNumber).toBeUndefined()
})
