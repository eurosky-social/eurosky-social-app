import {render} from '@testing-library/react-native'

import {ThreadItemPublisher} from '../components/ThreadItemPublisher'

jest.mock('#/components/moderation/PostHider', () => ({
  PostHider: (props: object) => {
    const {View} = require('react-native') as typeof import('react-native')
    return <View testID="ancestorModeration" {...props} />
  },
}))
jest.mock('../components/ThreadItemAnchor', () => ({
  ThreadItemAnchor: (props: object) => {
    const {View} = require('react-native') as typeof import('react-native')
    return <View testID="ancestorArticle" {...props} />
  },
}))
it('keeps the original ancestor list moderation boundary around its article view', () => {
  const modui = {blurs: [], filters: ['muted']}
  const ui = jest.fn(() => modui)
  const item = {
    uri: 'at://did:plc:publisher/app.bsky.feed.post/one',
    depth: -1,
    value: {
      post: {author: {did: 'did:plc:publisher', handle: 'publisher.test'}},
    },
    moderation: {ui},
  } as unknown as React.ComponentProps<typeof ThreadItemPublisher>['item']
  const screen = render(<ThreadItemPublisher item={item} />)
  expect(ui).toHaveBeenCalledWith('contentList')
  expect(screen.getByTestId('ancestorModeration').props).toMatchObject({
    modui,
    interpretFilterAsBlur: true,
    disabled: false,
  })
  expect(screen.getByTestId('ancestorArticle').props.item).toBe(item)
})
