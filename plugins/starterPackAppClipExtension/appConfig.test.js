const {IOSConfig} = require('expo/config-plugins')

const createAppConfig = require('../../app.config')

const originalBuildEnvironment = process.env.EXPO_PUBLIC_ENV

afterEach(() => {
  if (originalBuildEnvironment === undefined) {
    delete process.env.EXPO_PUBLIC_ENV
  } else {
    process.env.EXPO_PUBLIC_ENV = originalBuildEnvironment
  }
})

it.each([
  ['local development', undefined],
  ['development', 'development'],
  ['end-to-end testing', 'e2e'],
  ['TestFlight', 'testflight'],
  ['production', 'production'],
])(
  'is iPhone-only and sets parent device families for %s',
  (_name, environment) => {
    if (environment === undefined) {
      delete process.env.EXPO_PUBLIC_ENV
    } else {
      process.env.EXPO_PUBLIC_ENV = environment
    }

    const config = createAppConfig({name: 'Bluesky', slug: 'bluesky'}).expo

    expect(config.ios.supportsTablet).toBe(false)
    expect(
      IOSConfig.DeviceFamily.formatDeviceFamilies(
        IOSConfig.DeviceFamily.getDeviceFamilies(config),
      ),
    ).toBe('"1"')
    expect(config.ios.infoPlist.UISupportedInterfaceOrientations).toEqual([
      'UIInterfaceOrientationPortrait',
    ])
    expect(config.ios.infoPlist).not.toHaveProperty(
      'UISupportedInterfaceOrientations~ipad',
    )
  },
)
