import {afterEach, describe, expect, it, jest} from '@jest/globals'

const originalFlag = process.env.EXPO_PUBLIC_ENABLE_MEDIA_TIME

afterEach(() => {
  if (originalFlag === undefined) {
    delete process.env.EXPO_PUBLIC_ENABLE_MEDIA_TIME
  } else {
    process.env.EXPO_PUBLIC_ENABLE_MEDIA_TIME = originalFlag
  }
})

describe('media time build switch', () => {
  it.each([undefined, '', 'false', '1', 'TRUE', 'true'])(
    'is only on for an explicit true (value: %s)',
    value => {
      if (value === undefined) {
        delete process.env.EXPO_PUBLIC_ENABLE_MEDIA_TIME
      } else {
        process.env.EXPO_PUBLIC_ENABLE_MEDIA_TIME = value
      }

      jest.isolateModules(() => {
        const {MEDIA_TIME_ENABLED} = require('#/features/mediaTime/config')
        expect(MEDIA_TIME_ENABLED).toBe(value === 'true')
      })
    },
  )
})
