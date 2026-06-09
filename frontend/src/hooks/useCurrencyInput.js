import { useState } from 'react';
import { formatCurrency } from '../utils/format';

/**
 * Hook nhập tiền THỐNG NHẤT cho mọi ô số tiền trong app.
 *
 * Quy tắc:
 * 1. Mặc định luôn hiển thị hậu tố ".000 ₫" — con số gõ vào được coi là hàng NGÀN.
 *    Gõ "100" → giá trị 100.000.
 * 2. Khi người dùng gõ dấu "." → coi như muốn nhập phần lẻ dưới 1.000 (kiểu thập phân của
 *    phần ngàn): bỏ hậu tố ".000 ₫" → " ₫". Giá trị = phần_ngàn × 1000 + phần_lẻ, với phần lẻ
 *    được canh trái (".5" = 0,5 ngàn = 500; ".53" = 530; ".534" = 534). Tối đa 3 chữ số lẻ.
 *    Xóa hết dấu "." → quay lại chế độ mặc định (hiện lại ".000 ₫").
 * 3. Giá trị set tự động qua setExternalValue (lãi tiết kiệm, tiền trả nợ, số liệu đã lưu...)
 *    luôn hiển thị ĐẦY ĐỦ số thực (chế độ chính xác), không nhân 1000.
 *
 * Tham số `useShortcut` vẫn được nhận để tương thích chữ ký cũ ở các nơi gọi, nhưng KHÔNG còn
 * tác động tới hành vi — mọi ô đều dùng chung cách nhập trên.
 */
export function useCurrencyInput(initialValue = 0, { allowNegative = false } = {}) {
  const startVal = (initialValue === '' || initialValue === undefined || initialValue === null)
    ? 0
    : (Number(initialValue) || 0);

  // isFullMode = đang ở chế độ nhập/hiển thị chính xác (đã gõ "." hoặc giá trị set tự động).
  // Giá trị khởi tạo khác 0 được coi là set sẵn → hiển thị đầy đủ.
  const [isFullMode, setIsFullMode] = useState(startVal !== 0);
  const [value, setValue] = useState(startVal);
  const [displayValue, setDisplayValue] = useState(startVal ? formatCurrency(startVal) : '');

  const reset = () => {
    setDisplayValue('');
    setValue(0);
    setIsFullMode(false);
  };

  const handleInputChange = (e) => {
    const raw = e.target.value;

    // Không còn chữ số nào trong ô.
    if (!/\d/.test(raw)) {
      // Cho phép giữ lại dấu '-' đơn lẻ để người dùng nhập tiếp số âm (vd số dư ví Nợ).
      if (allowNegative && /-/.test(raw)) {
        setDisplayValue('-');
        setValue(0);
        setIsFullMode(false);
        return;
      }
      reset();
      return;
    }

    const isNeg = allowNegative && /-/.test(raw);
    // Chỉ giữ chữ số và dấu chấm.
    const s = raw.replace(/[^\d.]/g, '');

    // Xác định chế độ:
    // - Đang mặc định: nếu xuất hiện "." mà phía sau có 0–2 chữ số (người dùng vừa gõ phần lẻ)
    //   → chuyển sang chế độ chính xác. (Khi gõ trong chế độ mặc định, hậu tố nhóm 3 chữ số
    //   luôn đủ 3 nên không bị nhận nhầm.)
    // - Đang chính xác: nếu không còn dấu "." nào → quay lại mặc định.
    let fullMode = isFullMode;
    if (!isFullMode && /\.\d{0,2}$/.test(s)) fullMode = true;
    else if (isFullMode && !s.includes('.')) fullMode = false;

    let base;
    let display;
    if (fullMode && s.includes('.')) {
      const lastDot = s.lastIndexOf('.');
      const intDigits = s.slice(0, lastDot).replace(/\./g, '');
      const fracDigits = s.slice(lastDot + 1).replace(/\./g, '').slice(0, 3);
      const intThousands = parseInt(intDigits || '0', 10);
      // Kiểu thập phân: canh trái rồi đệm '0' bên phải cho đủ 3 chữ số (".5" → 500).
      const fracOnes = fracDigits ? parseInt(fracDigits.padEnd(3, '0'), 10) : 0;
      base = intThousands * 1000 + fracOnes;
      // Hiển thị: phần ngàn nhóm 3 chữ số + '.' + phần lẻ đang gõ (giữ nguyên ký tự người dùng nhập).
      display = `${intDigits ? formatCurrency(intThousands) : '0'}.${fracDigits}`;
    } else {
      // Chế độ mặc định (nhân 1000).
      const intDigits = s.replace(/\./g, '');
      const n = parseInt(intDigits || '0', 10);
      base = n * 1000;
      display = intDigits ? formatCurrency(n) : '';
    }

    setValue(isNeg ? -base : base);
    setDisplayValue((isNeg ? '-' : '') + display);
    setIsFullMode(fullMode);
  };

  // Đặt giá trị từ bên ngoài (số tính tự động hoặc dữ liệu đã lưu) → luôn hiển thị đầy đủ.
  const setExternalValue = (newVal) => {
    const v = (newVal === '' || newVal === undefined || newVal === null) ? 0 : (Number(newVal) || 0);
    setValue(v);
    if (v === 0) {
      // Trống → quay về mặc định để lần nhập tay sau hiện lại hậu tố ".000".
      setIsFullMode(false);
      setDisplayValue('');
    } else {
      setIsFullMode(true);
      setDisplayValue(formatCurrency(v));
    }
  };

  return {
    displayValue,
    value,
    handleInputChange,
    reset,
    setExternalValue,
    isFullMode,
    suffix: isFullMode ? ' ₫' : '.000 ₫'
  };
}
