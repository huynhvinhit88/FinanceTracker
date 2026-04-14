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
