import {
  type LayoutConfig,
  leftNavWidth,
  pageGeometry,
  resolvePageLayout,
  validateLayout,
} from './layout'
import {getProduct} from './product'

it.each(['social', 'news'])('validates %s layout', id => {
  expect(() => validateLayout(getProduct(id).layout)).not.toThrow()
})
it('keeps ordinary social pages standard with their contextual sidebar', () => {
  expect(resolvePageLayout(getProduct('social').layout, 'Profile')).toEqual({
    contentWidth: 'standard',
    rightSidebar: 'auto',
  })
})
it('hides the news sidebar globally and widens reader pages and whole conversations', () => {
  const config = getProduct('news').layout
  expect(resolvePageLayout(config, 'Publisher')).toEqual({
    contentWidth: 'wide',
    rightSidebar: 'hidden',
  })
  expect(resolvePageLayout(config, 'PostThread')).toEqual({
    contentWidth: 'wide',
    rightSidebar: 'hidden',
  })
  expect(resolvePageLayout(getProduct('social').layout, 'PostThread')).toEqual({
    contentWidth: 'standard',
    rightSidebar: 'auto',
  })
  expect(resolvePageLayout(config, 'Profile')).toEqual({
    contentWidth: 'standard',
    rightSidebar: 'hidden',
  })
})
it('overrides either setting per page, including replacement rails', () => {
  const config: LayoutConfig = {
    defaults: {rightSidebar: 'hidden'},
    pages: {
      Publisher: {contentWidth: 'wide', rightSidebar: 'publication'},
      Profile: {rightSidebar: 'default'},
    },
  }
  expect(resolvePageLayout(config, 'Publisher')).toEqual({
    contentWidth: 'wide',
    rightSidebar: 'publication',
  })
  expect(resolvePageLayout(config, 'Profile')).toEqual({
    contentWidth: 'standard',
    rightSidebar: 'default',
  })
  expect(resolvePageLayout(config, 'Settings').rightSidebar).toBe('hidden')
})
it('preserves v1 versus v2 and conversation geometry', () => {
  const config = getProduct('social').layout
  expect(resolvePageLayout(config, 'Frontpage').contentWidth).toBe('standard')
  expect(resolvePageLayout(config, 'Frontpage', undefined, true)).toEqual({
    contentWidth: 'wide',
    rightSidebar: 'hidden',
  })
  expect(
    resolvePageLayout(config, 'Frontpage', {view: 'conversation'}, true),
  ).toEqual({contentWidth: 'standard', rightSidebar: 'auto'})
  expect(
    resolvePageLayout(config, 'NewsExplore', undefined, true).rightSidebar,
  ).toBe('hidden')
  expect(resolvePageLayout(config, 'MessagesConversation').rightSidebar).toBe(
    'hidden',
  )
})
it.each([
  undefined,
  {},
  {defaults: {}, pages: []},
  {defaults: [], pages: {}},
  {defaults: {rightSidebar: false}, pages: {}},
  {defaults: {}, pages: {Profile: {contentWidth: 'huge'}}},
  {defaults: {width: 'wide'}, pages: {}},
])('rejects malformed layout %j', value => {
  expect(() => validateLayout(value)).toThrow()
})
it('does not infer wide mode from a hidden sidebar', () => {
  expect(
    pageGeometry({
      windowWidth: 1920,
      contentWidth: 'standard',
      rightNavVisible: false,
      centerColumnOffset: false,
    }),
  ).toEqual({width: 600, offset: 0, wide: false})
})
it('reserves a visible sidebar separately from wide content', () => {
  const base = {
    windowWidth: 1920,
    contentWidth: 'wide' as const,
    centerColumnOffset: false,
  }
  expect(pageGeometry({...base, rightNavVisible: false}).width).toBe(1220)
  expect(pageGeometry({...base, rightNavVisible: true}).width).toBe(870)
})
it.each([360, 800, 1099])(
  'stacks below the wide breakpoint at %s',
  windowWidth => {
    expect(
      pageGeometry({
        windowWidth,
        contentWidth: 'wide',
        rightNavVisible: false,
        centerColumnOffset: false,
      }).wide,
    ).toBe(false)
  },
)
it('preserves tablet offsets and caps overly large spreads', () => {
  expect(
    pageGeometry({
      windowWidth: 1200,
      contentWidth: 'wide',
      rightNavVisible: false,
      centerColumnOffset: true,
    }).width,
  ).toBe(965)
  expect(
    pageGeometry({
      windowWidth: 4000,
      contentWidth: 'wide',
      rightNavVisible: false,
      centerColumnOffset: false,
    }).width,
  ).toBe(1500)
})

describe('pinned left navigation', () => {
  it('is configured for news only', () => {
    expect(getProduct('news').layout.leftNav).toBe('pinned')
    expect(getProduct('social').layout.leftNav).toBeUndefined()
  })

  it('accepts only known left-nav modes', () => {
    const base = {defaults: {}, pages: {}}
    expect(() => validateLayout({...base, leftNav: 'pinned'})).not.toThrow()
    expect(() => validateLayout({...base, leftNav: 'centred'})).not.toThrow()
    expect(() => validateLayout({...base, leftNav: 'floating'})).toThrow(
      'Invalid layout setting leftNav',
    )
  })

  it.each([
    [390, 0],
    [799, 0],
    [800, 80],
    [1300, 80],
    [1301, 240],
    [1920, 240],
  ])('gives a %ipx window a %ipx nav', (windowWidth, width) => {
    expect(leftNavWidth(windowWidth)).toBe(width)
  })

  const pinned = (windowWidth: number, contentWidth: 'wide' | 'standard') =>
    pageGeometry({
      windowWidth,
      contentWidth,
      rightNavVisible: false,
      centerColumnOffset: false,
      navWidth: leftNavWidth(windowWidth),
    })

  it('gives signed-out readers no rail, since they get the bottom bar', () => {
    expect(leftNavWidth(1100, {signedIn: false})).toBe(0)
    expect(leftNavWidth(1300, {signedIn: false})).toBe(0)
    expect(leftNavWidth(1440, {signedIn: false})).toBe(240)
  })

  it('centres wide content in the space right of the nav', () => {
    expect(pinned(1440, 'wide')).toEqual({width: 1200, offset: 120, wide: true})
    expect(pinned(1000, 'wide')).toEqual({width: 920, offset: 40, wide: true})
  })

  it('caps wide content at 1440px', () => {
    expect(pinned(2560, 'wide')).toEqual({width: 1440, offset: 120, wide: true})
  })

  it('keeps standard pages at 600px, centred beside the nav', () => {
    expect(pinned(1440, 'standard')).toEqual({
      width: 600,
      offset: 120,
      wide: false,
    })
  })

  it('uses the whole window when there is no side nav', () => {
    expect(pinned(768, 'wide')).toEqual({width: 768, offset: 0, wide: true})
    expect(pinned(390, 'wide')).toEqual({width: 390, offset: 0, wide: false})
  })
})
