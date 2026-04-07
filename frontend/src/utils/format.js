export const formatCurrency = (value) => {
  if (value === null || value === undefined) return '';
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
