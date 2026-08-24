export const calculateInsuranceProjection = ({
  deductible,
  oopMax,
  percentOfAllowable,
  allowableAmount,
  costOfProduct,
  months = 12
}) => {
  let remainingDeductible = deductible
  let patientOOPTotal = 0
  let totalRevenue = 0
  const monthlyBreakdown = []

  for (let month = 1; month <= months; month++) {
    const deductibleApplied = Math.min(allowableAmount, Math.max(0, remainingDeductible))
    const afterDeductibleAmount = allowableAmount - deductibleApplied
    const oopReached = oopMax > 0 && patientOOPTotal >= oopMax
    const insurancePayment = oopReached
      ? afterDeductibleAmount
      : afterDeductibleAmount * (percentOfAllowable / 100)
    const patientPayment = deductibleApplied + afterDeductibleAmount - insurancePayment

    patientOOPTotal += patientPayment

    remainingDeductible -= deductibleApplied
    const monthRevenue = insurancePayment

    totalRevenue += monthRevenue
    monthlyBreakdown.push({
      month,
      insurancePayment,
      patientPayment,
      monthRevenue,
      deductibleApplied,
      remainingDeductible: Math.max(0, remainingDeductible),
      oopReached: oopMax > 0 && patientOOPTotal >= oopMax
    })
  }

  const grossYearlyProfit = totalRevenue
  const totalCost = costOfProduct * months
  const netYearlyProfit = totalRevenue - totalCost

  return {
    grossYearlyProfit,
    netYearlyProfit,
    totalCost,
    monthlyBreakdown
  }
}
