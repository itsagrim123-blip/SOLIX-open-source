import secrets
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from app.core.config import settings

security = HTTPBasic(auto_error=False)


def verify_dashboard_access(credentials: Optional[HTTPBasicCredentials] = Depends(security)) -> bool:
    """
    Verify access to the backend dashboard.
    If DASHBOARD_USERNAME and DASHBOARD_PASSWORD are configured, enforces HTTP Basic Auth.
    If not configured, dashboard is accessible freely (standard for local/private setups).
    """
    if not settings.DASHBOARD_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solix Backend Dashboard is disabled.",
        )

    expected_user = settings.DASHBOARD_USERNAME
    expected_pass = settings.DASHBOARD_PASSWORD

    # If no credentials set in environment, allow open access
    if not expected_user or not expected_pass:
        return True

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to view Solix Backend Dashboard.",
            headers={"WWW-Authenticate": "Basic realm=\"Solix Dashboard\""},
        )

    is_user_correct = secrets.compare_digest(credentials.username, expected_user)
    is_pass_correct = secrets.compare_digest(credentials.password, expected_pass)

    if not (is_user_correct and is_pass_correct):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials for Solix Backend Dashboard.",
            headers={"WWW-Authenticate": "Basic realm=\"Solix Dashboard\""},
        )

    return True

