import {isCakeDay} from './cake-day'

function on(date: string) {
  return Date.parse(date)
}

describe('isCakeDay', () => {
  const createdAt = '2023-06-15T18:30:00.000Z'

  it('celebrates the first and subsequent anniversaries for the full UTC day', () => {
    expect(isCakeDay(createdAt, on('2024-06-15T00:00:00Z'))).toBe(true)
    expect(isCakeDay(createdAt, on('2026-06-15T23:59:59Z'))).toBe(true)
  })

  it('does not celebrate the day before or after', () => {
    expect(isCakeDay(createdAt, on('2026-06-14T23:59:59Z'))).toBe(false)
    expect(isCakeDay(createdAt, on('2026-06-16T00:00:00Z'))).toBe(false)
  })

  it('does not celebrate the original creation day or future accounts', () => {
    expect(isCakeDay(createdAt, on('2023-06-15T23:59:59Z'))).toBe(false)
    expect(isCakeDay(createdAt, on('2022-06-15T12:00:00Z'))).toBe(false)
  })

  it.each([undefined, '', 'not-a-date', '0001-01-01T00:00:00.000Z'])(
    'ignores missing, invalid, or placeholder creation dates: %s',
    value => {
      expect(isCakeDay(value, on('2026-01-01T12:00:00Z'))).toBe(false)
    },
  )

  it('uses the UTC date even when the timestamp has a timezone offset', () => {
    const createdWithOffset = '2023-06-15T23:30:00-04:00'
    expect(isCakeDay(createdWithOffset, on('2026-06-15T12:00:00Z'))).toBe(false)
    expect(isCakeDay(createdWithOffset, on('2026-06-16T00:00:00Z'))).toBe(true)
  })

  it('celebrates February 29 accounts on February 28 in non-leap years', () => {
    const leapDay = '2024-02-29T12:00:00Z'
    expect(isCakeDay(leapDay, on('2025-02-28T00:00:00Z'))).toBe(true)
    expect(isCakeDay(leapDay, on('2025-03-01T00:00:00Z'))).toBe(false)
    expect(isCakeDay(leapDay, on('2028-02-28T12:00:00Z'))).toBe(false)
    expect(isCakeDay(leapDay, on('2028-02-29T00:00:00Z'))).toBe(true)
  })

  it('handles century leap-year rules', () => {
    const leapDay = '2000-02-29T12:00:00Z'
    expect(isCakeDay(leapDay, on('2100-02-28T12:00:00Z'))).toBe(true)
    expect(isCakeDay(leapDay, on('2400-02-28T12:00:00Z'))).toBe(false)
    expect(isCakeDay(leapDay, on('2400-02-29T12:00:00Z'))).toBe(true)
  })

  it('handles anniversaries across a year boundary', () => {
    expect(isCakeDay('2023-01-01T23:00:00Z', on('2024-01-01T00:00:00Z'))).toBe(
      true,
    )
    expect(isCakeDay('2023-12-31T00:00:00Z', on('2024-01-01T00:00:00Z'))).toBe(
      false,
    )
  })

  it('does not celebrate when the current time is invalid', () => {
    expect(isCakeDay(createdAt, NaN)).toBe(false)
  })

  it('defaults to the current time', () => {
    jest.useFakeTimers().setSystemTime(on('2026-06-15T12:00:00Z'))
    try {
      expect(isCakeDay(createdAt)).toBe(true)
    } finally {
      jest.useRealTimers()
    }
  })
})
