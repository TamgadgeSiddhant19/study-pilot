from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, or_

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get("", response_model=List[TaskResponse])
async def list_tasks(
    response: Response,
    status_filter: Optional[str] = Query(None, alias="status"),
    priority_filter: Optional[str] = Query(None, alias="priority"),
    completed: Optional[bool] = None,
    due_date: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List tasks belonging strictly to the authenticated user with optional filters, search, and pagination."""
    query = select(Task).where(Task.user_id == current_user.id)

    if status_filter:
        query = query.where(Task.status == status_filter)
    if priority_filter:
        query = query.where(Task.priority == priority_filter)
    if completed is not None:
        query = query.where(Task.completed == completed)
    if due_date:
        query = query.where(Task.due_date == due_date)
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                Task.title.ilike(search_pattern),
                Task.subject.ilike(search_pattern),
            )
        )

    # Count total matching for this user before pagination
    count_query = select(func.count()).select_from(query.subquery())
    total_count = await db.scalar(count_query) or 0
    response.headers["X-Total-Count"] = str(total_count)

    # Order and paginate
    query = query.order_by(Task.order_index, Task.id.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_in: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new study task assigned to the authenticated user."""
    task_data = task_in.model_dump()
    task = Task(**task_data)
    task.user_id = current_user.id

    if task.completed:
        task.status = "completed"
        task.completed_at = datetime.now(timezone.utc)

    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve a single task strictly belonging to the authenticated user."""
    stmt = select(Task).where(Task.id == task_id, Task.user_id == current_user.id)
    task = (await db.execute(stmt)).scalar_one_or_none()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found",
        )
    return task


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    task_in: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Partially update an existing task owned by the authenticated user."""
    stmt = select(Task).where(Task.id == task_id, Task.user_id == current_user.id)
    task = (await db.execute(stmt)).scalar_one_or_none()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found",
        )

    update_data = task_in.model_dump(exclude_unset=True)
    if "completed" in update_data:
        task.completed = update_data["completed"]
        if task.completed:
            task.status = "completed"
            task.completed_at = datetime.now(timezone.utc)
        else:
            task.status = "todo"
            task.completed_at = None

    for field, val in update_data.items():
        if field != "completed":
            setattr(task, field, val)

    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a task owned by the authenticated user."""
    stmt = select(Task).where(Task.id == task_id, Task.user_id == current_user.id)
    task = (await db.execute(stmt)).scalar_one_or_none()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found",
        )
    await db.delete(task)
    await db.commit()
    return None


@router.post("/carry-forward", response_model=List[TaskResponse])
async def carry_forward_unfinished(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Carries forward uncompleted tasks for the authenticated user to Today's schedule."""
    stmt = (
        update(Task)
        .where(Task.user_id == current_user.id, Task.completed == False)
        .values(due_date="Today", status="todo", updated_at=datetime.now(timezone.utc))
    )
    await db.execute(stmt)
    await db.commit()

    result = await db.execute(
        select(Task)
        .where(Task.user_id == current_user.id, Task.completed == False)
        .order_by(Task.id)
    )
    return result.scalars().all()
