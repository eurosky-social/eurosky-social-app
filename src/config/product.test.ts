import {getProduct, PRODUCT} from './product'

it('loads the preset selected for this bundle', () => {
  expect(PRODUCT).toEqual(getProduct(process.env.EXPO_PUBLIC_PRODUCT))
})

it('defaults to the unchanged social product', () => {
  expect(getProduct(undefined)).toEqual(getProduct('social'))
  expect(getProduct('social').capabilities).toEqual({
    messaging: true,
    bookmarking: true,
    standalonePosting: true,
    quotePosting: true,
  })
})

it('selects the news posting restrictions explicitly', () => {
  expect(getProduct('news')).toMatchObject({
    id: 'news',
    capabilities: {
      messaging: false,
      bookmarking: true,
      standalonePosting: false,
      quotePosting: false,
    },
  })
})

it.each(['', 'NEWS', 'unknown', 'toString', '__proto__'])(
  'rejects invalid explicit selection %j',
  selection => {
    expect(() => getProduct(selection)).toThrow('Unknown EXPO_PUBLIC_PRODUCT')
  },
)

it('rejects unknown navigation groups', () => {
  const {validateNavigation} =
    jest.requireActual<typeof import('./navigation')>('./navigation')
  const base = getProduct('news').navigation
  expect(() =>
    validateNavigation({...base, groups: {home: 'sideways'}}),
  ).toThrow('Invalid navigation group')
  expect(() => validateNavigation({...base, groups: {nope: 'forYou'}})).toThrow(
    'Invalid navigation group',
  )
})
