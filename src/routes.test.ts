type Routes = typeof import('#/routes')

/** The route table is built at import, from a flag read at import. */
function routerWithNewsV2(enabled: boolean) {
  let router!: Routes['router']
  jest.isolateModules(() => {
    jest.doMock('#/features/newsFeed/config', () => ({
      NEWS_V2_ENABLED: enabled,
    }))
    router = (require('#/routes') as Routes).router
  })
  return router
}

afterEach(() => {
  jest.dontMock('#/features/newsFeed/config')
})

describe('news v2 frontpage routes', () => {
  const router = routerWithNewsV2(true)

  it.each(['/frontpage', '/newsroom', '/outlets', '/newsrooms'])(
    'opens the directory at %s',
    path => {
      expect(router.matchPath(path)).toEqual(['OutletDirectory', {}])
    },
  )

  it('settles the directory on its canonical URL', () => {
    expect(router.matchName('OutletDirectory')?.build({})).toBe('/outlets')
  })

  it.each(['/frontpage/ad.nl', '/newsroom/ad.nl'])(
    'opens a publication at %s',
    path => {
      expect(router.matchPath(path)).toEqual(['Frontpage', {name: 'ad.nl'}])
    },
  )

  it('keeps the old hub addresses ahead of the frontpage alias', () => {
    expect(router.matchPath('/newsroom/explore')[0]).toBe('NewsExplore')
    expect(router.matchPath('/newsroom/article')[0]).toBe('NewsArticle')
  })
})

describe('legacy frontpage routes', () => {
  const router = routerWithNewsV2(false)

  it.each(['/frontpage', '/newsroom'])(
    'opens the default newsroom at %s',
    path => {
      expect(router.matchPath(path)).toEqual(['Frontpage', {}])
    },
  )

  it.each(['/outlets', '/newsrooms'])('keeps %s on the directory', path => {
    expect(router.matchPath(path)).toEqual(['OutletDirectory', {}])
  })

  it('opens a newsroom by name', () => {
    expect(router.matchPath('/newsroom/ad.nl')).toEqual([
      'Frontpage',
      {name: 'ad.nl'},
    ])
  })
})
