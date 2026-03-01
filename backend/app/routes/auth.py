from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity
)
from app import db
from app.models import User, PasswordResetToken, QuizAttempt, Certificate, Roadmap, Course
from app.utils import (
    validate_required_fields, log_action, role_required,
    create_notification, generate_temp_password, generate_otp, paginate_query
)
from app.email_service import EmailService

auth_bp = Blueprint("auth", __name__)


# ── Registration ────────────────────────────────────────────────────

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    ok, err = validate_required_fields(data, ["username", "email", "password", "full_name"])
    if not ok:
        return jsonify({"error": err}), 400

    if User.query.filter_by(username=data["username"]).first():
        return jsonify({"error": "Username already taken"}), 409
    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already registered"}), 409

    if len(data["password"]) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    # Only students can self-register
    user = User(
        username=data["username"],
        email=data["email"],
        full_name=data["full_name"],
        role="student",
    )
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()

    log_action(user.id, "register", "user", user.id)

    # Send welcome email
    EmailService.send_welcome_student(user.email, user.full_name, "student")

    access_token = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)

    return jsonify({
        "message": "Registration successful",
        "user": user.to_dict(),
        "access_token": access_token,
        "refresh_token": refresh_token,
    }), 201


# ── Login ───────────────────────────────────────────────────────────

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    ok, err = validate_required_fields(data, ["username", "password"])
    if not ok:
        return jsonify({"error": err}), 400

    user = User.query.filter(
        (User.username == data["username"]) | (User.email == data["username"])
    ).first()

    if not user or not user.check_password(data["password"]):
        return jsonify({"error": "Invalid email or password. Please check your credentials and try again."}), 401

    if not user.is_active:
        return jsonify({"error": "Account is deactivated. Contact an administrator."}), 403

    # Record streak
    user.record_streak()
    db.session.commit()

    log_action(user.id, "login", "user", user.id)

    access_token = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)

    return jsonify({
        "message": "Login successful",
        "user": user.to_dict(),
        "access_token": access_token,
        "refresh_token": refresh_token,
    }), 200


# ── Token Refresh ───────────────────────────────────────────────────

@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    access_token = create_access_token(identity=user_id)
    return jsonify({"access_token": access_token}), 200


# ── Get Current User ───────────────────────────────────────────────

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": user.to_dict()}), 200


# ── Update Profile ──────────────────────────────────────────────────

@auth_bp.route("/me", methods=["PUT"])
@jwt_required()
def update_me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    if data.get("full_name"):
        user.full_name = data["full_name"]
    if data.get("email"):
        existing = User.query.filter_by(email=data["email"]).first()
        if existing and existing.id != user.id:
            return jsonify({"error": "Email already in use"}), 409
        user.email = data["email"]
    if data.get("bio") is not None:
        user.bio = data["bio"]
    if data.get("avatar_url") is not None:
        user.avatar_url = data["avatar_url"]
    if data.get("password"):
        if len(data["password"]) < 6:
            return jsonify({"error": "Password must be at least 6 characters"}), 400
        user.set_password(data["password"])

    db.session.commit()
    log_action(user.id, "update_profile", "user", user.id)

    return jsonify({"user": user.to_dict()}), 200


# ── Full Profile with Stats ────────────────────────────────────────

@auth_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    """Get comprehensive user profile with stats."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    import json
    from sqlalchemy import func

    profile = user.to_dict()
    profile["bio"] = user.bio
    profile["streak_dates"] = json.loads(user.streak_dates) if user.streak_dates else []

    # Enrolled courses
    profile["enrolled_courses"] = [c.to_dict() for c in user.enrolled_courses]

    # Courses created (instructor/admin)
    if user.role in ("instructor", "admin"):
        created = Course.query.filter_by(instructor_id=user.id).all()
        profile["courses_created"] = [c.to_dict() for c in created]

    # Quiz performance summary
    attempts = QuizAttempt.query.filter_by(user_id=user.id).all()
    scores = [a.score for a in attempts]
    profile["quiz_stats"] = {
        "total_attempts": len(attempts),
        "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
        "best_score": round(max(scores), 1) if scores else 0,
        "total_passed": sum(1 for a in attempts if a.passed),
    }

    # Active roadmaps
    active_roadmaps = Roadmap.query.filter_by(user_id=user.id, is_active=True).all()
    profile["active_roadmaps"] = [r.to_dict() for r in active_roadmaps]

    # Certificates earned
    certs = Certificate.query.filter_by(user_id=user.id).order_by(Certificate.issued_at.desc()).all()
    profile["certificates"] = [c.to_dict() for c in certs]

    return jsonify(profile), 200


# ── Forgot Password ────────────────────────────────────────────────

@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    """Request a password reset OTP/token."""
    data = request.get_json()
    email = data.get("email", "").strip()
    if not email:
        return jsonify({"error": "Email is required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "If this email is registered, a reset code has been sent."}), 200

    otp = generate_otp()
    reset_token = PasswordResetToken(
        user_id=user.id,
        otp=otp,
    )
    db.session.add(reset_token)
    db.session.commit()

    EmailService.send_password_reset(user.email, user.full_name, otp, reset_token.token)

    return jsonify({
        "message": "If this email is registered, a reset code has been sent.",
        "reset_token": reset_token.token,  # Dev mode only
    }), 200


# ── Reset Password ─────────────────────────────────────────────────

@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    """Reset password using OTP or token."""
    data = request.get_json()
    token = data.get("token", "").strip()
    otp = data.get("otp", "").strip()
    new_password = data.get("new_password", "")

    if not token:
        return jsonify({"error": "Reset token is required"}), 400
    if not new_password or len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    reset = PasswordResetToken.query.filter_by(token=token, is_used=False).first()
    if not reset:
        return jsonify({"error": "Invalid or expired reset token"}), 400

    if reset.is_expired:
        return jsonify({"error": "Reset token has expired"}), 400

    if otp and reset.otp and reset.otp != otp:
        return jsonify({"error": "Invalid OTP code"}), 400

    user = User.query.get(reset.user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    user.set_password(new_password)
    reset.is_used = True
    db.session.commit()

    log_action(user.id, "password_reset", "user", user.id)

    return jsonify({"message": "Password reset successfully. You can now login."}), 200


# ── Admin: Reset User Password ─────────────────────────────────────

@auth_bp.route("/admin-reset-password", methods=["POST"])
@role_required("admin")
def admin_reset_password():
    """Admin resets a user's password."""
    data = request.get_json()
    user_id = data.get("user_id")
    new_password = data.get("new_password", "").strip()

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if not new_password:
        new_password = generate_temp_password()

    if len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    user.set_password(new_password)
    db.session.commit()

    admin_id = get_jwt_identity()
    log_action(admin_id, "admin_reset_password", "user", user.id)

    create_notification(
        user.id,
        "Password Reset",
        "Your password was reset by an administrator. Please change it after logging in.",
        "system",
    )

    return jsonify({"message": "Password reset successfully", "temp_password": new_password}), 200


# ── Admin: Create Instructor ───────────────────────────────────────

@auth_bp.route("/create-instructor", methods=["POST"])
@role_required("admin")
def create_instructor():
    """Only admin can create instructor accounts."""
    data = request.get_json()
    ok, err = validate_required_fields(data, ["username", "email", "full_name"])
    if not ok:
        return jsonify({"error": err}), 400

    if User.query.filter_by(username=data["username"]).first():
        return jsonify({"error": "Username already taken"}), 409
    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already registered"}), 409

    temp_password = generate_temp_password()

    user = User(
        username=data["username"],
        email=data["email"],
        full_name=data["full_name"],
        role="instructor",
    )
    user.set_password(temp_password)
    db.session.add(user)
    db.session.commit()

    admin_id = get_jwt_identity()
    log_action(admin_id, "create_instructor", "user", user.id, user.full_name)

    EmailService.send_welcome_instructor(user.email, user.full_name, user.username, temp_password)

    return jsonify({
        "message": "Instructor account created",
        "user": user.to_dict(),
        "temp_password": temp_password,
    }), 201
