/**
 * Date Tools — Pure date math for AI tool calls.
 *
 * calculateDateRange: explicit start/end dates → Unix timestamps
 * parseRelativeDate: "last 10 days", "January 2025" → Unix timestamps
 */

export interface DateRangeResult {
  customStartTime: number
  customEndTime: number
  description: string
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const MONTH_ABBREVS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
}

function startOfDayUTC(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function endOfDayUTC(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999)
}

function parseDate(input: string): Date {
  const trimmed = input.trim()
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const date = new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])))
    if (isNaN(date.getTime())) throw new Error(`Invalid date: ${input}`)
    return date
  }
  const naturalMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/)
  if (naturalMatch) {
    const monthIndex = MONTH_ABBREVS[naturalMatch[1]!.toLowerCase()]
    if (monthIndex === undefined) throw new Error(`Unknown month: ${naturalMatch[1]}`)
    const date = new Date(Date.UTC(Number(naturalMatch[3]), monthIndex, Number(naturalMatch[2])))
    if (isNaN(date.getTime())) throw new Error(`Invalid date: ${input}`)
    return date
  }
  throw new Error(`Cannot parse date: "${input}". Use YYYY-MM-DD or "Month Day, Year".`)
}

function formatMonthDay(date: Date): string {
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}`
}

function formatFull(date: Date): string {
  return `${formatMonthDay(date)}, ${date.getUTCFullYear()}`
}

function describeRange(start: Date, end: Date): string {
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCDate() === end.getUTCDate()) return formatFull(start)
    return `${formatMonthDay(start)} - ${formatMonthDay(end)}, ${start.getUTCFullYear()}`
  }
  return `${formatFull(start)} - ${formatFull(end)}`
}

/** Parse explicit date range */
export function calculateDateRange(startDate: string, endDate: string): DateRangeResult {
  const start = parseDate(startDate)
  const end = parseDate(endDate)
  if (startOfDayUTC(start) > startOfDayUTC(end)) throw new Error(`Start date (${startDate}) is after end date (${endDate})`)
  return { customStartTime: startOfDayUTC(start), customEndTime: endOfDayUTC(end), description: describeRange(start, end) }
}

/** Parse relative date expressions: "last 10 days", "January 2025", "yesterday" */
export function parseRelativeDate(expression: string, now?: Date): DateRangeResult {
  const ref = now ?? new Date()
  const lower = expression.trim().toLowerCase()

  if (lower === 'today') return { customStartTime: startOfDayUTC(ref), customEndTime: endOfDayUTC(ref), description: 'Today' }
  if (lower === 'yesterday') {
    const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() - 1))
    return { customStartTime: startOfDayUTC(d), customEndTime: endOfDayUTC(d), description: 'Yesterday' }
  }
  if (lower === 'this week') {
    const day = ref.getUTCDay()
    const daysBack = day === 0 ? 6 : day - 1
    const monday = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() - daysBack))
    return { customStartTime: startOfDayUTC(monday), customEndTime: endOfDayUTC(ref), description: `This week (${formatMonthDay(monday)} - ${formatMonthDay(ref)}, ${ref.getUTCFullYear()})` }
  }
  if (lower === 'this month') {
    const monthStart = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1))
    return { customStartTime: startOfDayUTC(monthStart), customEndTime: endOfDayUTC(ref), description: `${MONTH_NAMES[ref.getUTCMonth()]} ${ref.getUTCFullYear()} (so far)` }
  }
  if (lower === 'this year') {
    const yearStart = new Date(Date.UTC(ref.getUTCFullYear(), 0, 1))
    return { customStartTime: startOfDayUTC(yearStart), customEndTime: endOfDayUTC(ref), description: `${ref.getUTCFullYear()} (so far)` }
  }

  const relativeMatch = lower.match(/^(?:last|past)\s+(\d+)\s+(hour|hours|day|days|week|weeks|month|months)$/)
  if (relativeMatch) {
    const n = Number(relativeMatch[1]!)
    const unit = relativeMatch[2]!.replace(/s$/, '')
    let start: Date
    if (unit === 'hour') start = new Date(ref.getTime() - n * 3600000)
    else if (unit === 'day') start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() - n))
    else if (unit === 'week') start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() - n * 7))
    else start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - n, ref.getUTCDate()))
    const startTime = unit === 'hour' ? start.getTime() : startOfDayUTC(start)
    return { customStartTime: startTime, customEndTime: endOfDayUTC(ref), description: `Last ${n} ${unit}${n > 1 ? 's' : ''} (${formatMonthDay(start)} - ${formatMonthDay(ref)}, ${ref.getUTCFullYear()})` }
  }

  const monthYearMatch = lower.match(/^([a-z]+)\s+(\d{4})$/)
  if (monthYearMatch) {
    const monthIndex = MONTH_ABBREVS[monthYearMatch[1]!]
    const year = Number(monthYearMatch[2]!)
    if (monthIndex !== undefined) {
      const monthStart = new Date(Date.UTC(year, monthIndex, 1))
      const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 0))
      return { customStartTime: startOfDayUTC(monthStart), customEndTime: endOfDayUTC(monthEnd), description: `${MONTH_NAMES[monthIndex]} ${year}` }
    }
  }

  const yearMatch = lower.match(/^(\d{4})$/)
  if (yearMatch) {
    const year = Number(yearMatch[1])
    return { customStartTime: startOfDayUTC(new Date(Date.UTC(year, 0, 1))), customEndTime: endOfDayUTC(new Date(Date.UTC(year, 11, 31))), description: `${year}` }
  }

  throw new Error(`Cannot parse relative date expression: "${expression}"`)
}

/** Format tool result as string for chat service */
export function formatDateRangeForAI(result: DateRangeResult): string {
  return `Date range: ${result.description}\ncustomStartTime: ${result.customStartTime}\ncustomEndTime: ${result.customEndTime}`
}
