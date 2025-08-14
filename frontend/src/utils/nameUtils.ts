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
  
  // Don't trim - preserve all spaces including leading/trailing
  const words = name.split(' ');
  const capitalizedWords = words.map(word => {
    if (!word) return word; // Preserve empty strings (spaces)
    
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
  const value = input.value;
  
  // Update the value immediately to allow normal typing
  setValue(value);
  
  // Only capitalize when the user finishes typing (on blur or when they stop typing)
  // This prevents interference with normal typing including spaces
  if (value.endsWith(' ') || value === '') {
    // User just typed a space or cleared the field, don't capitalize yet
    return;
  }
  
  // Apply capitalization after a short delay
  setTimeout(() => {
    const capitalizedValue = capitalizeName(value);
    if (capitalizedValue !== value) {
      setValue(capitalizedValue);
    }
  }, 100);
}
