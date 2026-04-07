import React, { useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useCurrencyInput } from '../../hooks/useCurrencyInput';
import { formatCurrency } from '../../utils/format';
import { LineChart } from 'lucide-react';

export function CompoundInterestSheet({ isOpen, onClose }) {
  const { displayValue: displayInitial, value: initialDeposit, handleInputChange: handleInitialChange } = useCurrencyInput('');
  const { displayValue: displayMonthly, value: monthlyDeposit, handleInputChange: handleMonthlyChange } = useCurrencyInput('');
  const [interestRate, setInterestRate] = useState('');
  const [years, setYears] = useState('');

  const [result, setResult] = useState(null);

  const calculateCompoundInterest = (e) => {
    e.preventDefault();
    if (!interestRate || !years) return;

    const P = initialDeposit || 0;
    const PMT = monthlyDeposit || 0;
    const r = parseFloat(interestRate) / 100;
    const t = parseInt(years);
    const n = 12; // compounded monthly

    // Compound on principal
    const futurePrincipal = P * Math.pow(1 + r / n, n * t);
    
    // Compound on future contributions
    const futureContributions = PMT * ((Math.pow(1 + r / n, n * t) - 1) / (r / n));

    const totalFutureValue = futurePrincipal + futureContributions;
    const totalInvested = P + (PMT * n * t);
    const totalInterestGained = totalFutureValue - totalInvested;

    setResult({
      totalFutureValue: Math.round(totalFutureValue),
      totalInvested: Math.round(totalInvested),
      totalInterestGained: Math.round(totalInterestGained)
    });
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Sức mạnh Lãi kép">
      <div className="space-y-6">
        <div className="bg-orange-50 text-orange-800 p-4 rounded-xl text-sm border border-orange-100 flex items-start space-x-3">
          <LineChart className="mt-0.5 shrink-0 text-orange-600" size={20} />
          <p>Kỳ quan thứ 8 của thế giới! Xem dòng tiền của bạn bung nở thế nào sau 10, 20 năm kiên trì tích lũy liên tục.</p>
        </div>

        <form onSubmit={calculateCompoundInterest} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Số vốn ban đầu (Tùy chọn)</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={displayInitial}
                onChange={handleInitialChange}
                placeholder="VD: 100.000 (Tức 100 triệu)"
                className="w-full bg-gray-50 text-gray-900 font-bold py-3 pr-24 pl-4 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
                <span className="text-xl font-bold text-gray-400">.000</span>
                <span className="text-xl font-bold text-gray-400">₫</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Góp thêm HẰNG THÁNG</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={displayMonthly}
                onChange={handleMonthlyChange}
                placeholder="VD: 5.000"
                className="w-full bg-gray-50 text-gray-900 font-bold py-3 pr-24 pl-4 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
                <span className="text-xl font-bold text-gray-400">.000</span>
                <span className="text-xl font-bold text-gray-400">₫</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Lãi suất (%/năm)</label>
              <input
                type="number"
                step="0.01"
                value={interestRate}
                onChange={e => setInterestRate(e.target.value)}
                placeholder="VD: 10"
                className="w-full bg-gray-50 border border-transparent focus:border-orange-500 rounded-xl px-4 py-3 outline-none font-medium text-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Thời gian (Năm)</label>
              <input
                type="number"
                value={years}
                onChange={e => setYears(e.target.value)}
                placeholder="VD: 20"
                className="w-full bg-gray-50 border border-transparent focus:border-orange-500 rounded-xl px-4 py-3 outline-none font-medium text-lg"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-200 mt-2 active:scale-95 transition-transform"
          >
            Tính toán
          </button>
        </form>

        {result && (
          <div className="mt-8 p-6 bg-white border border-gray-100 rounded-3xl shadow-sm animate-in fade-in slide-in-from-bottom-2">
            <h3 className="text-gray-500 text-sm font-semibold mb-1 text-center">Tổng tài sản thu được</h3>
            <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600 text-center mb-6">{formatCurrency(result.totalFutureValue)} ₫</p>
            
            <div className="space-y-3 border-t border-gray-100 pt-5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 font-medium">Tổng vốn tự đút lợn:</span>
                <span className="font-bold text-gray-500">{formatCurrency(result.totalInvested)} ₫</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 font-medium">Lãi kép tự đẻ ra:</span>
                <span className="font-bold text-green-600">+{formatCurrency(result.totalInterestGained)} ₫</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
