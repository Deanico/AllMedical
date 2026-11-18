const cents = value => Math.round(Number(value) * 100)

export function calculateWebsiteFinancials(claims, expenses, month) {
  const paidClaims = claims.filter(claim => claim.status === 'paid' && claim.record_type === 'claim')
  const recordedClaims = paidClaims.filter(claim => claim.paid_amount !== null && claim.paid_amount !== undefined)
  const amount = rows => rows.reduce((total, row) => total + cents(row.paid_amount), 0) / 100
  const totalRevenue = amount(recordedClaims)
  const patientExpenses = expenses.filter(expense => expense.lead_id)
  const generalExpenses = expenses.filter(expense => !expense.lead_id)
  const sumExpenses = rows => rows.reduce((total, row) => total + cents(row.amount), 0) / 100
  const totalExpenses = sumExpenses(expenses)
  const datedClaims = recordedClaims.filter(claim => claim.date_of_service)
  const serviceMonths = paidClaims
    .filter(claim => claim.date_of_service)
    .map(claim => claim.date_of_service.slice(0, 7))
    .filter(serviceMonth => serviceMonth <= month)
    .sort()
  const averageStartMonth = serviceMonths[0] || null
  const averageMonthCount = averageStartMonth
    ? (Number(month.slice(0, 4)) - Number(averageStartMonth.slice(0, 4))) * 12
      + Number(month.slice(5, 7)) - Number(averageStartMonth.slice(5, 7)) + 1
    : 0

  return {
    totalRevenue,
    totalExpenses,
    patientExpenses: sumExpenses(patientExpenses),
    generalExpenses: sumExpenses(generalExpenses),
    net: (Math.round(totalRevenue * 100) - Math.round(totalExpenses * 100)) / 100,
    paidCount: paidClaims.length,
    missingAmountCount: paidClaims.length - recordedClaims.length,
    undatedCount: recordedClaims.length - datedClaims.length,
    datedCount: datedClaims.length,
    monthlyRevenue: amount(datedClaims.filter(claim => claim.date_of_service.slice(0, 7) === month)),
    averageStartMonth,
    averageMonthCount,
    averageMonthlyRevenue: averageMonthCount ? totalRevenue / averageMonthCount : null,
    futureServiceCount: datedClaims.filter(claim => claim.date_of_service.slice(0, 7) > month).length
  }
}
