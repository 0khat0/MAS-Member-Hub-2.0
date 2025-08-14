# Name Capitalization Feature

This update implements automatic name capitalization for all member names in the MAS Member Hub application.

## What This Feature Does

- **Auto-capitalizes names** as they are typed in input fields
- **Capitalizes existing names** in the database through a migration
- **Handles special cases** like "O'Connor", "McDonald", "van der Berg", etc.
- **Works across all components** where names are entered or edited

## Implementation Details

### Backend Changes

1. **Utility Function** (`backend/util/__init__.py`)
   - Added `capitalize_name()` function that handles proper name capitalization
   - Special handling for names with apostrophes and common prefixes

2. **API Endpoints Updated**
   - `/member` - Member creation
   - `/member/register-only` - Member registration
   - `/family/register` - Family registration
   - `/member/{member_id}` - Member updates

3. **Database Migration**
   - Created `backend/migrations/20250116_capitalize_existing_names.sql` for PostgreSQL
   - Created `backend/run_migration.py` for SQLite databases

### Frontend Changes

1. **Utility Functions** (`frontend/src/utils/nameUtils.ts`)
   - Added `capitalizeName()` function for consistent name formatting
   - Added `handleNameInputChange()` for input field handling with cursor position preservation

2. **Components Updated**
   - `MemberCheckin.tsx` - Main registration form
   - `HomeAuth.tsx` - Home authentication form
   - `InlineAuthGate.tsx` - Inline authentication component
   - `MemberStats.tsx` - Member profile editing
   - `AdminDashboard.tsx` - Admin member editing

## How to Apply the Changes

### For Development (SQLite)

1. **Run the migration script:**
   ```bash
   cd backend
   python run_migration.py
   ```

### For Production (PostgreSQL)

1. **Run the SQL migration:**
   ```bash
   psql -d your_database -f migrations/20250116_capitalize_existing_names.sql
   ```

### Frontend Updates

The frontend changes are automatically applied when you rebuild the application. All name input fields now automatically capitalize names as users type.

## Special Name Handling

The system intelligently handles various name formats:

- **Regular names**: "john doe" → "John Doe"
- **Names with apostrophes**: "o'connor" → "O'Connor"
- **Common prefixes**: "van der berg" → "Van Der Berg"
- **Mixed cases**: "McDonald" → "McDonald" (preserved)

## Benefits

1. **Consistent formatting** across all member names
2. **Professional appearance** in reports and displays
3. **Better user experience** with automatic formatting
4. **Data quality improvement** for existing and new members

## Testing

To test the feature:

1. **New members**: Try entering names in lowercase and verify they're automatically capitalized
2. **Existing members**: Run the migration and verify names are properly formatted
3. **Special cases**: Test names with apostrophes, prefixes, and mixed cases

## Rollback

If you need to rollback the changes:

1. **Backend**: Remove the `capitalize_name()` calls from the API endpoints
2. **Frontend**: Remove the `handleNameInputChange()` calls from input fields
3. **Database**: Names will remain capitalized but won't be automatically formatted for new entries

## Notes

- The migration is safe to run multiple times (idempotent)
- Cursor position is preserved during frontend auto-capitalization
- The feature works with both individual and family member registration
- All existing functionality remains unchanged
