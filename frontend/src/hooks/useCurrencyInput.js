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

  // We store the display value strictly as string format (e.g. "1.500")
  const [displayValue, setDisplayValue] = useState(
    startVal ? formatCurrency(startVal / 1000) : ''
  );
  
  // The actual numeric value to be saved to Database (e.g. 1500000)
  const [value, setValue] = useState(startVal);

  const handleInputChange = (e) => {
    let rawInput = e.target.value;
    
    // Clear out everything if empty
    if (!rawInput) {
      setDisplayValue('');
      setValue(0);
      return;
    }

    // Get the base parsed number from user input
    const baseNumber = parseCurrencyInput(rawInput);
    
    // Format back to display string (e.g. 1000 => "1.000")
    if (baseNumber === 0 && !rawInput.match(/0$/)) {
      setDisplayValue('');
      setValue(0);
    } else {
      setDisplayValue(formatCurrency(baseNumber));
      // In DB, we multiply by 1000 as per x1000 logic constraint
      setValue(baseNumber * 1000);
    }
  };

  const reset = () => {
    setDisplayValue('');
    setValue(0);
  };

  const setExternalValue = (newVal) => {
    setValue(newVal);
    setDisplayValue(newVal ? formatCurrency(newVal / 1000) : '');
  };

  return {
    displayValue,
    value,
    handleInputChange,
    reset,
    setExternalValue
  };
}
