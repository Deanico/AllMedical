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
    let insurancePayment
    let patientPayment

    if (oopMax > 0 && patientOOPTotal >= oopMax) {
      insurancePayment = allowableAmount
      patientPayment = 0
    } else {
      insurancePayment = allowableAmount * (percentOfAllowable / 100)
      patientPayment = allowableAmount - insurancePayment
    }

    patientOOPTotal += patientPayment

    let monthRevenue = 0
    if (remainingDeductible > 0) {
      if (insurancePayment >= remainingDeductible) {
        monthRevenue = insurancePayment - remainingDeductible
        remainingDeductible = 0
      } else {
        remainingDeductible -= insurancePayment
      }
    } else {
      monthRevenue = insurancePayment
    }

    totalRevenue += monthRevenue
    monthlyBreakdown.push({
      month,
      insurancePayment,
      patientPayment,
      monthRevenue,
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
