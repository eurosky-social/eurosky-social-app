import {
  type LayoutConfig,
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
it('hides the news sidebar globally, but widens only Publisher', () => {
  const config = getProduct('news').layout
  expect(resolvePageLayout(config, 'Publisher')).toEqual({
    contentWidth: 'wide',
    rightSidebar: 'hidden',
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
