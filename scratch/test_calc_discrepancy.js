import { calculateLoanSchedule } from '../frontend/src/utils/loanCalculator.js';

const profile = {
  principal: 1800000000,
  termMonths: 360,
  promoRate: 6.2,
  promoMonths: 0,
  baseRate: 6.2,
  marginRate: 0,
  startDate: '2026-01-01',
  firstPaymentDate: '2026-02-01',
  extraPayment: 30000000,
  offsetThreshold: 100000000,
  penaltyConfig: '3, 3, 3, 1, 0'
};

// Case 1: Simulator (No history, no anchor)
const sim = calculateLoanSchedule(profile, [], null);
console.log('--- SIMULATOR ---');
console.log('Total Interest:', sim.result.actualTotalInterest);
console.log('Actual Months:', sim.result.actualMonths);
console.log('Payoff Date:', sim.result.payoffDateStr);

// Case 2: Real Loan (No history, but passing anchor)
const real = calculateLoanSchedule(profile, [], 1800000000);
console.log('\n--- REAL LOAN (NO HISTORY, ANCHOR PRESET) ---');
console.log('Total Interest:', real.result.actualTotalInterest);
console.log('Actual Months:', real.result.actualMonths);
console.log('Payoff Date:', real.result.payoffDateStr);

// Case 3: Simulation from a month ago
const olderProfile = { ...profile, startDate: '2025-01-01', firstPaymentDate: '2025-02-01' };
const simOld = calculateLoanSchedule(olderProfile, [], null);
const realOld = calculateLoanSchedule(olderProfile, [], 1800000000); // DB says I still owe full 1.8B

console.log('\n--- REAL LOAN (START 2025, TODAY 2026, DB BALANCE 1.8B) ---');
console.log('SIM Total Interest:', simOld.result.actualTotalInterest);
console.log('REAL Total Interest:', realOld.result.actualTotalInterest);
console.log('SIM Actual Months:', simOld.result.actualMonths);
console.log('REAL Actual Months:', realOld.result.actualMonths);
