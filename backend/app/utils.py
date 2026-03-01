import json
import random
import string
import functools
from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from app.models import User, AuditLog, Notification
from app import db


def role_required(*roles):
    """Decorator to restrict endpoint access by role."""
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.get(user_id)
            if not user or not user.is_active:
                return jsonify({"error": "User not found or inactive"}), 403
            if user.role not in roles:
                return jsonify({"error": "Insufficient permissions"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def log_action(user_id, action, resource_type=None, resource_id=None, details=None):
    """Record an action in the audit log."""
    log = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=request.remote_addr if request else None,
    )
    db.session.add(log)
    db.session.commit()


def create_notification(user_id, title, message, notification_type="system", link=None):
    """Create an in-app notification for a user."""
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link,
    )
    db.session.add(notif)
    db.session.commit()
    return notif


def generate_temp_password(length=10):
    """Generate a random temporary password."""
    chars = string.ascii_letters + string.digits + "!@#$"
    return ''.join(random.choice(chars) for _ in range(length))


def generate_otp(length=6):
    """Generate a numeric OTP."""
    return ''.join(random.choice(string.digits) for _ in range(length))


def validate_required_fields(data, fields):
    """Validate that required fields are present in request data."""
    missing = [f for f in fields if not data.get(f)]
    if missing:
        return False, f"Missing required fields: {', '.join(missing)}"
    return True, None


def paginate_query(query, page=None, per_page=None):
    """Apply pagination to a query."""
    if page is None:
        page = request.args.get("page", 1, type=int)
    if per_page is None:
        per_page = request.args.get("per_page", 20, type=int)
    per_page = min(per_page, 100)

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return {
        "items": [item.to_dict() for item in pagination.items],
        "total": pagination.total,
        "page": pagination.page,
        "per_page": pagination.per_page,
        "pages": pagination.pages,
    }


def safe_json_loads(text, default=None):
    """Safely parse JSON string."""
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return default if default is not None else {}
