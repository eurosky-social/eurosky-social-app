/**
 * Account anniversaries use UTC so every viewer sees the same cake day.
 * February 29 anniversaries fall on February 28 in non-leap years.
 */
export function isCakeDay(
  createdAt: string | undefined,
  now: number = Date.now(),
): boolean {
  if (!createdAt) return false

  const created = new Date(createdAt)
  const today = new Date(now)
  const createdYear = created.getUTCFullYear()
  const year = today.getUTCFullYear()

  // AppView sometimes returns year 1 as a placeholder for an unknown date.
  if (
    !Number.isFinite(created.getTime()) ||
    createdYear <= 1 ||
    year <= createdYear
  ) {
    return false
  }

  const month = created.getUTCMonth()
  const day = created.getUTCDate()
  const anniversaryDay =
    month === 1 &&
    day === 29 &&
    new Date(Date.UTC(year, 1, 29)).getUTCMonth() !== 1
      ? 28
      : day

  return today.getUTCMonth() === month && today.getUTCDate() === anniversaryDay
}
