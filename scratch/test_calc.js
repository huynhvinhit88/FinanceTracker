const { calculateLoanSchedule } = require('./frontend/src/utils/loanCalculator');

const profile = {
  principal: 1800000000,
  termMonths: 360,
  promoRate: 8,
  promoMonths: 12,
  baseRate: 0,
  marginRate: 0, // 8% constant
  extraPayment: 38400000, // Budget to make accumulated ~24M growth
  offsetThreshold: 100000000,
  penaltyConfig: '3, 3, 3, 1, 0',
  startDate: '2026-01-01',
  firstPaymentDate: '2026-02-01',
};

const { schedule } = calculateLoanSchedule(profile);

schedule.slice(0, 10).forEach(row => {
    console.log(`Kỳ ${row.month}: Gốc=${row.principal.toLocaleString()}, Tất toán=${row.prepay.toLocaleString()}, Ví=${row.accumulated.toLocaleString()}, Dư nợ=${row.remaining.toLocaleString()}`);
});
