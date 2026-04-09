import { useState } from 'react';
import { parseCurrencyInput, formatCurrency } from '../utils/format';

/**
 * Hook to manage currency inputs.
 * Takes user input, formats it with thousand separators,
 * and maintains the actual numeric value (multiplied by 1000).
 */
export function useCurrencyInput(initialValue = 0) {
  // Use 0 if initialValue is empty string or undefined
  const startVal = (initialValue === '' || initialValue === undefined || initialValue === null) ? 0 : initialValue;

  // Track if we are in Full Precision mode (no x1000) or Shortcut mode (x1000)
  // Default to false (Shortcut Mode) for legacy compatibility and manual entry ease
  const [isFullMode, setIsFullMode] = useState(startVal > 0 && startVal % 1000 !== 0);

  // We store the display value strictly as string format (e.g. "1.500")
  const [displayValue, setDisplayValue] = useState(
    startVal ? formatCurrency(startVal % 1000 === 0 ? startVal / 1000 : startVal) : ''
  );
  
  // The actual numeric value to be saved to Database (e.g. 1500000)
  const [value, setValue] = useState(startVal);

  const handleInputChange = (e) => {
    let rawInput = e.target.value;
    
    // Clear out everything if empty -> Reset to Shortcut mode
    if (!rawInput) {
      reset();
      return;
    }

    // Get the base parsed number from user input
    const baseNumber = parseCurrencyInput(rawInput);
    
    if (baseNumber === 0 && !rawInput.match(/0$/)) {
      reset();
    } else {
      setDisplayValue(formatCurrency(baseNumber));
      // In DB, if not full mode, we multiply by 1000
      setValue(isFullMode ? baseNumber : baseNumber * 1000);
    }
  };

  const reset = () => {
    setDisplayValue('');
    setValue(0);
    setIsFullMode(false); // Reset to Shortcut mode when cleared
  };

  const setExternalValue = (newVal) => {
    // If system provides a value with non-zero remainder in last 3 digits, use Full Mode
    const full = newVal !== 0 && (newVal % 1000 !== 0);
    setIsFullMode(full);
    setValue(newVal);
    // Shortcut: show X for X.000. Full: show X.Y.Z
    setDisplayValue(newVal ? formatCurrency(full ? newVal : newVal / 1000) : '');
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
