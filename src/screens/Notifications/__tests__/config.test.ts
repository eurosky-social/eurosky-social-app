import {afterEach, describe, expect, it, jest} from '@jest/globals'

const originalFlag = process.env.EXPO_PUBLIC_ENABLE_NOTIFICATIONS_V2

afterEach(() => {
  if (originalFlag === undefined) {
    delete process.env.EXPO_PUBLIC_ENABLE_NOTIFICATIONS_V2
  } else {
    process.env.EXPO_PUBLIC_ENABLE_NOTIFICATIONS_V2 = originalFlag
  }
})

describe('notifications build flag', () => {
  it.each([undefined, '', 'false', '1', 'TRUE', 'true'])(
    'only enables the redesign for an explicit true (value: %s)',
    value => {
      if (value === undefined) {
        delete process.env.EXPO_PUBLIC_ENABLE_NOTIFICATIONS_V2
      } else {
        process.env.EXPO_PUBLIC_ENABLE_NOTIFICATIONS_V2 = value
      }

      jest.isolateModules(() => {
        const {
          NOTIFICATIONS_V2_ENABLED,
        } = require('#/screens/Notifications/config')
        expect(NOTIFICATIONS_V2_ENABLED).toBe(value === 'true')
      })
    },
  )
})
