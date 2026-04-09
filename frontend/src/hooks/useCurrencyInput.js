import { useState, useEffect } from 'react';
import { parseCurrencyInput, formatCurrency } from '../utils/format';

/**
 * Hook to manage currency inputs.
 * Takes user input and handles numeric conversion.
 * 
 * Shortcut Mode (useShortcut: true):
 * - Appends ".000" suffix.
 * - Input "50" is stored as 50,000.
 * - Automatically switches to Full Mode if initial value or typed input is not multiple of 1000.
 * 
 * Full Mode (useShortcut: false):
 * - No automatic multiplier.
 * - Input "50000" is stored as 50,000.
 */
export function useCurrencyInput(initialValue = 0, { useShortcut = false } = {}) {
  // Use 0 if initialValue is empty string or undefined
  const startVal = (initialValue === '' || initialValue === undefined || initialValue === null) ? 0 : initialValue;

  // Track if we are in Full Precision mode (no x1000) or Shortcut mode (x1000)
  // If useShortcut is false, we are ALWAYS in Full Precision mode.
  // If useShortcut is true, we default to Shortcut Mode unless the value is not multiple of 1000.
  const [isFullMode, setIsFullMode] = useState(!useShortcut || (startVal > 0 && startVal % 1000 !== 0));

  // The actual numeric value to be saved to Database (e.g. 1500000)
  const [value, setValue] = useState(startVal);

  // The display value shown in the input box
  const [displayValue, setDisplayValue] = useState(
    startVal ? formatCurrency(!isFullMode ? startVal / 1000 : startVal) : ''
  );

  // Reactively handle useShortcut changes
  useEffect(() => {
    if (!useShortcut) {
      if (!isFullMode) {
        setIsFullMode(true);
        setDisplayValue(value ? formatCurrency(value) : '');
      }
    } else {
      // If switching BACK to shortcut, only do it if the value is a clean multiple of 1000
      if (value % 1000 === 0) {
        setIsFullMode(false);
        setDisplayValue(value ? formatCurrency(value / 1000) : '');
      }
    }
  }, [useShortcut]);

  const handleInputChange = (e) => {
    let rawInput = e.target.value;
    
    if (!rawInput) {
      reset();
      return;
    }

    const baseNumber = parseCurrencyInput(rawInput);
    
    if (baseNumber === 0 && !rawInput.match(/0$/)) {
      reset();
    } else {
      setDisplayValue(formatCurrency(baseNumber));
      // If we are NOT in full mode (Shortcut ON), we multiply by 1000
      setValue(!isFullMode ? baseNumber * 1000 : baseNumber);
    }
  };

  const reset = () => {
    setDisplayValue('');
    setValue(0);
    // Keep the current shortcut setting if possible
    setIsFullMode(!useShortcut);
  };

  const setExternalValue = (newVal) => {
    // Determine if the new value requires full mode
    const needsFull = !useShortcut || (newVal !== 0 && newVal % 1000 !== 0);
    setIsFullMode(needsFull);
    setValue(newVal);
    setDisplayValue(newVal ? formatCurrency(!needsFull ? newVal / 1000 : newVal) : '');
  };

  return {
    displayValue,
    value,
    handleInputChange,
    reset,
    setExternalValue,
    isFullMode,
    suffix: !isFullMode ? '.000 ₫' : ' ₫'
  };
}
