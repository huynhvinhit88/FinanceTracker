/**
 * Shared loan calculation utility.
 * Used by LoanCalculatorSheet (UI) and Settings (export).
 *
 * @param {Object} profile - loan profile object from localStorage
 * @returns {{ result: Object, schedule: Array }} result summary and monthly schedule
 */
export function calculateLoanSchedule(profile) {
  const {
    principal,
    termMonths,
    promoRate,
    promoMonths,
    baseRate,
    marginRate,
    extraPayment,
    offsetThreshold,
    penaltyConfig = '3, 3, 3, 1, 0',
    startDate,
    firstPaymentDate,
    periods = [],
  } = profile;

  const p = Number(principal);
  const n = parseInt(termMonths);
  if (!p || !n) return { result: null, schedule: [] };

  const promoR = parseFloat(String(promoRate).replace(',', '.')) || 0;
  const promoM = parseInt(promoMonths) || 0;
  const fBase = parseFloat(String(baseRate).replace(',', '.')) || (promoR > 0 ? promoR : 0);
  const fMargin = parseFloat(String(marginRate).replace(',', '.')) || 0;
  const extraP = Number(extraPayment) || 0;
  const threshold = Number(offsetThreshold) || 0;

  // --- MÔ PHỎNG GỐC ---
  const firstPayDate = new Date(firstPaymentDate || new Date());
  const disbDate = new Date(startDate || new Date());
  const firstPeriodDays = Math.round((firstPayDate - disbDate) / (1000 * 60 * 60 * 24));

  let baseRemaining = p;
  const baseBasePrincipal = p / n;
  let baseTotalInterest = 0;
  let initialMonthlyPayment = 0;

  for (let m = 1; m <= n; m++) {
    const r = m <= promoM ? promoR : fBase + fMargin;
    let days;
    if (m === 1) {
      days = firstPeriodDays;
    } else {
      const prev = new Date(firstPayDate); prev.setMonth(prev.getMonth() + (m - 2));
      const cur = new Date(firstPayDate); cur.setMonth(cur.getMonth() + (m - 1));
      days = Math.round((cur - prev) / (1000 * 60 * 60 * 24));
    }
    const interest = baseRemaining * (r / 100) * (days / 365);
    baseTotalInterest += interest;
    if (m === 1) initialMonthlyPayment = baseBasePrincipal + interest;
    baseRemaining -= baseBasePrincipal;
  }

  // --- PENALTY LOOKUP ---
  const getPenaltyRate = (month) => {
    const year = Math.ceil(month / 12);
    const rates = penaltyConfig.split(',').map(s => parseFloat(s.trim()));
    if (!rates.length) return 0;
    const rate = year <= rates.length ? rates[year - 1] : rates[rates.length - 1];
    return isNaN(rate) ? 0 : rate;
  };

  // --- PERIOD PARAMS ---
  const getPeriodParams = (month) => {
    if (periods && periods.length > 0) {
      const period = periods.find(pd => month >= Number(pd.fromMonth) && month <= Number(pd.toMonth));
      if (period) return { rate: parseFloat(String(period.rate).replace(',', '.')) || 0, budget: parseFloat(period.budget) || 0 };
    }
    return { rate: month <= promoM ? promoR : fBase + fMargin, budget: extraP };
  };

  // --- MÔ PHỎNG THỰC TẾ ---
  let remaining = p;
  const basePrincipal = p / n;
  let totalInterest = 0;
  let totalPenalty = 0;
  let accumulatedExtra = 0;
  let freePrincipalMonths = 0;
  let actualMonths = 0;
  const schedule = [];

  for (let m = 1; m <= n; m++) {
    if (remaining <= 100) break;
    actualMonths = m;

    const { rate: r, budget: currentMonthBudget } = getPeriodParams(m);

    let currentPayDate;
    if (m === 1) {
      currentPayDate = new Date(firstPayDate);
    } else {
      currentPayDate = new Date(firstPayDate);
      currentPayDate.setMonth(currentPayDate.getMonth() + (m - 1));
    }

    let daysPeriod;
    if (m === 1) {
      daysPeriod = firstPeriodDays;
    } else {
      const prevPayDate = new Date(firstPayDate);
      prevPayDate.setMonth(prevPayDate.getMonth() + (m - 2));
      daysPeriod = Math.round((currentPayDate - prevPayDate) / (1000 * 60 * 60 * 24));
    }

    const interestThisMonth = remaining * (r / 100) * (daysPeriod / 365);
    let principalThisMonth = 0;

    if (freePrincipalMonths > 0) {
      freePrincipalMonths -= 1;
    } else {
      principalThisMonth = Math.min(basePrincipal, remaining);
    }

    totalInterest += interestThisMonth;
    remaining -= principalThisMonth;

    const currentBankPayment = principalThisMonth + interestThisMonth;
    if (currentMonthBudget > 0) {
      accumulatedExtra += Math.max(0, currentMonthBudget - currentBankPayment);
    }

    let prepayEvent = 0;
    let penaltyPaid = 0;

    if (threshold > 0 && remaining > 0) {
      const pRate = getPenaltyRate(m);
      const targetPrepay = Math.min(threshold, remaining);
      const penaltyForTarget = targetPrepay * (pRate / 100);
      
      // Chỉ tất toán nếu tiền tích luỹ đủ để trả (Số tiền ngưỡng + Phí phạt của nó)
      if (accumulatedExtra >= (targetPrepay + penaltyForTarget)) {
        prepayEvent = targetPrepay;
        penaltyPaid = penaltyForTarget;
        
        totalPenalty += penaltyPaid;
        remaining -= prepayEvent;
        accumulatedExtra -= (prepayEvent + penaltyPaid);
        
        // Cập nhật số tháng không cần trả gốc (giảm áp lực dòng tiền)
        freePrincipalMonths += prepayEvent / basePrincipal;
      }
    }

    schedule.push({
      month: m,
      date: currentPayDate.toLocaleDateString('vi-VN'),
      dateObj: new Date(currentPayDate),
      interest: Math.round(interestThisMonth),
      principal: Math.round(principalThisMonth),
      prepay: Math.round(prepayEvent),
      penalty: Math.round(penaltyPaid),
      total: Math.round(currentBankPayment + prepayEvent + penaltyPaid),
      accumulated: Math.round(accumulatedExtra),
      remaining: Math.max(0, Math.round(remaining)),
    });
  }

  // Ngày tất toán
  const payoffDate = new Date(firstPayDate);
  payoffDate.setMonth(payoffDate.getMonth() + actualMonths - 1);

  const result = {
    initialMonthlyPayment: Math.round(initialMonthlyPayment),
    baseTotalInterest: Math.round(baseTotalInterest),
    actualTotalInterest: Math.round(totalInterest),
    totalPenalty: Math.round(totalPenalty),
    actualMonths,
    monthsSaved: n - actualMonths,
    interestSaved: Math.round(baseTotalInterest - (totalInterest + totalPenalty)),
    payoffDateStr: payoffDate.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }),
    totalYears: Math.floor(actualMonths / 12),
    totalRemMonths: actualMonths % 12,
  };

  return { result, schedule };
}
