from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import LicenseActivation
from app.utils import role_required, log_action

license_bp = Blueprint("license", __name__)


@license_bp.route("/activate", methods=["POST"])
@jwt_required()
def activate_license():
    """Activate a license key."""
    data = request.get_json()
    license_key = data.get("license_key", "").strip()
    machine_id = data.get("machine_id", "")
    user_id = get_jwt_identity()

    if not license_key:
        return jsonify({"error": "License key is required"}), 400

    valid_key = current_app.config.get("LICENSE_KEY", "")
    if license_key != valid_key:
        return jsonify({"error": "Invalid license key"}), 400

    # Check if already activated
    existing = LicenseActivation.query.filter_by(license_key=license_key, is_valid=True).first()
    if existing:
        return jsonify({"error": "License already activated", "activation": existing.to_dict()}), 409

    activation = LicenseActivation(
        license_key=license_key,
        activated_by=user_id,
        machine_id=machine_id,
        is_valid=True,
        expires_at=datetime.now(timezone.utc) + timedelta(days=365),
    )
    db.session.add(activation)
    db.session.commit()

    log_action(user_id, "activate_license", "license", activation.id)
    return jsonify({"message": "License activated", "activation": activation.to_dict()}), 201


@license_bp.route("/status", methods=["GET"])
@jwt_required()
def license_status():
    """Check current license status."""
    active = LicenseActivation.query.filter_by(is_valid=True).first()
    if active:
        is_expired = active.expires_at and active.expires_at < datetime.now(timezone.utc)
        return jsonify({
            "is_licensed": not is_expired,
            "activation": active.to_dict(),
            "is_expired": is_expired,
        }), 200

    return jsonify({"is_licensed": False, "activation": None}), 200


@license_bp.route("/deactivate", methods=["POST"])
@role_required("admin")
def deactivate_license():
    """Deactivate current license."""
    user_id = get_jwt_identity()
    active = LicenseActivation.query.filter_by(is_valid=True).first()
    if active:
        active.is_valid = False
        db.session.commit()
        log_action(user_id, "deactivate_license", "license", active.id)
        return jsonify({"message": "License deactivated"}), 200

    return jsonify({"error": "No active license found"}), 404
