import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowDownRight, ArrowRightLeft } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { EditTransactionSheet } from '../components/transactions/EditTransactionSheet';

const PAGE_SIZE = 20;

export default function TransactionsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  
  const [filterType, setFilterType] = useState('all'); // 'all', 'income', 'expense', 'transfer'
  
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // Intersection Observer for Infinite Scroll
  const observer = useRef();
  const lastElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => prev + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  // Reset and Refetch when filter changes
  useEffect(() => {
    setTransactions([]);
    setPage(0);
    setHasMore(true);
    // Explicitly call fetch for page 0 to avoid race conditions
    fetchTransactions(0, filterType, true);
  }, [filterType, user]); // Refetch fully when filter changes

  // Fetch more when page changes (except 0, which is handled above)
  useEffect(() => {
    if (page > 0) {
      fetchTransactions(page, filterType, false);
    }
  }, [page]);

  const fetchTransactions = async (pageIndex, currentFilter, isReset) => {
    if (!user) return;
    setLoading(true);
    
    try {
      let query = supabase
        .from('transactions')
        .select(`
          *,
          account:accounts!account_id(name),
          to_account:accounts!to_account_id(name),
          category:categories(name, icon, color_hex)
        `)
        .order('date', { ascending: false })
        .range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1);
        
      if (currentFilter !== 'all') {
        query = query.eq('type', currentFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const newTxs = data || [];
      if (newTxs.length < PAGE_SIZE) setHasMore(false);
      
      setTransactions(prev => isReset ? newTxs : [...prev, ...newTxs]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Group transactions by date
  const groupedTransactions = transactions.reduce((acc, tx) => {
    const dateStr = new Date(tx.date).toLocaleDateString('vi-VN');
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(tx);
    return acc;
  }, {});

  const handleTransactionClick = (tx) => {
    setSelectedTransaction(tx);
    setIsEditSheetOpen(true);
  };

  const renderTransactionIcon = (tx) => {
    if (tx.type === 'transfer') {
      return (
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
          <ArrowRightLeft size={18} />
        </div>
      );
    }
    return (
      <div 
        className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
        style={{ backgroundColor: tx.category?.color_hex || '#9CA3AF' }}
      >
        <span className="text-lg">{tx.category?.icon || (tx.type === 'income' ? '💰' : '💸')}</span>
      </div>
    );
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* App Bar pinned top */}
      <div className="bg-white px-4 py-4 safe-top sticky top-0 z-40 border-b border-gray-100 shadow-sm flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors">
          <ArrowLeft size={24} className="text-gray-800" />
        </button>
        <h1 className="font-bold text-lg text-gray-900 absolute left-1/2 -translate-x-1/2">Lịch sử giao dịch</h1>
        <div className="w-8" />
      </div>

      {/* Filter Chips */}
      <div className="px-4 py-3 bg-white flex space-x-2 overflow-x-auto hide-scrollbar border-b border-gray-100 sticky top-[60px] z-30">
        {[
          { id: 'all', label: 'Tất cả' },
          { id: 'expense', label: 'Khoản chi' },
          { id: 'income', label: 'Khoản thu' },
          { id: 'transfer', label: 'Chuyển tiền' }
        ].map(filter => (
          <button
            key={filter.id}
            onClick={() => setFilterType(filter.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filterType === filter.id 
                ? 'bg-gray-900 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="p-4 pb-12 space-y-6">
        {Object.entries(groupedTransactions).map(([date, txs]) => (
          <div key={date}>
            <h3 className="text-xs font-semibold text-gray-500 mb-3 px-1 uppercase tracking-wider">{date}</h3>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {txs.map((tx, index) => {
                const isIncome = tx.type === 'income';
                const isTransfer = tx.type === 'transfer';
                
                return (
                  <div 
                    key={tx.id}
                    onClick={() => handleTransactionClick(tx)}
                    className={`flex items-center justify-between p-4 active:bg-gray-50 transition-colors cursor-pointer ${
                      index !== txs.length - 1 ? 'border-b border-gray-50' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-4 pointer-events-none truncate pr-4">
                      {renderTransactionIcon(tx)}
                      <div className="truncate">
                        <p className="font-semibold text-gray-900 truncate">
                          {tx.type === 'transfer' ? 'Chuyển tiền' : (tx.category?.name || 'Khác')}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {tx.type === 'transfer' ? `${tx.account?.name} → ${tx.to_account?.name}` : tx.account?.name}
                          {tx.note && ` • ${tx.note}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold ${isIncome ? 'text-green-600' : isTransfer ? 'text-gray-900' : 'text-red-500'}`}>
                        {isIncome ? '+' : isTransfer ? '' : '-'}{formatCurrency(tx.amount)} đ
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Loading / End Indicator */}
        <div 
          ref={lastElementRef} 
          className="flex justify-center py-6"
        >
          {loading && (
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin"></div>
          )}
          {!loading && !hasMore && transactions.length > 0 && (
            <p className="text-xs text-gray-400 font-medium">Đã hết lịch sử giao dịch</p>
          )}
          {!loading && transactions.length === 0 && (
            <div className="text-center py-10 w-full">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ArrowDownRight className="text-gray-300" size={32} />
              </div>
              <p className="text-gray-500 text-sm mt-2">Chưa có giao dịch nào phù hợp.</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Overlay */}
      <EditTransactionSheet 
        isOpen={isEditSheetOpen} 
        onClose={() => {
          setIsEditSheetOpen(false);
          setTimeout(() => setSelectedTransaction(null), 300);
        }} 
        transaction={selectedTransaction}
        onSuccess={() => {
          // Soft-refresh the current list (fetch only page 0 again to reflect latest edits at top, or custom sync)
          setFilterType('all');
          fetchTransactions(0, 'all', true);
        }}
      />
    </div>
  );
}
