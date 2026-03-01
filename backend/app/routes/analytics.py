from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from app import db
from app.models import QuizAttempt, Quiz, Course, User, Roadmap, Certificate
from app.utils import role_required

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/student-progress", methods=["GET"])
@jwt_required()
def student_progress():
    """Get current student's learning progress."""
    user_id = get_jwt_identity()

    # Quiz history
    attempts = QuizAttempt.query.filter_by(user_id=user_id).order_by(
        QuizAttempt.started_at.desc()
    ).limit(20).all()

    scores = [a.score for a in attempts]
    avg_score = sum(scores) / len(scores) if scores else 0

    # Enrolled courses
    user = User.query.get(user_id)
    enrolled = [c.to_dict() for c in user.enrolled_courses]

    # Active roadmaps
    roadmaps = Roadmap.query.filter_by(user_id=user_id, is_active=True).all()

    # Certificates earned
    certs = Certificate.query.filter_by(user_id=user_id).all()

    # Current streak
    import json
    streak_dates = json.loads(user.streak_dates) if user.streak_dates else []

    return jsonify({
        "total_attempts": len(attempts),
        "avg_score": round(avg_score, 1),
        "recent_attempts": [a.to_dict() for a in attempts[:5]],
        "enrolled_courses": enrolled,
        "active_roadmaps": [r.to_dict() for r in roadmaps],
        "score_trend": scores[:10],
        "certificates_earned": len(certs),
        "streak_dates": streak_dates,
        "current_streak": _calculate_streak(streak_dates),
    }), 200


def _calculate_streak(dates: list) -> int:
    """Calculate current consecutive day streak."""
    if not dates:
        return 0
    from datetime import date, timedelta
    today = date.today().isoformat()
    sorted_dates = sorted(set(dates), reverse=True)
    streak = 0
    expected = date.today()
    for d in sorted_dates:
        if d == expected.isoformat():
            streak += 1
            expected -= timedelta(days=1)
        elif d == (date.today() - timedelta(days=1)).isoformat() and streak == 0:
            # Allow yesterday as start
            streak = 1
            expected = date.today() - timedelta(days=2)
        else:
            break
    return streak


@analytics_bp.route("/leaderboard", methods=["GET"])
@jwt_required()
def leaderboard():
    """Get top performing students (students only, no admins/instructors)."""
    top = db.session.query(
        User.id,
        User.full_name,
        User.username,
        User.avatar_url,
        func.avg(QuizAttempt.score).label("avg_score"),
        func.count(QuizAttempt.id).label("attempts"),
    ).join(QuizAttempt, User.id == QuizAttempt.user_id).filter(
        User.role == "student"
    ).group_by(
        User.id
    ).order_by(func.avg(QuizAttempt.score).desc()).limit(20).all()

    return jsonify([{
        "rank": idx + 1,
        "user_id": t.id,
        "full_name": t.full_name,
        "username": t.username,
        "avatar_url": t.avatar_url,
        "avg_score": round(t.avg_score, 1),
        "attempts": t.attempts,
    } for idx, t in enumerate(top)]), 200


@analytics_bp.route("/instructor-dashboard", methods=["GET"])
@role_required("admin", "instructor")
def instructor_dashboard():
    """Dashboard stats for instructors and admins."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    # Courses managed
    if user.role == "admin":
        courses = Course.query.all()
    else:
        courses = Course.query.filter_by(instructor_id=user_id).all()

    course_ids = [c.id for c in courses]

    # Total students enrolled
    total_students = set()
    for c in courses:
        for s in c.enrolled_students:
            total_students.add(s.id)

    # Quiz stats across managed courses
    from app.models import Quiz
    quizzes = Quiz.query.filter(Quiz.course_id.in_(course_ids)).all()
    quiz_ids = [q.id for q in quizzes]

    total_attempts = QuizAttempt.query.filter(QuizAttempt.quiz_id.in_(quiz_ids)).count() if quiz_ids else 0
    avg_score_result = db.session.query(func.avg(QuizAttempt.score)).filter(
        QuizAttempt.quiz_id.in_(quiz_ids)
    ).scalar() if quiz_ids else 0

    # Pending quizzes
    pending_count = Quiz.query.filter_by(approval_status="pending").count()

    return jsonify({
        "total_courses": len(courses),
        "total_students": len(total_students),
        "total_quizzes": len(quizzes),
        "total_attempts": total_attempts,
        "avg_score": round(float(avg_score_result or 0), 1),
        "pending_approvals": pending_count,
        "courses": [c.to_dict() for c in courses[:10]],
    }), 200
