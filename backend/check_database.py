import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def check_railway_database():
    """Check what's actually in your Railway PostgreSQL database"""
    
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        print("❌ DATABASE_URL not found in .env file")
        return
    
    # Safely show connection info (hide password)
    try:
        if '@' in DATABASE_URL:
            connection_info = DATABASE_URL.split('@')[1]
        else:
            connection_info = "Railway PostgreSQL"
        print(f"🔗 Connecting to: {connection_info}")
    except:
        print("🔗 Connecting to Railway PostgreSQL...")
    
    try:
        # Create engine
        engine = create_engine(DATABASE_URL)
        
        with engine.connect() as connection:
            # Check households
            result = connection.execute(text("SELECT COUNT(*) FROM households"))
            household_count = result.scalar()
            print(f" Households: {household_count}")
            
            # Check members
            result = connection.execute(text("SELECT COUNT(*) FROM members"))
            member_count = result.scalar()
            print(f"👥 Members: {member_count}")
            
            # Check checkins
            result = connection.execute(text("SELECT COUNT(*) FROM checkins"))
            checkin_count = result.scalar()
            print(f"✅ Check-ins: {checkin_count}")
            
            # Show some sample data
            print("\n📊 Sample Data:")
            
            # Sample households
            result = connection.execute(text("SELECT household_code, owner_email, created_at FROM households LIMIT 3"))
            print("\n🏠 Sample Households:")
            for row in result:
                print(f"  Code: {row[0]}, Email: {row[1]}, Created: {row[2]}")
            
            # Sample members
            result = connection.execute(text("SELECT name, email, active, created_at FROM members LIMIT 5"))
            print("\n Sample Members:")
            for row in result:
                print(f"  {row[0]} ({row[1]}) - Active: {row[2]}, Created: {row[3]}")
            
            # Recent checkins
            result = connection.execute(text("SELECT m.name, c.timestamp FROM checkins c JOIN members m ON c.member_id = m.id ORDER BY c.timestamp DESC LIMIT 5"))
            print("\n✅ Recent Check-ins:")
            for row in result:
                print(f"  {row[0]} - {row[1]}")
                
    except Exception as e:
        print(f"❌ Error connecting to database: {e}")

if __name__ == "__main__":
    print("🔍 Checking Your Railway Database...")
    print("=" * 50)
    check_railway_database()
