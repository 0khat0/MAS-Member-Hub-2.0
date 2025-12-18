import os
import shutil
import zipfile
import json
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class MemberHubBackup:
    def __init__(self):
        self.backup_folder = "backups"
        self.ensure_backup_folder()
        
    def ensure_backup_folder(self):
        """Create backups folder if it doesn't exist"""
        if not os.path.exists(self.backup_folder):
            os.makedirs(self.backup_folder)
            print(f"📁 Created backup folder: {self.backup_folder}")
    
    def create_backup(self):
        """Create a complete backup of your member hub"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        print(f"🔄 Creating backup for {timestamp}...")
        
        try:
            # 1. Backup the database (export all data as JSON)
            db_backup = self.backup_database(timestamp)
            
            # 2. Create zip with everything
            zip_path = f"{self.backup_folder}/member_hub_backup_{timestamp}.zip"
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                # Add database backup
                zipf.write(db_backup, "database/members_data.json")
                
                # Add important code files
                code_files = ["models.py", "main.py", "database.py", "requirements.txt"]
                for file in code_files:
                    if os.path.exists(file):
                        zipf.write(file, f"code/{file}")
                
                # Add environment file (if exists)
                if os.path.exists(".env"):
                    zipf.write(".env", "config/.env")
                
                # Add migration files
                if os.path.exists("migrations"):
                    for root, dirs, files in os.walk("migrations"):
                        for file in files:
                            file_path = os.path.join(root, file)
                            zipf.write(file_path, f"migrations/{file}")
            
            # 3. Clean up temporary files
            os.remove(db_backup)
            
            # 4. Clean old backups (keep last 7 days)
            self.cleanup_old_backups()
            
            print(f"✅ Complete backup created: {zip_path}")
            return zip_path
            
        except Exception as e:
            print(f"❌ Backup failed: {e}")
            return None
    
    def backup_database(self, timestamp):
        """Export all database data to JSON"""
        DATABASE_URL = os.getenv("DATABASE_URL")
        if not DATABASE_URL:
            raise Exception("DATABASE_URL not found")
        
        engine = create_engine(DATABASE_URL)
        backup_data = {}
        
        with engine.connect() as connection:
            # Get all households
            # Explicit column list to remain stable across schema changes
            result = connection.execute(text("SELECT id, owner_email, household_code, created_at FROM households"))
            households = []
            for row in result:
                households.append({
                    'id': str(row[0]),
                    'owner_email': row[1],
                    'household_code': row[2],
                    'created_at': str(row[3])
                })
            backup_data['households'] = households
            
            # Get all members
            result = connection.execute(text("SELECT * FROM members"))
            members = []
            for row in result:
                members.append({
                    'id': str(row[0]),
                    'email': row[1],
                    'name': row[2],
                    'barcode': row[3],
                    'active': row[4],
                    'deleted_at': str(row[5]) if row[5] else None,
                    'created_at': str(row[6]),
                    'household_id': str(row[7]) if row[7] else None
                })
            backup_data['members'] = members
            
            # Get all checkins
            result = connection.execute(text("SELECT * FROM checkins"))
            checkins = []
            for row in result:
                checkins.append({
                    'id': str(row[0]),
                    'member_id': str(row[1]),
                    'timestamp': str(row[2])
                })
            backup_data['checkins'] = checkins
        
        # Save to JSON file
        json_path = f"{self.backup_folder}/temp_db_backup_{timestamp}.json"
        with open(json_path, 'w') as f:
            json.dump(backup_data, f, indent=2)
        
        print(f"�� Database exported: {len(households)} households, {len(members)} members, {len(checkins)} checkins")
        return json_path
    
    def restore_from_backup(self, backup_filename):
        """Restore your system from a backup file"""
        backup_path = f"{self.backup_folder}/{backup_filename}"
        
        if not os.path.exists(backup_path):
            print(f"❌ Backup file not found: {backup_filename}")
            return False
        
        print(f"🔄 Restoring from backup: {backup_filename}")
        print("⚠️  IMPORTANT: This will OVERWRITE your current data!")
        
        # Confirm restoration
        confirm = input("Type 'YES' to confirm you want to restore: ")
        if confirm != "YES":
            print("❌ Restoration cancelled")
            return False
        
        try:
            # Extract the backup
            with zipfile.ZipFile(backup_path, 'r') as zipf:
                # Extract database backup
                zipf.extract("database/members_data.json", "temp_restore")
                
                # Extract code files
                zipf.extractall("temp_restore")
            
            # Restore the database
            self.restore_database("temp_restore/database/members_data.json")
            
            # Clean up temp files
            shutil.rmtree("temp_restore")
            
            print("✅ Restoration completed successfully!")
            print("🚀 You can now restart your backend server!")
            return True
            
        except Exception as e:
            print(f"❌ Restoration failed: {e}")
            return False
    
    def restore_database(self, json_file_path):
        """Restore database from JSON backup"""
        DATABASE_URL = os.getenv("DATABASE_URL")
        if not DATABASE_URL:
            raise Exception("DATABASE_URL not found")
        
        # Load backup data
        with open(json_file_path, 'r') as f:
            backup_data = json.load(f)
        
        engine = create_engine(DATABASE_URL)
        
        with engine.begin() as connection:
            # Clear existing data
            connection.execute(text("DELETE FROM checkins"))
            connection.execute(text("DELETE FROM members"))
            connection.execute(text("DELETE FROM households"))
            
            # Restore households
            for household in backup_data['households']:
                connection.execute(text("""
                    INSERT INTO households (id, owner_email, household_code, created_at)
                    VALUES (:id, :owner_email, :household_code, :created_at)
                """), household)
            
            # Restore members
            for member in backup_data['members']:
                connection.execute(text("""
                    INSERT INTO members (id, email, name, barcode, active, deleted_at, created_at, household_id)
                    VALUES (:id, :email, :name, :barcode, :active, :deleted_at, :created_at, :household_id)
                """), member)
            
            # Restore checkins
            for checkin in backup_data['checkins']:
                connection.execute(text("""
                    INSERT INTO checkins (id, member_id, timestamp)
                    VALUES (:id, :member_id, :timestamp)
                """), checkin)
        
        print(f"✅ Database restored: {len(backup_data['households'])} households, {len(backup_data['members'])} members, {len(backup_data['checkins'])} checkins")
    
    def cleanup_old_backups(self):
        """Remove backups older than 7 days"""
        current_time = datetime.now()
        
        for filename in os.listdir(self.backup_folder):
            if filename.startswith("member_hub_backup_"):
                file_path = os.path.join(self.backup_folder, filename)
                
                # Get file modification time
                file_time = datetime.fromtimestamp(os.path.getmtime(file_path))
                days_old = (current_time - file_time).days
                
                if days_old > 7:
                    os.remove(file_path)
                    print(f"🗑️  Removed old backup: {filename}")
    
    def list_backups(self):
        """Show all available backups"""
        backups = []
        for filename in os.listdir(self.backup_folder):
            if filename.startswith("member_hub_backup_"):
                file_path = os.path.join(self.backup_folder, filename)
                size = os.path.getsize(file_path) / (1024 * 1024)  # Size in MB
                modified = datetime.fromtimestamp(os.path.getmtime(file_path))
                backups.append({
                    'filename': filename,
                    'size': size,
                    'modified': modified
                })
        
        if not backups:
            print("📁 No backups found")
            return
        
        print("📁 Available backups:")
        for backup in sorted(backups, key=lambda x: x['modified'], reverse=True):
            print(f"  📦 {backup['filename']}")
            print(f"     Size: {backup['size']:.1f} MB")
            print(f"     Created: {backup['modified'].strftime('%Y-%m-%d %H:%M')}")
            print()

def main():
    backup_system = MemberHubBackup()
    
    print("🔐 MAS Member Hub - Complete Backup System")
    print("=" * 50)
    
    while True:
        print("\nWhat would you like to do?")
        print("1. Create backup")
        print("2. List backups")
        print("3. Restore from backup")
        print("4. Exit")
        
        choice = input("\nEnter your choice (1-4): ")
        
        if choice == "1":
            backup_system.create_backup()
        elif choice == "2":
            backup_system.list_backups()
        elif choice == "3":
            backup_system.list_backups()
            backup_name = input("\nEnter backup filename to restore: ")
            backup_system.restore_from_backup(backup_name)
        elif choice == "4":
            print("👋 Goodbye!")
            break
        else:
            print("❌ Invalid choice. Please try again.")

if __name__ == "__main__":
    main()
