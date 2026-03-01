import os
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Certificate, QuizAttempt, Quiz, Course, User
from app.certificate_generator import CertificateGenerator
from app.utils import log_action

certificates_bp = Blueprint("certificates", __name__)


@certificates_bp.route("", methods=["GET"])
@jwt_required()
def list_certificates():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    # Admin/instructor can see all certificates
    if user.role in ("admin", "instructor"):
        certs = Certificate.query.order_by(Certificate.issued_at.desc()).all()
    else:
        certs = (
            Certificate.query.filter_by(user_id=user_id)
            .order_by(Certificate.issued_at.desc())
            .all()
        )

    cert_list = []
    for c in certs:
        d = c.to_dict()
        d["course_name"] = c.course.title if c.course else "Unknown Course"
        cert_list.append(d)

    return jsonify(cert_list), 200


@certificates_bp.route("/<cert_id>", methods=["GET"])
@jwt_required()
def get_certificate(cert_id):
    user_id = get_jwt_identity()
    cert = Certificate.query.filter_by(id=cert_id, user_id=user_id).first_or_404()
    return jsonify(cert.to_dict()), 200


@certificates_bp.route("/<cert_id>/download", methods=["GET"])
@jwt_required()
def download_certificate(cert_id):
    user_id = get_jwt_identity()
    cert = Certificate.query.filter_by(id=cert_id, user_id=user_id).first_or_404()

    if cert.pdf_path and os.path.exists(cert.pdf_path):
        return send_file(
            cert.pdf_path,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"certificate_{cert.certificate_number}.pdf",
        )

    # Regenerate if missing
    user = User.query.get(user_id)
    course = Course.query.get(cert.course_id)
    if not user or not course:
        return jsonify({"error": "Cannot regenerate certificate"}), 500

    issued_str = cert.issued_at.strftime("%B %d, %Y") if cert.issued_at else None
    pdf_path = CertificateGenerator.generate(
        full_name=user.full_name,
        course_title=course.title,
        score=cert.score,
        certificate_number=cert.certificate_number,
        date_str=issued_str,
    )
    cert.pdf_path = pdf_path
    db.session.commit()

    return send_file(
        pdf_path,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"certificate_{cert.certificate_number}.pdf",
    )


@certificates_bp.route("/generate", methods=["POST"])
@jwt_required()
def generate_certificate():
    """Generate certificate for a passed final exam."""
    user_id = get_jwt_identity()
    data = request.get_json()
    attempt_id = data.get("quiz_attempt_id")

    if not attempt_id:
        return jsonify({"error": "quiz_attempt_id is required"}), 400

    attempt = QuizAttempt.query.get(attempt_id)
    if not attempt or attempt.user_id != user_id:
        return jsonify({"error": "Quiz attempt not found"}), 404

    if not attempt.passed:
        return jsonify({"error": "You must pass the exam to earn a certificate"}), 400

    quiz = Quiz.query.get(attempt.quiz_id)
    if not quiz:
        return jsonify({"error": "Quiz not found"}), 404

    # Check for existing certificate
    existing = Certificate.query.filter_by(
        user_id=user_id, quiz_attempt_id=attempt_id
    ).first()
    if existing:
        return jsonify(existing.to_dict()), 200

    user = User.query.get(user_id)
    course = Course.query.get(quiz.course_id) if quiz.course_id else None
    course_title = course.title if course else quiz.title

    cert = Certificate(
        user_id=user_id,
        course_id=quiz.course_id,
        quiz_attempt_id=attempt_id,
        score=attempt.score,
    )
    db.session.add(cert)
    db.session.flush()  # get id + certificate_number

    pdf_path = CertificateGenerator.generate(
        student_name=user.full_name,
        course_title=course_title,
        score=attempt.score,
        certificate_number=cert.certificate_number,
        date=cert.issued_at,
    )
    cert.pdf_path = pdf_path
    db.session.commit()

    log_action(user_id, "generate_certificate", "certificate", cert.id)

    return jsonify(cert.to_dict()), 201
