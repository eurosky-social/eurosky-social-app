import {getHalloweenDate, getNextDateCheckDelay, resolveHalloween} from './date'

const year = 2026

describe('Halloween calendar window', () => {
  it.each([
    [new Date(year, 8, 28), false],
    [new Date(year, 9, 27, 23, 59, 59, 999), false],
    [new Date(year, 9, 28), true],
    [new Date(year, 9, 29, 12), true],
    [new Date(year, 9, 30, 23, 59, 59, 999), true],
    [new Date(year, 9, 31), true],
    [new Date(year, 9, 31, 23, 59, 59, 999), true],
    [new Date(year, 10, 1), false],
    [new Date(year, 10, 28), false],
    [new Date(year + 1, 9, 28), true],
    [new Date(year + 1, 9, 31), true],
  ])('uses the local date %s', (date, expected) => {
    expect(getHalloweenDate(date)).toEqual({
      year: date.getFullYear(),
      isHalloween: expected,
    })
  })

  it('does not use UTC calendar fields', () => {
    const localDate = new Date(year, 9, 31)
    jest.spyOn(localDate, 'getUTCMonth').mockReturnValue(10)
    jest.spyOn(localDate, 'getUTCDate').mockReturnValue(1)
    expect(getHalloweenDate(localDate).isHalloween).toBe(true)
  })

  it('includes local October 28 even when the UTC date is still October 27', () => {
    const localDate = new Date(year, 9, 28)
    jest.spyOn(localDate, 'getUTCMonth').mockReturnValue(9)
    jest.spyOn(localDate, 'getUTCDate').mockReturnValue(27)
    expect(getHalloweenDate(localDate).isHalloween).toBe(true)
  })

  it('checks at midnight rather than up to a minute late', () => {
    expect(getNextDateCheckDelay(new Date(year, 9, 27, 23, 59, 59, 750))).toBe(
      250,
    )
    expect(getNextDateCheckDelay(new Date(year, 9, 31, 12))).toBe(60_000)
  })
})

describe('Halloween consent', () => {
  const halloween = {year, isHalloween: true}

  it('is off until explicitly enabled', () => {
    expect(resolveHalloween({enabled: false}, halloween)).toMatchObject({
      enabled: false,
      isActive: false,
      shouldPrompt: true,
    })
  })

  it('never activates or invites outside October 28-31', () => {
    for (const enabled of [true, false]) {
      expect(
        resolveHalloween({enabled}, {year, isHalloween: false}),
      ).toMatchObject({
        isActive: false,
        shouldPrompt: false,
      })
    }
  })

  it('does not ask again after dismissal in the current year', () => {
    expect(
      resolveHalloween({enabled: false, promptedYear: year}, halloween)
        .shouldPrompt,
    ).toBe(false)
    expect(
      resolveHalloween({enabled: false, promptedYear: year - 1}, halloween)
        .shouldPrompt,
    ).toBe(true)
  })

  it('remembers opt-in for future Halloweens without another invitation', () => {
    expect(
      resolveHalloween({enabled: true, promptedYear: year - 1}, halloween),
    ).toMatchObject({
      isActive: true,
      shouldPrompt: false,
    })
  })
})
