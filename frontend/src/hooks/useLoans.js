import { useState, useCallback } from 'react';
import { db } from '../lib/db';
import { calculateLoanSchedule } from '../utils/loanCalculator';

export function useLoans() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const allLoans = await db.loans.orderBy('start_date').reverse().toArray();
      const allInvestments = await db.investments.toArray();
      
      const enrichedLoans = allLoans.map(loan => ({
        ...loan,
        linked_investment: allInvestments.find(i => i.id === loan.linked_investment_id) || null
      }));
      setLoans(enrichedLoans);
    } catch (err) {
      console.error('Error fetching loans:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const addLoan = async (loanData) => {
    try {
      const newLoan = { 
        ...loanData, 
        id: crypto.randomUUID(),
        remaining_principal: loanData.remaining_principal ?? loanData.total_amount ?? 0,
        status: loanData.status || 'active'
      };
      await db.loans.add(newLoan);
      await fetchLoans();
      return newLoan;
    } catch (err) {
      console.error('Error adding loan:', err);
      throw err;
    }
  };

  const updateLoanBalance = async (loanId, principalPaid) => {
    try {
      const loan = await db.loans.get(loanId);
      if (!loan) throw new Error('Loan not found');

      const newRemaining = Math.max(0, loan.remaining_principal - principalPaid);
      const newStatus = newRemaining <= 100 ? 'paid_off' : 'active';

      await db.loans.update(loanId, { 
        remaining_principal: newRemaining,
        status: newStatus 
      });

      if (loan.linked_investment_id) {
        const investment = await db.investments.get(loan.linked_investment_id);
        if (investment) {
          const currentInvLoan = investment.loan_amount || 0;
          const newInvLoanAmount = Math.max(0, currentInvLoan - principalPaid);
          await db.investments.update(loan.linked_investment_id, { loan_amount: newInvLoanAmount });
        }
      }

      await fetchLoans();
    } catch (err) {
      console.error('Error updating loan balance:', err);
      throw err;
    }
  };

  const suggestInterest = (loan) => {
    if (!loan || loan.status === 'paid_off') return 0;
    const rate = parseFloat(loan.interest_rate) / 100;
    const monthlyRate = rate / 12;
    return Math.round(loan.remaining_principal * monthlyRate);
  };

  const deleteLoan = async (loanId) => {
    try {
      await db.loans.delete(loanId);
      await fetchLoans();
    } catch (err) {
      console.error('Error deleting loan:', err);
      throw err;
    }
  };

  const updateLoan = async (loanId, loanData) => {
    try {
      await db.loans.update(loanId, loanData);
      await fetchLoans();
    } catch (err) {
      console.error('Error updating loan:', err);
      throw err;
    }
  };

  const getLoanTransactions = useCallback(async (loanId) => {
    try {
      return await db.transactions
        .filter(t => t.loan_id === loanId)
        .toArray();
    } catch (err) {
      console.error('Error fetching loan transactions:', err);
      return [];
    }
  }, []);

  const addLoan = useCallback(async (loanData) => {
    try {
      const newLoan = { 
        ...loanData, 
        id: crypto.randomUUID(),
        remaining_principal: loanData.remaining_principal ?? loanData.total_amount ?? 0,
        status: loanData.status || 'active'
      };
      await db.loans.add(newLoan);
      await fetchLoans();
      return newLoan;
    } catch (err) {
      console.error('Error adding loan:', err);
      throw err;
    }
  }, [fetchLoans]);

  const updateLoanBalance = useCallback(async (loanId, principalPaid) => {
    try {
      const loan = await db.loans.get(loanId);
      if (!loan) throw new Error('Loan not found');

      const newRemaining = Math.max(0, loan.remaining_principal - principalPaid);
      const newStatus = newRemaining <= 100 ? 'paid_off' : 'active';

      await db.loans.update(loanId, { 
        remaining_principal: newRemaining,
        status: newStatus 
      });

      if (loan.linked_investment_id) {
        const investment = await db.investments.get(loan.linked_investment_id);
        if (investment) {
          const currentInvLoan = investment.loan_amount || 0;
          const newInvLoanAmount = Math.max(0, currentInvLoan - principalPaid);
          await db.investments.update(loan.linked_investment_id, { loan_amount: newInvLoanAmount });
        }
      }

      await fetchLoans();
    } catch (err) {
      console.error('Error updating loan balance:', err);
      throw err;
    }
  }, [fetchLoans]);

  const suggestInterest = useCallback((loan) => {
    if (!loan || loan.status === 'paid_off') return 0;
    const rate = parseFloat(loan.interest_rate) / 100;
    const monthlyRate = rate / 12;
    return Math.round(loan.remaining_principal * monthlyRate);
  }, []);

  const deleteLoan = useCallback(async (loanId) => {
    try {
      await db.loans.delete(loanId);
      await fetchLoans();
    } catch (err) {
      console.error('Error deleting loan:', err);
      throw err;
    }
  }, [fetchLoans]);

  const updateLoan = useCallback(async (loanId, loanData) => {
    try {
      await db.loans.update(loanId, loanData);
      await fetchLoans();
    } catch (err) {
      console.error('Error updating loan:', err);
      throw err;
    }
  }, [fetchLoans]);

  return {
    loans,
    loading,
    fetchLoans,
    addLoan,
    updateLoan,
    deleteLoan,
    updateLoanBalance,
    suggestInterest,
    getLoanTransactions
  };
}
