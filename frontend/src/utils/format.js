export const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  // Use 'vi-VN' locale: dot as thousand separator, comma as decimal (e.g. 1.500.000)
  return new Intl.NumberFormat('vi-VN').format(value);
};

export const parseCurrencyInput = (inputValue) => {
  if (!inputValue) return 0;
  // Remove non-digit characters (handles both "." and "," separators)
  const cleanValue = inputValue.toString().replace(/[^\d]/g, '');
  const numericValue = parseInt(cleanValue, 10);
  return isNaN(numericValue) ? 0 : numericValue;
};

/**
 * Converts a numeric value to a Vietnamese decimal string (using comma).
 * e.g., 8.5 -> "8,5"
 */
export const toViDecimal = (val) => {
  if (val === '' || val === null || val === undefined) return '';
  return String(val).replace('.', ',');
};

/**
 * Parses a Vietnamese decimal string to a number.
 * e.g., "8,5" -> 8.5
 */
export const fromViDecimal = (str) => {
  if (str === '' || str === null || str === undefined) return 0;
  return parseFloat(String(str).replace(',', '.')) || 0;
};

export const formatDate = (dateInput) => {
  if (!dateInput) return '';

  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return '';
    const d = String(dateInput.getDate()).padStart(2, '0');
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const y = String(dateInput.getFullYear()).slice(-2);
    return `${d}/${m}/${y}`;
  }

  const str = String(dateInput).trim();
  if (!str) return '';

  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const yearShort = y.trim().slice(-2);
      return `${d.trim().padStart(2, '0')}/${m.trim().padStart(2, '0')}/${yearShort}`;
    }
  }

  if (str.includes('-')) {
    const datePart = str.split('T')[0];
    const parts = datePart.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      const yearShort = y.trim().slice(-2);
      return `${d.trim().padStart(2, '0')}/${m.trim().padStart(2, '0')}/${yearShort}`;
    }
  }

  const dObj = new Date(str);
  if (!isNaN(dObj.getTime())) {
    const d = String(dObj.getDate()).padStart(2, '0');
    const m = String(dObj.getMonth() + 1).padStart(2, '0');
    const y = String(dObj.getFullYear()).slice(-2);
    return `${d}/${m}/${y}`;
  }

  return str;
};

