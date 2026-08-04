export type PeriodQuery = {
  from: string
  to: string
  isValid: boolean
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isCalendarDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

export function normalizePeriodQuery(from: unknown, to: unknown): PeriodQuery {
  const normalizedFrom = typeof from === 'string' ? from.trim() : ''
  const normalizedTo = typeof to === 'string' ? to.trim() : ''
  const hasInvalidDate = (normalizedFrom && !isCalendarDate(normalizedFrom)) || (normalizedTo && !isCalendarDate(normalizedTo))

  if (hasInvalidDate || (normalizedFrom && normalizedTo && normalizedFrom > normalizedTo)) {
    return { from: '', to: '', isValid: false }
  }

  return { from: normalizedFrom, to: normalizedTo, isValid: true }
}
