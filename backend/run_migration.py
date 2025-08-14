#!/usr/bin/env python3
"""
Script to run the name capitalization migration
This will update all existing member names to have proper capitalization
"""

import sqlite3
import os
import sys

def capitalize_name(name):
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

def run_migration():
    """Run the name capitalization migration"""
    
    # Check if we're using SQLite or PostgreSQL
    db_path = "members.db"
    
    if os.path.exists(db_path):
        print("Running migration on SQLite database...")
        run_sqlite_migration(db_path)
    else:
        print("SQLite database not found. If you're using PostgreSQL, please run the SQL migration manually:")
        print("psql -d your_database -f migrations/20250116_capitalize_existing_names.sql")
        sys.exit(1)

def run_sqlite_migration(db_path):
    """Run migration on SQLite database"""
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get all member names
        cursor.execute("SELECT id, name FROM members WHERE name IS NOT NULL AND name != ''")
        members = cursor.fetchall()
        
        if not members:
            print("No members found in database.")
            return
        
        print(f"Found {len(members)} members. Checking for names that need capitalization...")
        
        updated_count = 0
        
        for member_id, current_name in members:
            capitalized_name = capitalize_name(current_name)
            
            if current_name != capitalized_name:
                print(f"Updating member {member_id}: '{current_name}' -> '{capitalized_name}'")
                
                cursor.execute(
                    "UPDATE members SET name = ? WHERE id = ?",
                    (capitalized_name, member_id)
                )
                updated_count += 1
        
        if updated_count > 0:
            conn.commit()
            print(f"\nMigration completed successfully! Updated {updated_count} member names.")
        else:
            print("\nNo names needed updating. All names are already properly capitalized.")
        
        conn.close()
        
    except Exception as e:
        print(f"Error running migration: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_migration()
