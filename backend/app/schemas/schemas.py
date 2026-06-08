from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    free_format_check_count: int
    format_check_total_count: int

    model_config = {"from_attributes": True}

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class DocumentCreate(BaseModel):
    filename: str
    file_type: str

class DocumentResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}

class IssueDetail(BaseModel):
    page: Optional[int] = None
    line: Optional[int] = None
    issue_type: str
    description: str
    suggestion: str
    status: str

class ProcessingResultResponse(BaseModel):
    id: int
    document_id: int
    service_type: str
    total_issues: int
    fixed_issues: int
    issues: List[IssueDetail]
    status: str
    processed_at: datetime

    model_config = {"from_attributes": True}

class ServiceRequest(BaseModel):
    service_type: str
    document_id: int