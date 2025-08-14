

def capitalize_name(name: str) -> str:
    """
    Capitalize the first letter of each word in a name.
    Handles common name formats and edge cases.
    """
    if not name or not isinstance(name, str):
        return name
    
    # Split by spaces and capitalize each word
    words = name.strip().split()
    capitalized_words = []
    
    for word in words:
        if word:
            # Handle special cases like "O'Connor", "McDonald", "van der Berg"
            if "'" in word or word.lower() in ['mc', 'mac', 'van', 'von', 'de', 'del', 'da', 'di', 'du', 'le', 'la']:
                # For names with apostrophes or common prefixes, capitalize first letter
                capitalized_words.append(word[0].upper() + word[1:].lower())
            else:
                # Regular capitalization
                capitalized_words.append(word.capitalize())
    
    return " ".join(capitalized_words)

