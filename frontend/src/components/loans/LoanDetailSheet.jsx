import React, { useMemo, useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { formatCurrency } from '../../utils/format';
import { calculateLoanSchedule } from '../../utils/loanCalculator';
import { useLoans } from '../../hooks/useLoans';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  History, Calendar, AlertCircle, TrendingUp,
  Info, Pencil, Trash2, Save, X, ChevronDown,
  Clock, Percent, PlusCircle, XCircle
} from 'lucide-react';

function toViDecimal(val) {
  if (val === '' || val === null || val === undefined) return '';
  return String(val).replace('.', ',');
}
function fromViDecimal(str) {
  return parseFloat(String(str).replace(',', '.')) || 0;
}
function RateInput({ label, value, onChange, className = '' }) {
  const [display, setDisplay] = useState(toViDecimal(value));
  useEffect(() => { setDisplay(toViDecimal(value)); }, [value]);
  const handleChange = (e) => {
    const raw = e.target.value;
    if (!/^[\d,\.]*$/.test(raw)) return;
    setDisplay(raw);
    onChange(fromViDecimal(raw));
  };
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1 block">{label}</label>
      <input type="text" inputMode="decimal" value={display} onChange={handleChange}
        className={`w-full bg-white border border-gray-100 rounded-xl py-3 px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300 ${className}`} />
    </div>
  );
}

export function LoanDetailSheet({ isOpen, onClose, loan, onUpdated }) {
  const { user } = useAuth();
  const { updateLoan, deleteLoan } = useLoans();
  const [mode, setMode] = useState('view'); // 'view' | 'edit'
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [investments, setInvestments] = useState([]);

  // Edit form state
  const { displayValue: displayPrincipal, value: principalEdit, handleInputChange: handlePrincipalChange, setExternalValue: setExternalPrincipal, suffix } = useCurrencyInput('');
  const { displayValue: displayExtra, value: extraEdit, handleInputChange: handleExtraChange, setExternalValue: setExternalExtra, suffix: extraSuffix } = useCurrencyInput('');
  const { displayValue: displayThreshold, value: thresholdEdit, handleInputChange: handleThresholdChange, setExternalValue: setExternalThreshold, suffix: thresholdSuffix } = useCurrencyInput('');
  const [promoRate, setPromoRate] = useState(0);
  const [promoMonths, setPromoMonths] = useState(0);
  const [baseRate, setBaseRate] = useState(0);
  const [marginRate, setMarginRate] = useState(0);
  const [periods, setPeriods] = useState([]);
  const [showPeriods, setShowPeriods] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', term_months: 0, start_date: '', first_payment_date: '',
    linked_investment_id: '', penalty_config: '3, 3, 3, 1, 0',
  });

  useEffect(() => {
    if (isOpen) {
      setMode('view');
      fetchInvestments();
    }
  }, [isOpen]);

  useEffect(() => {
    if (loan && mode === 'edit') {
      setEditForm({
        name: loan.name || '',
        term_months: loan.term_months || 0,
        start_date: loan.start_date || '',
        first_payment_date: loan.first_payment_date || '',
        linked_investment_id: loan.linked_investment_id || '',
        penalty_config: loan.penalty_config || '3, 3, 3, 1, 0',
      });
      setExternalPrincipal(Math.round((loan.principal_amount || 0) / 1000));
      setExternalExtra(Math.round((loan.extra_payment || 0) / 1000));
      setExternalThreshold(Math.round((loan.offset_threshold || 0) / 1000));
      setPromoRate(loan.promo_rate || 0);
      setPromoMonths(loan.promo_months || 0);
      setBaseRate(loan.base_rate || 0);
      setMarginRate(loan.margin_rate || 0);
      setPeriods(loan.periods || []);
      setShowPeriods((loan.periods || []).length > 0);
    }
  }, [loan, mode]);

  const fetchInvestments = async () => {
    const { data } = await supabase.from('investments').select('id, symbol').eq('type', 'real_estate');
    setInvestments(data || []);
  };

  const scheduleData = useMemo(() => {
    if (!loan) return { result: null, schedule: [] };
    return calculateLoanSchedule({
      principal: loan.remaining_principal,
      termMonths: loan.term_months,
      promoRate: loan.promo_rate,
      promoMonths: loan.promo_months,
      baseRate: loan.base_rate,
      marginRate: loan.margin_rate,
      penaltyConfig: loan.penalty_config,
      startDate: loan.start_date,
      firstPaymentDate: loan.first_payment_date,
      extraPayment: loan.extra_payment,
      offsetThreshold: loan.offset_threshold,
      periods: loan.periods || [],
    });
  }, [loan]);

  const { result, schedule } = scheduleData;
  const progress = loan ? Math.round(((loan.principal_amount - loan.remaining_principal) / loan.principal_amount) * 100) : 0;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const interest_rate = promoRate > 0 ? promoRate : (baseRate + marginRate);
      await updateLoan(loan.id, {
        ...editForm,
        linked_investment_id: editForm.linked_investment_id || null,
        principal_amount: principalEdit,
        remaining_principal: Math.min(loan.remaining_principal, principalEdit),
        interest_rate,
        promo_rate: promoRate,
        promo_months: promoMonths,
        base_rate: baseRate,
        margin_rate: marginRate,
        extra_payment: extraEdit,
        offset_threshold: thresholdEdit,
        periods: periods.length > 0 ? periods : null,
      });
      setMode('view');
      onUpdated?.();
    } catch (err) {
      alert('Lỗi khi cập nhật: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Xoá khoản vay "${loan.name}"? Thao tác này không thể hoàn tác.`)) return;
    setDeleting(true);
    try {
      await deleteLoan(loan.id);
      onClose();
      onUpdated?.();
    } catch (err) {
      alert('Lỗi khi xoá: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (!loan) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={mode === 'edit' ? 'Chỉnh sửa Khoản Vay' : 'Chi Tiết Khoản Vay'}>
      <div className="space-y-5 pt-2 pb-10">

        {/* === VIEW MODE === */}
        {mode === 'view' && (
          <>
            {/* Header */}
            <div className="bg-gray-900 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10 rotate-12"><TrendingUp size={120} /></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${loan.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'}`} />
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                      {loan.status === 'active' ? 'Đang thực hiện' : 'Đã tất toán'}
                    </p>
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setMode('edit')}
                      className="flex items-center space-x-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors active:scale-95"
                    >
                      <Pencil size={12} />
                      <span>Sửa</span>
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex items-center space-x-1 bg-red-500/80 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors active:scale-95"
                    >
                      <Trash2 size={12} />
                      <span>{deleting ? '...' : 'Xoá'}</span>
                    </button>
                  </div>
                </div>
                <h3 className="text-2xl font-black mb-6">{loan.name}</h3>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Dư nợ hiện tại</p>
                    <p className="text-3xl font-black text-white">{formatCurrency(loan.remaining_principal)}<span className="text-xs ml-1 text-gray-400">₫</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-emerald-400">{progress}%</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Đã trả</p>
                  </div>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full mt-6 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>

            {/* Stats */}
            {result && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 flex items-center"><Calendar size={12} className="mr-1" /> Kỳ hạn còn lại</p>
                  <p className="text-lg font-black text-gray-900">{result.actualMonths} <span className="text-xs text-gray-400">tháng</span></p>
                  <p className="text-[9px] text-gray-400 mt-1 uppercase">Tất toán: {result.payoffDateStr}</p>
                </div>
                <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 flex items-center"><AlertCircle size={12} className="mr-1" /> Lãi tháng tới</p>
                  <p className="text-lg font-black text-blue-600">~{formatCurrency(schedule[0]?.interest || 0)} <span className="text-xs">₫</span></p>
                  <p className="text-[9px] text-gray-400 mt-1 uppercase">Lãi suất dự kiến</p>
                </div>
              </div>
            )}

            {/* Schedule Table */}
            {schedule.length > 0 && (
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <h4 className="font-black text-gray-900 text-sm uppercase tracking-widest flex items-center">
                    <History size={16} className="mr-2 text-blue-500" /> Lịch trả nợ dự kiến
                  </h4>
                  <div className="flex items-center text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                    <Info size={12} className="mr-1" /> Tự động cập nhật
                  </div>
                </div>
                <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                  <div className="max-h-[420px] overflow-y-auto">
                    <table className="w-full text-left font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      <thead className="bg-gray-50/50 sticky top-0 z-10 border-b border-gray-100">
                        <tr className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                          <th className="pl-4 pr-1 py-3 w-8 text-center">#</th>
                          <th className="px-1 py-3 text-center">Gốc</th>
                          <th className="px-1 py-3 text-center">Lãi</th>
                          <th className="pl-1 pr-4 py-3 text-center text-gray-900 font-black">Tổng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {schedule.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                            <td className="pl-4 pr-1 py-2.5 text-[10px] font-black text-gray-400">
                              {row.month}
                            </td>
                            <td className="px-1 py-2.5 text-[10px] font-bold text-gray-900 text-right">
                              {formatCurrency(row.principal)}
                            </td>
                            <td className="px-1 py-2.5 text-[10px] font-bold text-red-500 text-right">
                              {formatCurrency(row.interest)}
                            </td>
                            <td className="pl-1 pr-4 py-2.5 text-[10px] font-black text-gray-900 bg-gray-50/30 text-right">
                              {formatCurrency(row.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 bg-blue-50/50 rounded-3xl border border-blue-100/50 flex space-x-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 flex-shrink-0">
                <Info size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-900 mb-1">Mẹo tiết kiệm lãi suất</p>
                <p className="text-[10px] text-blue-700/80 leading-relaxed font-medium">
                  Thực hiện <strong>Trả nợ định kỳ</strong> tại màn hình Thêm giao dịch và nhập thêm tiền gốc để hệ thống tự động giảm lãi các tháng tiếp theo.
                </p>
              </div>
            </div>
          </>
        )}

        {/* === EDIT MODE === */}
        {mode === 'edit' && (
          <form onSubmit={handleSave} className="space-y-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500 font-medium">Chỉnh sửa thông tin khoản vay</p>
              <button type="button" onClick={() => setMode('view')} className="p-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 active:scale-95 transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Tên */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block">Tên khoản vay</label>
              <input type="text" required value={editForm.name}
                onChange={e => setEditForm(p => ({...p, name: e.target.value}))}
                className="w-full bg-gray-50 rounded-2xl py-4 px-4 text-gray-900 font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>

            {/* Số tiền & Kỳ hạn */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block">Số tiền vay (.000 ₫)</label>
                <div className="relative">
                  <input type="text" inputMode="numeric" value={displayPrincipal} onChange={handlePrincipalChange}
                    className="w-full bg-gray-50 rounded-2xl py-4 px-4 pr-16 text-gray-900 font-bold focus:ring-2 focus:ring-blue-500/20 outline-none" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">{suffix}</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block">Hạn vay (tháng)</label>
                <input type="number" value={editForm.term_months}
                  onChange={e => setEditForm(p => ({...p, term_months: Number(e.target.value)}))}
                  className="w-full bg-gray-50 rounded-2xl py-4 px-4 text-gray-900 font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
              </div>
            </div>

            {/* Lãi suất */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                <Percent size={12} className="mr-1" /> Lãi suất & Ưu đãi
              </p>
              <div className="grid grid-cols-2 gap-3">
                <RateInput label="Lãi ưu đãi (%/năm)" value={promoRate} onChange={setPromoRate} className="text-emerald-600" />
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 ml-1 uppercase tracking-widest block">Kỳ ưu đãi (tháng)</label>
                  <input type="number" value={promoMonths} onChange={e => setPromoMonths(Number(e.target.value))}
                    className="w-full bg-white border border-gray-100 rounded-xl py-3 px-4 text-sm font-bold text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-200" />
                </div>
                <RateInput label="Lãi cơ sở (%)" value={baseRate} onChange={setBaseRate} className="text-blue-600" />
                <RateInput label="Biên độ (+%)" value={marginRate} onChange={setMarginRate} className="text-blue-600" />
              </div>
            </div>

            {/* Ngày */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block">Ngày giải ngân</label>
                <input type="date" value={editForm.start_date}
                  onChange={e => setEditForm(p => ({...p, start_date: e.target.value}))}
                  className="w-full bg-gray-50 rounded-2xl py-4 px-4 text-gray-900 font-semibold outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block">Ngày trả đầu tiên</label>
                <input type="date" value={editForm.first_payment_date}
                  onChange={e => setEditForm(p => ({...p, first_payment_date: e.target.value}))}
                  className="w-full bg-gray-50 rounded-2xl py-4 px-4 text-gray-900 font-semibold outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>

            {/* Tất toán sớm */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Kế hoạch Tất toán sớm</p>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-400 ml-1">Phí phạt (%/năm theo từng năm)</label>
                <input type="text" value={editForm.penalty_config}
                  onChange={e => setEditForm(p => ({...p, penalty_config: e.target.value}))}
                  className="w-full bg-white border border-gray-100 rounded-xl py-3 px-4 text-sm font-medium text-gray-800 outline-none focus:ring-2 focus:ring-blue-300" />
                <p className="text-[9px] text-gray-400 ml-1">Cách nhau bởi dấu phẩy, mỗi vị trí là 1 năm</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 ml-1">Ngân sách/tháng (.000₫)</label>
                  <div className="relative">
                    <input type="text" inputMode="numeric" value={displayExtra} onChange={handleExtraChange}
                      className="w-full bg-white border border-gray-100 rounded-xl py-3 px-4 pr-10 text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-300" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-gray-400 font-bold">{extraSuffix}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 ml-1">Ngưỡng tất toán (.000₫)</label>
                  <div className="relative">
                    <input type="text" inputMode="numeric" value={displayThreshold} onChange={handleThresholdChange}
                      className="w-full bg-white border border-gray-100 rounded-xl py-3 px-4 pr-10 text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-300" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-gray-400 font-bold">{thresholdSuffix}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Giai đoạn */}
            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Kế hoạch theo Giai đoạn</p>
                <button type="button" onClick={() => setShowPeriods(v => !v)}
                  className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${showPeriods ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700'}`}>
                  {showPeriods ? 'Đang bật' : 'Bật lên'}
                </button>
              </div>
              {showPeriods && (
                <div className="space-y-3">
                  {periods.map((pd, idx) => (
                    <div key={idx} className="bg-white border border-purple-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-purple-700">Giai đoạn {idx + 1}</span>
                        <button type="button" onClick={() => setPeriods(prev => prev.filter((_, i) => i !== idx))}>
                          <XCircle size={16} className="text-red-400" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {['fromMonth','toMonth'].map(field => (
                          <input key={field} type="number" min="1" value={pd[field]}
                            placeholder={field === 'fromMonth' ? 'Từ kỳ' : 'Đến kỳ'}
                            onChange={e => setPeriods(prev => prev.map((p, i) => i === idx ? {...p, [field]: e.target.value} : p))}
                            className="w-full bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-sm font-bold outline-none" />
                        ))}
                        <input type="text" inputMode="decimal" value={toViDecimal(pd.rate)} placeholder="Lãi (%/năm)"
                          onChange={e => { if (/^[\d,\.]*$/.test(e.target.value)) setPeriods(prev => prev.map((p, i) => i === idx ? {...p, rate: e.target.value} : p)); }}
                          className="w-full bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-sm font-bold outline-none" />
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={pd.budget}
                            onChange={e => setPeriods(prev => prev.map((p, i) => i === idx ? {...p, budget: e.target.value} : p))}
                            className="w-full bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 pr-10 text-sm font-bold outline-none focus:ring-1 focus:ring-purple-400"
                            placeholder="Ngân sách"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400">.000 ₫</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button"
                    onClick={() => { const last = periods[periods.length-1]; const f = last ? parseInt(last.toMonth)+1 : 1; setPeriods(p => [...p, {fromMonth:f, toMonth:f+11, rate:'', budget:''}]); }}
                    className="w-full flex items-center justify-center space-x-2 py-2.5 border-2 border-dashed border-purple-300 text-purple-600 rounded-xl font-semibold text-sm">
                    <PlusCircle size={16} /><span>Thêm Giai đoạn</span>
                  </button>
                </div>
              )}
            </div>

            {/* Tài sản liên kết */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block">Gắn với Tài sản (BĐS)</label>
              <select value={editForm.linked_investment_id}
                onChange={e => setEditForm(p => ({...p, linked_investment_id: e.target.value}))}
                className="w-full bg-gray-50 rounded-2xl py-4 px-4 text-gray-900 font-semibold outline-none appearance-none focus:ring-2 focus:ring-blue-500/20">
                <option value="">Không gắn tài sản</option>
                {investments.map(inv => <option key={inv.id} value={inv.id}>{inv.symbol}</option>)}
              </select>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button type="button" onClick={() => setMode('view')}
                className="py-4 bg-gray-100 text-gray-700 font-bold rounded-2xl active:scale-95 transition-all flex items-center justify-center space-x-2">
                <X size={18} /><span>Huỷ</span>
              </button>
              <button type="submit" disabled={saving}
                className="py-4 bg-gray-900 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-2">
                {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={18} /><span>Lưu</span></>}
              </button>
            </div>
          </form>
        )}
      </div>
    </BottomSheet>
  );
}
