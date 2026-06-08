import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.auth.security import get_current_user
from app.models import models
from app.models.database import get_db
from app.schemas.schemas import ProcessingResultResponse, IssueDetail
from app.utils.document_processor import DocumentProcessor

router = APIRouter(prefix="/services", tags=["services"])

@router.post("/format-check/{document_id}", response_model=ProcessingResultResponse)
def format_check(
    document_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    if document.file_type not in [".docx", ".pdf"]:
        raise HTTPException(status_code=400, detail="不支持的文件格式")
    
    if document.file_type == ".docx" and current_user.free_format_check_count <= 0:
        raise HTTPException(status_code=403, detail="今日免费格式检测次数已用完")
    
    processor = DocumentProcessor(document.file_path, document.file_type)
    issues = processor.analyze_format()
    
    fixed_count = sum(1 for issue in issues if issue["status"] == "已通过")
    total_count = len(issues)
    
    if document.file_type == ".docx":
        current_user.free_format_check_count -= 1
        current_user.format_check_total_count += 1
    
    result = models.ProcessingResult(
        document_id=document.id,
        service_type="format_check",
        total_issues=total_count,
        fixed_issues=fixed_count,
        result_data=json.dumps(issues),
        status="completed"
    )
    
    document.status = "processed"
    
    db.add(result)
    db.commit()
    db.refresh(result)
    
    return ProcessingResultResponse(
        id=result.id,
        document_id=result.document_id,
        service_type=result.service_type,
        total_issues=result.total_issues,
        fixed_issues=result.fixed_issues,
        issues=[IssueDetail(**issue) for issue in issues],
        status=result.status,
        processed_at=result.processed_at
    )

@router.post("/proofreading/{document_id}", response_model=ProcessingResultResponse)
def proofreading(
    document_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    if document.file_type not in [".docx", ".pdf"]:
        raise HTTPException(status_code=400, detail="不支持的文件格式")
    
    processor = DocumentProcessor(document.file_path, document.file_type)
    issues = processor.proofread_text()
    
    fixed_count = sum(1 for issue in issues if issue["status"] == "已通过")
    total_count = len(issues)
    
    result = models.ProcessingResult(
        document_id=document.id,
        service_type="proofreading",
        total_issues=total_count,
        fixed_issues=fixed_count,
        result_data=json.dumps(issues),
        status="completed"
    )
    
    document.status = "processed"
    
    db.add(result)
    db.commit()
    db.refresh(result)
    
    return ProcessingResultResponse(
        id=result.id,
        document_id=result.document_id,
        service_type=result.service_type,
        total_issues=result.total_issues,
        fixed_issues=result.fixed_issues,
        issues=[IssueDetail(**issue) for issue in issues],
        status=result.status,
        processed_at=result.processed_at
    )

@router.post("/text-processing/{document_id}")
def text_processing(
    document_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    if document.file_type not in [".docx", ".pdf"]:
        raise HTTPException(status_code=400, detail="不支持的文件格式")
    
    processor = DocumentProcessor(document.file_path, document.file_type)
    result_data = processor.process_text()
    
    result = models.ProcessingResult(
        document_id=document.id,
        service_type="text_processing",
        total_issues=0,
        fixed_issues=0,
        result_data=json.dumps(result_data),
        status="completed"
    )
    
    document.status = "processed"
    
    db.add(result)
    db.commit()
    db.refresh(result)
    
    return {
        "id": result.id,
        "document_id": result.document_id,
        "service_type": result.service_type,
        "processed_text": result_data["processed_text"],
        "improvements": result_data["improvements"],
        "original_length": result_data["original_length"],
        "processed_length": result_data["processed_length"],
        "status": result.status,
        "processed_at": result.processed_at
    }

@router.get("/results", response_model=list[ProcessingResultResponse])
def get_processing_results(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    results = db.query(models.ProcessingResult).join(models.Document).filter(
        models.Document.user_id == current_user.id
    ).order_by(models.ProcessingResult.processed_at.desc()).all()
    
    response = []
    for result in results:
        issues = []
        if result.result_data:
            try:
                data = json.loads(result.result_data)
                if isinstance(data, list):
                    issues = [IssueDetail(**issue) for issue in data]
            except:
                pass
        
        response.append(ProcessingResultResponse(
            id=result.id,
            document_id=result.document_id,
            service_type=result.service_type,
            total_issues=result.total_issues,
            fixed_issues=result.fixed_issues,
            issues=issues,
            status=result.status,
            processed_at=result.processed_at
        ))
    
    return response