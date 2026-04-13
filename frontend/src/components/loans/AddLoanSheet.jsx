import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/db';
import { useLoans } from '../../hooks/useLoans';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';
import { Building, Clock, Percent, Save, Calculator, ChevronDown, CheckCircle, PlusCircle, XCircle } from 'lucide-react';

// Helper: hiển thị số thập phân dùng dấu phẩy (kiểu VN)
function toViDecimal(val) {
  if (val === '' || val === null || val === undefined) return '';
  return String(val).replace('.', ',');
}

// Helper: parse từ dấu phẩy về dấu chấm (để tính toán)
function fromViDecimal(str) {
  return parseFloat(String(str).replace(',', '.')) || 0;
}

// Input lãi suất với dấu phẩy
function RateInput({ label, value, onChange, className = '' }) {
  const [display, setDisplay] = useState(toViDecimal(value));

  useEffect(() => {
    // Sync khi value thay đổi từ bên ngoài (load hồ sơ)
    setDisplay(toViDecimal(value));
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value;
    // Chỉ cho phép số, dấu phẩy, dấu chấm
    if (!/^[\d,\.]*$/.test(raw)) return;
    setDisplay(raw);
    onChange(fromViDecimal(raw));
  };

  return (
    <div className="space-y-1">
      <label className="text-[9px] font-bold text-gray-400 ml-1 uppercase tracking-widest block">{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        className={`w-full bg-white border border-gray-100 rounded-xl py-3 px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300 ${className}`}
      />
    </div>
  );
}

export function AddLoanSheet({ isOpen, onClose, onSuccess, initialProfile = null }) {
  const { user } = useAuth();
  const { addLoan } = useLoans();
  
  const [loading, setLoading] = useState(false);
  const [investments, setInvestments] = useState([]);

  // Hồ sơ mô phỏng từ Calculator
  const [savedProfiles, setSavedProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [profileApplied, setProfileApplied] = useState(false);

  // Số tiền vay — dùng useCurrencyInput như Calculator
  const { displayValue: displayPrincipal, value: principal, handleInputChange: handlePrincipalChange, setExternalValue: setExternalPrincipal, suffix } = useCurrencyInput('');
  const { displayValue: displayExtra, value: extraPayment, handleInputChange: handleExtraChange, setExternalValue: setExternalExtra, suffix: extraSuffix } = useCurrencyInput('');
  const { displayValue: displayThreshold, value: offsetThreshold, handleInputChange: handleThresholdChange, setExternalValue: setExternalThreshold, suffix: thresholdSuffix } = useCurrencyInput('');

  // Lãi suất — riêng từng field
  const [promoRate, setPromoRate] = useState(0);
  const [promoMonths, setPromoMonths] = useState(0);
  const [baseRate, setBaseRate] = useState(8.5);
  const [marginRate, setMarginRate] = useState(0);

  // Các trường cơ bản
  const [formData, setFormData] = useState({
    name: '',
    term_months: 12,
    start_date: new Date().toISOString().split('T')[0],
    first_payment_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    linked_investment_id: '',
    penalty_config: '3, 3, 3, 1, 0',
  });

  // Kế hoạch theo Giai đoạn
  const [periods, setPeriods] = useState([]);
  const [showPeriods, setShowPeriods] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchInvestments();
      loadSavedProfiles();
      setSelectedProfileId('');
      setProfileApplied(false);

      if (initialProfile) {
        applyProfileData(initialProfile, initialProfile.name || 'Khoản vay mới');
      }
    }
  }, [isOpen]);

  const loadSavedProfiles = () => {
    const storageKey = `loan_profiles_${user?.id || 'guest'}`;
    try {
      const stored = localStorage.getItem(storageKey);
      setSavedProfiles(stored ? JSON.parse(stored) : []);
    } catch {
      setSavedProfiles([]);
    }
  };

  const applyProfileData = (profile, name) => {
    setFormData(prev => ({
      ...prev,
      name: name || prev.name,
      term_months: Number(profile.termMonths || profile.term_months) || 12,
      start_date: profile.startDate || profile.start_date || prev.start_date,
      first_payment_date: profile.firstPaymentDate || profile.first_payment_date || prev.first_payment_date,
      penalty_config: profile.penaltyConfig || profile.penalty_config || '3, 3, 3, 1, 0',
    }));
    setExternalPrincipal(Number(profile.principal || profile.principal_amount) || 0);
    setExternalExtra(Number(profile.extraPayment || profile.extra_payment) || 0);
    setExternalThreshold(Number(profile.offsetThreshold || profile.offset_threshold) || 0);
    setPromoRate(Number(profile.promoRate || profile.promo_rate) || 0);
    setPromoMonths(Number(profile.promoMonths || profile.promo_months) || 0);
    setBaseRate(Number(profile.baseRate || profile.base_rate) || 8.5);
    setMarginRate(Number(profile.marginRate || profile.margin_rate) || 0);
    setPeriods(profile.periods || []);
    if ((profile.periods || []).length > 0) setShowPeriods(true);
    setProfileApplied(true);
  };

  const handleSelectProfile = (profileId) => {
    setSelectedProfileId(profileId);
    setProfileApplied(false);
    if (!profileId) return;
    const profile = savedProfiles.find(p => p.id === profileId);
    if (profile) applyProfileData(profile, profile.name);
  };

  const fetchInvestments = async () => {
    try {
      const data = await db.investments.filter(i => i.type === 'real_estate').toArray();
      setInvestments(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: ['name', 'start_date', 'first_payment_date', 'linked_investment_id', 'penalty_config'].includes(name)
        ? value
        : Number(value)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const interest_rate = promoRate > 0 ? promoRate : (baseRate + marginRate);
      await addLoan({
        ...formData,
        linked_investment_id: formData.linked_investment_id || null,
        principal_amount: principal,
        total_amount: principal, // Map to standardized schema field
        remaining_principal: principal,
        interest_rate,
        promo_rate: promoRate,
        promo_months: promoMonths,
        base_rate: baseRate,
        margin_rate: marginRate,
        extra_payment: extraPayment,
        offset_threshold: offsetThreshold,
        periods: periods.length > 0 ? periods : null,
        status: 'active'
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      alert('Lỗi khi thêm khoản vay: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Thêm Khoản Vay Thực Tế">
      <form onSubmit={handleSubmit} className="space-y-6 pt-2 pb-10">

        {/* === Tải từ hồ sơ mô phỏng === */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3">
          <div className="flex items-center space-x-2">
            <Calculator size={16} className="text-blue-500" />
            <span className="text-sm font-bold text-blue-700">Tải từ Hồ sơ Mô phỏng</span>
          </div>
          {savedProfiles.length === 0 ? (
            <p className="text-xs text-blue-400 italic">Chưa có hồ sơ nào. Vào <strong>Tính khoản vay</strong> để lưu trước.</p>
          ) : (
            <div className="relative">
              <select
                value={selectedProfileId}
                onChange={e => handleSelectProfile(e.target.value)}
                className="w-full bg-white border border-blue-200 rounded-xl py-3 pl-4 pr-10 text-sm font-semibold text-gray-800 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">-- Chọn hồ sơ --</option>
                {savedProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
            </div>
          )}
          {profileApplied && (
            <div className="flex items-center space-x-1.5 text-emerald-600 text-xs font-bold">
              <CheckCircle size={14} />
              <span>Đã điền thông tin từ hồ sơ "{formData.name}"</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center space-x-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hoặc nhập thủ công</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* === 1. Thông tin cơ bản === */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-800 flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center">1</span>
            <span>Thông tin Khế ước</span>
          </h3>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block">Tên khoản vay / Ngân hàng</label>
            <div className="relative">
              <Building size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type="text"
                name="name"
                required
                placeholder="Ví dụ: Vay mua nhà VCB"
                value={formData.name}
                onChange={handleChange}
                className="w-full bg-gray-50 rounded-2xl py-4 pl-12 pr-4 text-gray-900 font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none placeholder:text-gray-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block">Số tiền vay</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={displayPrincipal}
                  onChange={handlePrincipalChange}
                  placeholder="VD: 1500000"
                  className="w-full bg-gray-50 rounded-2xl py-4 px-4 pr-16 text-gray-900 font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">{suffix}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block">Hạn vay (tháng)</label>
              <div className="relative">
                <input
                  type="number"
                  name="term_months"
                  required
                  value={formData.term_months}
                  onChange={handleChange}
                  className="w-full bg-gray-50 rounded-2xl py-4 pl-4 pr-10 text-gray-900 font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
                <Clock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300" />
              </div>
              {formData.term_months > 0 && (
                <p className="text-[10px] text-gray-400 ml-1">
                  ≈ {Math.floor(formData.term_months / 12)} năm {formData.term_months % 12 > 0 ? `${formData.term_months % 12} tháng` : ''}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block">Ngày giải ngân</label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                className="w-full bg-gray-50 rounded-2xl py-4 px-4 text-gray-900 font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block">Ngày trả đầu tiên</label>
              <input
                type="date"
                name="first_payment_date"
                value={formData.first_payment_date}
                onChange={handleChange}
                className="w-full bg-gray-50 rounded-2xl py-4 px-4 text-gray-900 font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>
          </div>
        </div>

        {/* === 2. Lãi suất === */}
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
          <h3 className="font-bold text-gray-800 flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs flex items-center justify-center">2</span>
            <span className="flex items-center"><Percent size={14} className="mr-1" /> Lãi suất & Ưu đãi</span>
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <RateInput label="Lãi ưu đãi (%/năm)" value={promoRate} onChange={setPromoRate} className="text-emerald-600" />
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1 block">Kỳ hạn ưu đãi (tháng)</label>
              <input
                type="number"
                value={promoMonths}
                onChange={e => setPromoMonths(Number(e.target.value))}
                className="w-full bg-white border border-gray-100 rounded-xl py-3 px-4 text-sm font-bold text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <RateInput label="Lãi cơ sở (%)" value={baseRate} onChange={setBaseRate} className="text-blue-600" />
            <RateInput label="Biên độ (+%)" value={marginRate} onChange={setMarginRate} className="text-blue-600" />
          </div>
          {(baseRate + marginRate) > 0 && (
            <p className="text-xs text-gray-500 text-center bg-white rounded-xl py-2 border border-gray-100">
              Lãi thả nổi sau ưu đãi: <span className="font-bold text-blue-600">{toViDecimal((baseRate + marginRate).toFixed(2))}%</span>/năm
            </p>
          )}
        </div>

        {/* === 3. Kế hoạch Tất toán sớm === */}
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
          <h3 className="font-bold text-gray-800 flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 text-xs flex items-center justify-center">3</span>
            <span>Kế hoạch Tất toán sớm</span>
          </h3>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block">Phí phạt trả sớm (%/năm)</label>
            <input
              type="text"
              name="penalty_config"
              value={formData.penalty_config}
              onChange={handleChange}
              placeholder="VD: 3, 3, 3, 1, 0"
              className="w-full bg-white border border-gray-100 rounded-xl py-3 px-4 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <p className="text-[9px] text-gray-400 ml-1">Cách nhau bởi dấu phẩy, mỗi vị trí là 1 năm</p>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block">Ngân sách trả nợ hàng tháng</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={displayExtra}
                onChange={handleExtraChange}
                placeholder="VD: 25.000.000"
                className="w-full bg-white border border-gray-100 rounded-xl py-3 px-4 pr-16 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400">{extraSuffix}</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block">Ngưỡng kích hoạt Tất Toán</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={displayThreshold}
                onChange={handleThresholdChange}
                placeholder="VD: 50.000.000"
                className="w-full bg-white border border-gray-100 rounded-xl py-3 px-4 pr-16 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400">{thresholdSuffix}</span>
            </div>
          </div>
        </div>

        {/* === 4. Kế hoạch theo Giai đoạn === */}
        <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-800 flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs flex items-center justify-center">4</span>
              <span>Kế hoạch theo Giai đoạn</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowPeriods(v => !v)}
              className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${showPeriods ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700'}`}
            >
              {showPeriods ? 'Đang bật' : 'Bật lên'}
            </button>
          </div>

          {showPeriods && (
            <div className="space-y-3">
              <p className="text-[10px] text-purple-600 font-medium">Ưu tiên hơn lãi đơn ở trên. Mỗi giai đoạn có lãi suất và ngân sách riêng.</p>
              {periods.map((pd, idx) => (
                <div key={idx} className="bg-white border border-purple-100 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-700">Giai đoạn {idx + 1}</span>
                    <button type="button" onClick={() => setPeriods(prev => prev.filter((_, i) => i !== idx))}>
                      <XCircle size={16} className="text-red-400" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400">Từ kỳ</label>
                      <input type="number" min="1" value={pd.fromMonth}
                        onChange={e => setPeriods(prev => prev.map((p, i) => i === idx ? {...p, fromMonth: e.target.value} : p))}
                        className="w-full bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-1 focus:ring-purple-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400">Đến kỳ</label>
                      <input type="number" min="1" value={pd.toMonth}
                        onChange={e => setPeriods(prev => prev.map((p, i) => i === idx ? {...p, toMonth: e.target.value} : p))}
                        className="w-full bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-1 focus:ring-purple-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400">Lãi suất (%/năm)</label>
                      <input type="text" inputMode="decimal" value={toViDecimal(pd.rate)}
                        onChange={e => {
                          const v = e.target.value;
                          if (/^[\d,\.]*$/.test(v)) setPeriods(prev => prev.map((p, i) => i === idx ? {...p, rate: v} : p));
                        }}
                        className="w-full bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-1 focus:ring-purple-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400">Ngân sách</label>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={pd.budget}
                          onChange={e => setPeriods(prev => prev.map((p, i) => i === idx ? {...p, budget: e.target.value} : p))}
                          className="w-full bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 pr-10 text-sm font-bold outline-none focus:ring-1 focus:ring-purple-400"
                          placeholder="Ngân sách"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400">₫</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const last = periods[periods.length - 1];
                  const nextFrom = last ? parseInt(last.toMonth) + 1 : 1;
                  setPeriods(prev => [...prev, { fromMonth: nextFrom, toMonth: nextFrom + 11, rate: last?.rate || '', budget: last?.budget || '' }]);
                }}
                className="w-full flex items-center justify-center space-x-2 py-2.5 border-2 border-dashed border-purple-300 text-purple-600 rounded-xl font-semibold text-sm"
              >
                <PlusCircle size={16} />
                <span>Thêm Giai đoạn</span>
              </button>
            </div>
          )}
        </div>

        {/* === 5. Tài sản liên kết === */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block">Gắn với Tài sản (BĐS)</label>
          <select
            name="linked_investment_id"
            value={formData.linked_investment_id}
            onChange={handleChange}
            className="w-full bg-gray-50 rounded-2xl py-4 px-4 text-gray-900 font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none"
          >
            <option value="">Không gắn tài sản</option>
            {investments.map(inv => (
              <option key={inv.id} value={inv.id}>{inv.symbol}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || !principal}
          className="w-full bg-gray-900 text-white rounded-3xl py-5 font-black text-lg shadow-xl active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center space-x-2"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Save size={20} />
              <span>Kích hoạt Hồ sơ vay</span>
            </>
          )}
        </button>
      </form>
    </BottomSheet>
  );
}
