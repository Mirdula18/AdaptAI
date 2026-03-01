from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import User, Course, Quiz, QuizAttempt, Material, AuditLog, Roadmap
from app.utils import role_required, paginate_query

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/dashboard", methods=["GET"])
@role_required("admin", "instructor")
def dashboard_stats():
    """Get dashboard statistics for admin/instructor."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    stats = {
        "total_students": User.query.filter_by(role="student").count(),
        "total_instructors": User.query.filter_by(role="instructor").count(),
        "total_courses": Course.query.count(),
        "published_courses": Course.query.filter_by(is_published=True).count(),
        "total_quizzes": Quiz.query.count(),
        "total_attempts": QuizAttempt.query.count(),
        "total_materials": Material.query.count(),
        "total_roadmaps": Roadmap.query.count(),
    }

    # Average quiz score
    from sqlalchemy import func
    avg_score = db.session.query(func.avg(QuizAttempt.score)).scalar()
    stats["avg_quiz_score"] = round(avg_score, 1) if avg_score else 0

    # Recent quiz pass rate (score >= 60)
    total_attempts = QuizAttempt.query.count()
    passed = QuizAttempt.query.filter(QuizAttempt.score >= 60).count()
    stats["pass_rate"] = round((passed / total_attempts * 100), 1) if total_attempts > 0 else 0

    # If instructor, scope some stats
    if user.role == "instructor":
        my_courses = Course.query.filter_by(instructor_id=user_id).count()
        stats["my_courses"] = my_courses

    return jsonify(stats), 200


@admin_bp.route("/quiz-analytics", methods=["GET"])
@role_required("admin", "instructor")
def quiz_analytics():
    """Get quiz performance analytics."""
    from sqlalchemy import func

    # Scores by quiz
    quiz_stats = db.session.query(
        Quiz.id,
        Quiz.title,
        func.count(QuizAttempt.id).label("attempts"),
        func.avg(QuizAttempt.score).label("avg_score"),
        func.min(QuizAttempt.score).label("min_score"),
        func.max(QuizAttempt.score).label("max_score"),
    ).join(QuizAttempt, Quiz.id == QuizAttempt.quiz_id).group_by(Quiz.id).all()

    results = []
    for qs in quiz_stats:
        results.append({
            "quiz_id": qs.id,
            "quiz_title": qs.title,
            "attempts": qs.attempts,
            "avg_score": round(qs.avg_score, 1) if qs.avg_score else 0,
            "min_score": round(qs.min_score, 1) if qs.min_score else 0,
            "max_score": round(qs.max_score, 1) if qs.max_score else 0,
        })

    return jsonify(results), 200


@admin_bp.route("/user-activity", methods=["GET"])
@role_required("admin")
def user_activity():
    """Get recent user activity from audit logs."""
    query = AuditLog.query

    user_id = request.args.get("user_id")
    action = request.args.get("action")
    if user_id:
        query = query.filter_by(user_id=user_id)
    if action:
        query = query.filter_by(action=action)

    return jsonify(paginate_query(query.order_by(AuditLog.timestamp.desc()))), 200


@admin_bp.route("/audit-logs", methods=["GET"])
@role_required("admin")
def audit_logs():
    """View all audit logs."""
    query = AuditLog.query

    resource_type = request.args.get("resource_type")
    if resource_type:
        query = query.filter_by(resource_type=resource_type)

    return jsonify(paginate_query(query.order_by(AuditLog.timestamp.desc()))), 200


@admin_bp.route("/completion-stats", methods=["GET"])
@role_required("admin", "instructor")
def completion_stats():
    """Get course completion statistics."""
    courses = Course.query.all()
    stats = []

    for c in courses:
        enrolled = len(c.enrolled_students)
        # Count students who completed at least one quiz for this course
        from sqlalchemy import func
        quiz_ids = [q.id for q in c.quizzes.all()]
        if quiz_ids:
            students_attempted = db.session.query(
                func.count(func.distinct(QuizAttempt.user_id))
            ).filter(QuizAttempt.quiz_id.in_(quiz_ids)).scalar() or 0
        else:
            students_attempted = 0

        stats.append({
            "course_id": c.id,
            "course_title": c.title,
            "enrolled": enrolled,
            "students_attempted_quiz": students_attempted,
            "completion_rate": round((students_attempted / enrolled * 100), 1) if enrolled > 0 else 0,
        })

    return jsonify(stats), 200


@admin_bp.route("/export/attempts", methods=["GET"])
@role_required("admin", "instructor")
def export_attempts():
    """Export quiz attempts as CSV."""
    import csv
    import io
    from flask import Response

    attempts = QuizAttempt.query.order_by(QuizAttempt.started_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Attempt ID", "User", "Quiz", "Score", "Total Questions",
                      "Correct", "Duration (s)", "Started At", "Completed At"])

    for a in attempts:
        user = User.query.get(a.user_id)
        quiz = Quiz.query.get(a.quiz_id)
        writer.writerow([
            a.id,
            user.username if user else "Unknown",
            quiz.title if quiz else "Unknown",
            a.score,
            a.total_questions,
            a.correct_answers,
            a.duration_seconds or "",
            a.started_at.isoformat() if a.started_at else "",
            a.completed_at.isoformat() if a.completed_at else "",
        ])

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=quiz_attempts.csv"},
    )
