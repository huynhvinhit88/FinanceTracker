import { useState } from 'react';
import { formatCurrency } from '../utils/format';

/**
 * Hook nhập tiền THỐNG NHẤT cho mọi ô số tiền trong app (Chế độ Nhập Đầy Đủ - Full Mode).
 *
 * Quy tắc:
 * 1. Nhập số thực đầy đủ: gõ "50000" -> hiển thị "50.000", giá trị = 50000; gõ "500" -> "500".
 * 2. Tự động định dạng dấu phân cách hàng ngàn "." giúp người dùng dễ quan sát.
 * 3. Hậu tố hiển thị luôn là " ₫".
 */
export function useCurrencyInput(initialValue = 0, { allowNegative = false } = {}) {
  const startVal = (initialValue === '' || initialValue === undefined || initialValue === null)
    ? 0
    : (Number(initialValue) || 0);

  const [value, setValue] = useState(startVal);
  const [displayValue, setDisplayValue] = useState(startVal ? formatCurrency(startVal) : '');

  const reset = () => {
    setDisplayValue('');
    setValue(0);
  };

  const handleInputChange = (e) => {
    const raw = e.target.value;

    // Không còn chữ số nào trong ô.
    if (!/\d/.test(raw)) {
      if (allowNegative && /-/.test(raw)) {
        setDisplayValue('-');
        setValue(0);
        return;
      }
      reset();
      return;
    }

    const isNeg = allowNegative && /-/.test(raw);
    const intDigits = raw.replace(/[^\d]/g, '');
    const n = parseInt(intDigits || '0', 10);

    setValue(isNeg ? -n : n);
    setDisplayValue((isNeg ? '-' : '') + (intDigits ? formatCurrency(n) : ''));
  };

  const setExternalValue = (newVal) => {
    const v = (newVal === '' || newVal === undefined || newVal === null) ? 0 : (Number(newVal) || 0);
    setValue(v);
    if (v === 0) {
      setDisplayValue('');
    } else {
      setDisplayValue(formatCurrency(v));
    }
  };

  return {
    displayValue,
    value,
    handleInputChange,
    reset,
    setExternalValue,
    isFullMode: true,
    suffix: ' ₫'
  };
}
