import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateWebsiteFinancials } from './websiteFinancials.js'

test('uses paid claims and both patient and general expenses without counting EOBs', () => {
  const claims = [
    { status: 'paid', record_type: 'claim', paid_amount: '100.12', date_of_service: '2026-11-02' },
    { status: 'paid', record_type: 'claim', paid_amount: '20.23', date_of_service: null },
    { status: 'paid', record_type: 'claim', paid_amount: null, date_of_service: null },
    { status: 'paid', record_type: 'eob', paid_amount: '100.12', date_of_service: '2026-11-02' },
    { status: 'pending', record_type: 'claim', paid_amount: '200', date_of_service: '2026-11-02' }
  ]
  const expenses = [
    { lead_id: 'patient', amount: '10.05' },
    { lead_id: null, amount: '5.10' }
  ]
  assert.deepEqual(calculateWebsiteFinancials(claims, expenses, '2026-11'), {
    totalRevenue: 120.35,
    totalExpenses: 15.15,
    patientExpenses: 10.05,
    generalExpenses: 5.1,
    net: 105.2,
    paidCount: 3,
    missingAmountCount: 1,
    undatedCount: 1,
    datedCount: 1,
    monthlyRevenue: 100.12,
    averageStartMonth: '2026-11',
    averageMonthCount: 1,
    averageMonthlyRevenue: 120.35,
    futureServiceCount: 0
  })
})

test('assigns monthly revenue by service date, not payment date', () => {
  const claims = [
    { status: 'paid', record_type: 'claim', paid_amount: '40', paid_date: '2026-10-31', date_of_service: '2026-11-01' },
    { status: 'paid', record_type: 'claim', paid_amount: '25', paid_date: '2026-11-02', date_of_service: null }
  ]
  const result = calculateWebsiteFinancials(claims, [], '2026-11')
  assert.equal(result.totalRevenue, 65)
  assert.equal(result.monthlyRevenue, 40)
  assert.equal(result.undatedCount, 1)
})

test('averages total revenue across every month since the earliest paid service', () => {
  const claims = [
    { status: 'paid', record_type: 'claim', paid_amount: null, date_of_service: '2025-11-30' },
    { status: 'paid', record_type: 'claim', paid_amount: '40', date_of_service: '2026-01-02' },
    { status: 'paid', record_type: 'claim', paid_amount: '20', date_of_service: null },
    { status: 'paid', record_type: 'claim', paid_amount: '20', date_of_service: '2026-03-01' },
    { status: 'pending', record_type: 'claim', paid_amount: '100', date_of_service: '2024-01-01' }
  ]
  const result = calculateWebsiteFinancials(claims, [], '2026-02')
  assert.equal(result.totalRevenue, 80)
  assert.equal(result.averageStartMonth, '2025-11')
  assert.equal(result.averageMonthCount, 4)
  assert.equal(result.averageMonthlyRevenue, 20)
  assert.equal(result.undatedCount, 1)
  assert.equal(result.futureServiceCount, 1)
})

test('does not invent an average when all paid services are undated or in future months', () => {
  const claims = [
    { status: 'paid', record_type: 'claim', paid_amount: '50', date_of_service: null },
    { status: 'paid', record_type: 'claim', paid_amount: '25', date_of_service: '2027-01-01' }
  ]
  const result = calculateWebsiteFinancials(claims, [], '2026-11')
  assert.equal(result.totalRevenue, 75)
  assert.equal(result.averageStartMonth, null)
  assert.equal(result.averageMonthCount, 0)
  assert.equal(result.averageMonthlyRevenue, null)
})
