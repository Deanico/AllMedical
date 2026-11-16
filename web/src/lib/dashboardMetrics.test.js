import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateClientGrowth, getGrowthStart, getMonthKey } from './dashboardMetrics.js'

test('counts qualifications and removals in their own months, including negative net growth', () => {
  const now = new Date(2026, 10, 16)
  const events = [
    { occurred_at: new Date(2026, 9, 3).toISOString(), change: 1 },
    { occurred_at: new Date(2026, 9, 20).toISOString(), change: 1 },
    { occurred_at: new Date(2026, 10, 2).toISOString(), change: -1 },
    { occurred_at: new Date(2026, 10, 5).toISOString(), change: -1 },
    { occurred_at: new Date(2026, 10, 8).toISOString(), change: -1 },
    { occurred_at: new Date(2026, 4, 31).toISOString(), change: 1 }
  ]
  const growth = calculateClientGrowth(events, now)
  assert.deepEqual(growth.map(({ month, clients }) => [month, clients]), [
    ['2026-06', 0], ['2026-07', 0], ['2026-08', 0],
    ['2026-09', 0], ['2026-10', 2], ['2026-11', -3]
  ])
})

test('groups by local month and handles year boundaries', () => {
  const now = new Date(2027, 0, 15)
  const event = { occurred_at: new Date(2026, 11, 31, 23, 30).toISOString(), change: 1 }
  const growth = calculateClientGrowth([event], now)
  assert.equal(getMonthKey(getGrowthStart(now)), '2026-08')
  assert.equal(growth[4].month, '2026-12')
  assert.equal(growth[4].clients, 1)
  assert.equal(growth[5].month, '2027-01')
})
