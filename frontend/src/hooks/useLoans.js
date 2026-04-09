import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { calculateLoanSchedule } from '../utils/loanCalculator';

export function useLoans() {
  const { user } = useAuth();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLoans = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('loans')
        .select(`
          *,
          linked_investment:investments(id, symbol, current_price, loan_amount)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLoans(data || []);
    } catch (err) {
      console.error('Error fetching loans:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const addLoan = async (loanData) => {
    try {
      const { data, error } = await supabase
        .from('loans')
        .insert([{ ...loanData, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      await fetchLoans();
      return data;
    } catch (err) {
      console.error('Error adding loan:', err);
      throw err;
    }
  };

  const updateLoanBalance = async (loanId, principalPaid) => {
    try {
      // 1. Lấy thông tin khoản vay hiện tại
      const { data: loan, error: fetchErr } = await supabase
        .from('loans')
        .select('*')
        .eq('id', loanId)
        .single();
      
      if (fetchErr) throw fetchErr;

      const newRemaining = Math.max(0, loan.remaining_principal - principalPaid);
      const newStatus = newRemaining <= 100 ? 'paid_off' : 'active';

      // 2. Cập nhật bảng loans
      const { error: updateErr } = await supabase
        .from('loans')
        .update({ 
          remaining_principal: newRemaining,
          status: newStatus 
        })
        .eq('id', loanId);

      if (updateErr) throw updateErr;

      // 3. Nếu có liên kết với BĐS (Investment), cập nhật nợ vay bên đó
      if (loan.linked_investment_id) {
        const { data: investment } = await supabase
          .from('investments')
          .select('loan_amount')
          .eq('id', loan.linked_investment_id)
          .single();
        
        if (investment) {
          const currentInvLoan = investment.loan_amount || 0;
          const newInvLoanAmount = Math.max(0, currentInvLoan - principalPaid);
          await supabase
            .from('investments')
            .update({ loan_amount: newInvLoanAmount })
            .eq('id', loan.linked_investment_id);
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
    
    // Tính toán lãi suất gợi ý (Công thức đơn giản: Lãi = Dư nợ * Lãi suất * (30/365))
    // Có thể cải tiến bằng cách lấy ngày trả nợ cuối cùng
    const rate = parseFloat(loan.interest_rate) / 100;
    const monthlyRate = rate / 12;
    return Math.round(loan.remaining_principal * monthlyRate);
  };

  const deleteLoan = async (loanId) => {
    try {
      const { error } = await supabase.from('loans').delete().eq('id', loanId);
      if (error) throw error;
      await fetchLoans();
    } catch (err) {
      console.error('Error deleting loan:', err);
      throw err;
    }
  };

  const updateLoan = async (loanId, loanData) => {
    try {
      const { error } = await supabase
        .from('loans')
        .update(loanData)
        .eq('id', loanId);
      if (error) throw error;
      await fetchLoans();
    } catch (err) {
      console.error('Error updating loan:', err);
      throw err;
    }
  };

  return {
    loans,
    loading,
    fetchLoans,
    addLoan,
    updateLoan,
    deleteLoan,
    updateLoanBalance,
    suggestInterest
  };
}
