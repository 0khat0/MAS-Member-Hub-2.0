-- Migration to capitalize existing member names
-- This migration will update all existing member names to have proper capitalization

-- Create a function to capitalize names (similar to the Python utility)
CREATE OR REPLACE FUNCTION capitalize_name(input_name TEXT) RETURNS TEXT AS $$
DECLARE
    word TEXT;
    result TEXT := '';
    first_word BOOLEAN := TRUE;
BEGIN
    -- Handle null or empty names
    IF input_name IS NULL OR input_name = '' THEN
        RETURN input_name;
    END IF;
    
    -- Split by spaces and capitalize each word
    FOR word IN SELECT unnest(string_to_array(trim(input_name), ' '))
    LOOP
        IF word != '' THEN
            -- Handle special cases like "O'Connor", "McDonald", "van der Berg"
            IF position('''' IN word) > 0 OR lower(word) IN ('mc', 'mac', 'van', 'von', 'de', 'del', 'da', 'di', 'du', 'le', 'la') THEN
                -- For names with apostrophes or common prefixes, capitalize first letter
                word := upper(substring(word, 1, 1)) || lower(substring(word, 2));
            ELSE
                -- Regular capitalization
                word := initcap(word);
            END IF;
            
            -- Add space before word (except for first word)
            IF first_word THEN
                result := word;
                first_word := FALSE;
            ELSE
                result := result || ' ' || word;
            END IF;
        END IF;
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update all existing member names
UPDATE members 
SET name = capitalize_name(name) 
WHERE name != capitalize_name(name);

-- Drop the temporary function
DROP FUNCTION capitalize_name(TEXT);
