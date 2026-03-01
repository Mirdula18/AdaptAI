from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import User
from app.utils import role_required, log_action, paginate_query

users_bp = Blueprint("users", __name__)


@users_bp.route("", methods=["GET"])
@role_required("admin", "instructor")
def list_users():
    query = User.query
    role = request.args.get("role")
    search = request.args.get("search")

    if role:
        query = query.filter_by(role=role)
    if search:
        query = query.filter(
            (User.username.ilike(f"%{search}%")) |
            (User.full_name.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%"))
        )

    return jsonify(paginate_query(query.order_by(User.created_at.desc()))), 200


@users_bp.route("/<user_id>", methods=["GET"])
@role_required("admin", "instructor")
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    data = user.to_dict()
    data["enrolled_courses"] = [c.to_dict() for c in user.enrolled_courses]
    data["quiz_attempts_count"] = user.quiz_attempts.count()
    data["roadmaps_count"] = user.roadmaps.count()
    return jsonify(data), 200


@users_bp.route("/<user_id>", methods=["PUT"])
@role_required("admin")
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    admin_id = get_jwt_identity()
    data = request.get_json()

    if "role" in data:
        user.role = data["role"]
    if "is_active" in data:
        user.is_active = data["is_active"]
    if "full_name" in data:
        user.full_name = data["full_name"]
    if "email" in data:
        user.email = data["email"]
    if "password" in data:
        user.set_password(data["password"])

    db.session.commit()
    log_action(admin_id, "update_user", "user", user_id)
    return jsonify(user.to_dict()), 200


@users_bp.route("/<user_id>", methods=["DELETE"])
@role_required("admin")
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    admin_id = get_jwt_identity()

    if user.role == "admin":
        admin_count = User.query.filter_by(role="admin").count()
        if admin_count <= 1:
            return jsonify({"error": "Cannot delete the last admin"}), 400

    db.session.delete(user)
    db.session.commit()

    log_action(admin_id, "delete_user", "user", user_id)
    return jsonify({"message": "User deleted"}), 200
