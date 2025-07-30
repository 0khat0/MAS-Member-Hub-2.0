import uuid
from datetime import datetime
import pytz
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from database import Base

def generate_barcode():
    """Generate a unique 12-digit barcode for member identification"""
    import random
    # Generate a 12-digit number starting with 1 (to avoid leading zeros issues)
    return str(random.randint(100000000000, 999999999999))

class Member(Base):
    __tablename__ = "members"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, nullable=False, index=True)  # Removed unique=True to allow multiple members per email
    name = Column(String, nullable=False, index=True)
    barcode = Column(String, nullable=True, unique=True, index=True)  # Unique barcode for scanning
    active = Column(Boolean, default=True, index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)  # Soft delete support
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(pytz.UTC), index=True)
    checkins = relationship("Checkin", back_populates="member")
    
    # Composite indexes for common queries
    __table_args__ = (
        Index('idx_member_email_active', 'email', 'active'),
        Index('idx_member_created_active', 'created_at', 'active'),
        Index('idx_member_email_deleted', 'email', 'deleted_at'),  # For family queries
    )

class Checkin(Base):
    __tablename__ = "checkins"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_id = Column(UUID(as_uuid=True), ForeignKey("members.id"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(pytz.UTC), index=True)
    member = relationship("Member", back_populates="checkins")
    
    # Composite indexes for common queries
    __table_args__ = (
        Index('idx_checkin_member_timestamp', 'member_id', 'timestamp'),
        Index('idx_checkin_timestamp_desc', 'timestamp', postgresql_using='btree'),
        Index('idx_checkin_date', 'timestamp', postgresql_using='btree'),
    )

# Pydantic Schemas
class MemberBase(BaseModel):
    email: str
    name: str
    active: Optional[bool] = True

class MemberCreate(MemberBase):
    pass

class MemberUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None

class MemberOut(MemberBase):
    id: uuid.UUID
    barcode: Optional[str] = None
    created_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Family-specific schemas
class FamilyMemberCreate(BaseModel):
    name: str

class FamilyRegistration(BaseModel):
    email: str
    members: List[FamilyMemberCreate]

class FamilyCheckin(BaseModel):
    email: str
    member_names: List[str]  # Names of members to check in

class CheckinBase(BaseModel):
    email: str

class CheckinCreate(CheckinBase):
    pass

class CheckinOut(BaseModel):
    id: uuid.UUID
    member_id: uuid.UUID
    timestamp: datetime
    member: Optional[MemberOut]

    class Config:
        from_attributes = True 