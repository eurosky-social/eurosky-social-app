import {getProduct} from '#/config/product'
import {canCreatePost, canOpenComposer} from './publishing'

const social = getProduct('social')
const news = getProduct('news')

it.each([
  {},
  {text: 'A root post'},
  {quote: {uri: 'post'}},
  {replyTo: {uri: 'parent'}},
  {replyTo: {uri: 'parent'}, quote: {uri: 'post'}},
  {editPost: {uri: 'existing'}},
])('preserves social composer mode %j', opts => {
  expect(canOpenComposer(opts, social)).toBe(true)
})

it('blocks root posts, mentions, shares and quotes in news', () => {
  expect(canOpenComposer({}, news)).toBe(false)
  expect(canOpenComposer({quote: {}}, news)).toBe(false)
  expect(canOpenComposer({replyTo: {}, quote: {}}, news)).toBe(false)
})

it('keeps replies and existing-post edits independent', () => {
  expect(canOpenComposer({replyTo: {}}, news)).toBe(true)
  expect(canOpenComposer({editPost: {}}, news)).toBe(true)
})

it('checks the actual draft contents, including quotes added to replies', () => {
  expect(canCreatePost({replyTo: 'parent', hasQuote: false}, news)).toBe(true)
  expect(canCreatePost({replyTo: 'parent', hasQuote: true}, news)).toBe(false)
  expect(canCreatePost({hasQuote: false}, news)).toBe(false)
})

it('supports independent quote and standalone capabilities', () => {
  const noQuotes = {
    ...social,
    capabilities: {...social.capabilities, quotePosting: false},
  }
  expect(canCreatePost({hasQuote: false}, noQuotes)).toBe(true)
  expect(canCreatePost({hasQuote: true}, noQuotes)).toBe(false)
})
