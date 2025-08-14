/**
 * Utility functions for name processing
 */

/**
 * Capitalizes the first letter of each word in a name.
 * Handles common name formats and edge cases.
 */
export function capitalizeName(name: string): string {
  if (!name || typeof name !== 'string') {
    return name;
  }
  
  // Split by spaces and capitalize each word
  const words = name.trim().split(' ');
  const capitalizedWords = words.map(word => {
    if (!word) return word;
    
    // Handle special cases like "O'Connor", "McDonald", "van der Berg"
    if (word.includes("'") || ['mc', 'mac', 'van', 'von', 'de', 'del', 'da', 'di', 'du', 'le', 'la'].includes(word.toLowerCase())) {
      // For names with apostrophes or common prefixes, capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    } else {
      // Regular capitalization
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
  });
  
  return capitalizedWords.join(' ');
}

/**
 * Event handler for input fields that automatically capitalizes names
 */
export function handleNameInputChange(
  e: React.ChangeEvent<HTMLInputElement>,
  setValue: (value: string) => void
): void {
  const input = e.target;
  const cursorPosition = input.selectionStart;
  const value = input.value;
  
  // Always update the value first to allow normal typing
  setValue(value);
  
  // Then capitalize in the next tick to avoid interfering with typing
  setTimeout(() => {
    const capitalizedValue = capitalizeName(value);
    if (capitalizedValue !== value) {
      setValue(capitalizedValue);
      
      // Restore cursor position after capitalization
      setTimeout(() => {
        if (input && input.focus) {
          input.focus();
          input.setSelectionRange(cursorPosition, cursorPosition);
        }
      }, 0);
    }
  }, 10);
}
