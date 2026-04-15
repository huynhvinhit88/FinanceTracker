/**
 * Shared loan calculation utility.
 * Used by LoanCalculatorSheet (UI) and Settings (export).
 *
 * @param {Object} profile - loan profile object from localStorage
 * @returns {{ result: Object, schedule: Array }} result summary and monthly schedule
 */
export function calculateLoanSchedule(profile, historicalEvents = [], actualRemainingPrincipal = null) {
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

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let isFutureStarted = false;

  for (let m = 1; m <= n; m++) {
    if (remaining <= 10) break;
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

    // 1. Quét giao dịch thực tế trong tháng này (phải làm TRƯỚC khi xác định isFuture)
    const currentMonthNum = currentPayDate.getMonth();
    const currentYearNum = currentPayDate.getFullYear();
    const eventsThisMonth = historicalEvents.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === currentMonthNum && d.getFullYear() === currentYearNum;
    });
    const actualPrincipalPaid = eventsThisMonth.reduce((sum, e) => sum + (e.loan_principal_amount || 0), 0);
    const hasPayoffEvent = eventsThisMonth.some(e => e.loan_payment_type === 'payoff');

    // Một kỳ được coi là TƯƠNG LAI chỉ khi:
    // - Ngày thanh toán dự kiến chưa đến (>= đầu tháng hiện tại), VÀ
    // - Chưa có giao dịch thực tế nào được ghi nhận trong tháng đó
    // Nếu đã có giao dịch thực tế (kể cả tháng hiện tại), xử lý như lịch sử thực tế
    const isFuture = eventsThisMonth.length === 0 && currentPayDate >= currentMonthStart;
    const isCurrentOrFuture = currentPayDate >= currentMonthStart;
    let adjustment = 0;

    // ĐỒNG BỘ DỮ LIỆU (ANCHORING): Chỉ thực hiện một lần khi bắt đầu chạm đến vùng "Hiện tại/Tương lai"
    // Giúp bảng kế hoạch khớp chính xác với dư nợ thực tế trong DB mà không làm sai lệch lịch sử quá khứ
    if (!isFutureStarted && isCurrentOrFuture && actualRemainingPrincipal !== null) {
      isFutureStarted = true;
      let targetStartRemaining;
      if (eventsThisMonth.length > 0) {
        // Tháng hiện tại đã có giao dịch: Để kết thúc kỳ này dư nợ khớp với DB, 
        // ta phải bắt đầu từ [Dư nợ DB hiện tại] + [Gốc đã đóng thực tế trong kỳ này]
        targetStartRemaining = actualRemainingPrincipal + actualPrincipalPaid;
      } else {
        // Kỳ tương lai chưa có giao dịch: Bắt đầu thẳng từ dư nợ DB hiện tại
        targetStartRemaining = actualRemainingPrincipal;
      }

      adjustment = targetStartRemaining - remaining;
      remaining = targetStartRemaining;
    }

    const isUnderFreePeriod = freePrincipalMonths >= 1;

    let principalThisMonth = 0;
    let prepayThisMonth = 0;

    if (!isFuture && actualPrincipalPaid > 0) {
      // DỮ LIỆU THỰC TẾ: kỳ đã có giao dịch trả gốc

      if (hasPayoffEvent) {
        // Tất toán sớm: toàn bộ tiền gốc là khoản tất toán (prepay)
        principalThisMonth = 0;
        prepayThisMonth = Math.min(actualPrincipalPaid, remaining);
      } else {
        const targetNormal = isUnderFreePeriod ? 0 : basePrincipal;
        principalThisMonth = Math.min(actualPrincipalPaid, targetNormal, remaining);
        prepayThisMonth = Math.max(0, actualPrincipalPaid - principalThisMonth);
      }

      if (prepayThisMonth > 0) {
        freePrincipalMonths += prepayThisMonth / basePrincipal;
      }

      if (!hasPayoffEvent && isUnderFreePeriod && actualPrincipalPaid < basePrincipal) {
        freePrincipalMonths = Math.max(0, freePrincipalMonths - 1);
      }
    } else if (!isFuture && eventsThisMonth.length > 0) {
      // Tháng có giao dịch nhưng không trả gốc (VD: chỉ trả lãi)
      // Tiêu thụ kỳ miễn nếu cần
      if (isUnderFreePeriod) {
        freePrincipalMonths = Math.max(0, freePrincipalMonths - 1);
      }
    } else {
      // MÔ PHỎNG TƯƠNG LAI (không có giao dịch thực tế)
      if (isUnderFreePeriod) {
        principalThisMonth = 0;
        freePrincipalMonths = Math.max(0, freePrincipalMonths - 1);
      } else {
        principalThisMonth = Math.min(basePrincipal, remaining);
      }
    }

    const interestThisMonth = remaining * (r / 100) * (daysPeriod / 365);
    totalInterest += interestThisMonth;
    remaining -= (principalThisMonth + prepayThisMonth);

    const currentBankPayment = principalThisMonth + interestThisMonth;
    if (currentMonthBudget > 0) {
      accumulatedExtra += Math.max(0, currentMonthBudget - currentBankPayment);
    }

    let automatedPrepay = 0;
    let penaltyPaid = 0;

    // Chỉ chạy mô phỏng tất toán tự động (Dựa trên thặng dư ngân sách) cho các kỳ TƯƠNG LAI
    // Quá khứ phải dựa hoàn toàn vào dữ liệu giao dịch thực tế
    if (isFuture && threshold > 0 && remaining > 0) {
      const pRate = getPenaltyRate(m);
      const targetPrepay = Math.min(threshold, remaining);
      const penaltyForTarget = targetPrepay * (pRate / 100);
      
      // Chỉ tất toán nếu tiền tích luỹ đủ để trả (Số tiền ngưỡng + Phí phạt của nó)
      if (accumulatedExtra >= (targetPrepay + penaltyForTarget)) {
        automatedPrepay = targetPrepay;
        penaltyPaid = penaltyForTarget;
        
        totalPenalty += penaltyPaid;
        remaining -= automatedPrepay;
        accumulatedExtra -= (automatedPrepay + penaltyPaid);
        
        // Cập nhật số tháng không cần trả gốc (giảm áp lực dòng tiền)
        freePrincipalMonths += automatedPrepay / basePrincipal;
      }
    }

    schedule.push({
      month: m,
      date: currentPayDate.toLocaleDateString('vi-VN'),
      dateObj: new Date(currentPayDate),
      interest: Math.round(interestThisMonth),
      principal: Math.round(principalThisMonth),
      prepay: Math.round(prepayThisMonth + automatedPrepay), // Gộp cả trả thêm thủ công và tự động
      penalty: Math.round(penaltyPaid),
      adjustment: Math.round(adjustment),
      actualEventsCount: eventsThisMonth.length,
      total: Math.round(currentBankPayment + prepayThisMonth + automatedPrepay + penaltyPaid),
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
