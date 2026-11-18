export function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function getGrowthStart(now = new Date(), months = 6) {
  return new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
}

export function getNewClientGrowthEvents(events, month) {
  return events.filter(event => {
    const date = new Date(event.occurred_at)
    return event.change === 1 && !Number.isNaN(date.getTime()) && getMonthKey(date) === month
  })
}

export function calculateClientGrowth(events, now = new Date(), months = 6) {
  const start = getGrowthStart(now, months)
  const result = Array.from({ length: months }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1)
    return {
      month: getMonthKey(date),
      label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      clients: 0
    }
  })
  const byMonth = new Map(result.map(row => [row.month, row]))

  for (const event of events) {
    const date = new Date(event.occurred_at)
    if (Number.isNaN(date.getTime())) continue
    const row = byMonth.get(getMonthKey(date))
    if (row) row.clients += event.change
  }
  return result
}
