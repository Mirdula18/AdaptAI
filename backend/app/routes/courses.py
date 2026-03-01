from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Course, Topic, User, Quiz, QuizAttempt, Certificate, Roadmap
from app.utils import role_required, log_action, validate_required_fields, paginate_query

courses_bp = Blueprint("courses", __name__)


@courses_bp.route("", methods=["GET"])
@jwt_required()
def list_courses():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    query = Course.query

    # Students see only published courses
    if user.role == "student":
        query = query.filter_by(is_published=True)
    elif user.role == "instructor":
        query = query.filter(
            (Course.instructor_id == user_id) | (Course.is_published == True)
        )

    search = request.args.get("search")
    if search:
        query = query.filter(Course.title.ilike(f"%{search}%"))

    result = paginate_query(query.order_by(Course.created_at.desc()))

    # Add is_enrolled flag for students so frontend can show correct button state
    if user.role == "student":
        enrolled_course_ids = {c.id for c in user.enrolled_courses}
        for item in result["items"]:
            item["is_enrolled"] = item["id"] in enrolled_course_ids

    return jsonify(result), 200


@courses_bp.route("/<course_id>", methods=["GET"])
@jwt_required()
def get_course(course_id):
    course = Course.query.get_or_404(course_id)
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    data = course.to_dict()
    data["materials"] = [m.to_dict() for m in course.materials.all()]
    data["quizzes"] = [q.to_dict() for q in course.quizzes.filter_by(is_active=True, approval_status="approved").all()]
    data["enrolled_count"] = len(course.enrolled_students)
    data["is_enrolled"] = user in course.enrolled_students

    # Final exam availability
    final_exam = Quiz.query.filter_by(
        course_id=course_id, is_final_exam=True, approval_status="approved", is_active=True
    ).first()
    data["has_final_exam"] = final_exam is not None
    if final_exam:
        data["final_exam_id"] = final_exam.id
        # Check if user passed
        passed = QuizAttempt.query.filter_by(
            quiz_id=final_exam.id, user_id=user_id, passed=True
        ).first()
        data["final_exam_passed"] = passed is not None
        # Certificate
        cert = Certificate.query.filter_by(user_id=user_id, course_id=course_id).first()
        data["certificate_id"] = cert.id if cert else None

    # Roadmaps linked to this course
    roadmaps = Roadmap.query.filter_by(course_id=course_id).order_by(Roadmap.created_at.desc()).all()
    data["roadmaps"] = [rm.to_dict() for rm in roadmaps]

    # User's quiz attempts for this course's quizzes
    course_quiz_ids = [q.id for q in Quiz.query.filter_by(course_id=course_id).all()]
    user_attempts = QuizAttempt.query.filter(
        QuizAttempt.quiz_id.in_(course_quiz_ids),
        QuizAttempt.user_id == user_id
    ).order_by(QuizAttempt.completed_at.desc()).all()
    attempts_by_quiz = {}
    for a in user_attempts:
        if a.quiz_id not in attempts_by_quiz:
            attempts_by_quiz[a.quiz_id] = a.to_dict()
    data["my_attempts"] = attempts_by_quiz

    return jsonify(data), 200


@courses_bp.route("", methods=["POST"])
@role_required("admin", "instructor")
def create_course():
    data = request.get_json()
    ok, err = validate_required_fields(data, ["title"])
    if not ok:
        return jsonify({"error": err}), 400

    user_id = get_jwt_identity()
    course = Course(
        title=data["title"],
        description=data.get("description", ""),
        badge=data.get("badge"),
        estimated_duration=data.get("estimated_duration"),
        instructor_id=user_id,
        is_published=data.get("is_published", False),
    )

    # Handle topics
    topic_ids = data.get("topic_ids", [])
    if topic_ids:
        topics = Topic.query.filter(Topic.id.in_(topic_ids)).all()
        course.topics = topics

    # Handle new topics
    new_topics = data.get("new_topics", [])
    for t in new_topics:
        topic = Topic(name=t.get("name", ""), description=t.get("description", ""),
                      keywords=t.get("keywords", ""))
        db.session.add(topic)
        course.topics.append(topic)

    db.session.add(course)
    db.session.commit()

    log_action(user_id, "create_course", "course", course.id, course.title)
    return jsonify(course.to_dict()), 201


@courses_bp.route("/<course_id>", methods=["PUT"])
@role_required("admin", "instructor")
def update_course(course_id):
    course = Course.query.get_or_404(course_id)
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role == "instructor" and course.instructor_id != user_id:
        return jsonify({"error": "Not authorized to edit this course"}), 403

    data = request.get_json()
    if data.get("title"):
        course.title = data["title"]
    if "description" in data:
        course.description = data["description"]
    if "estimated_duration" in data:
        course.estimated_duration = data["estimated_duration"]
    if "badge" in data:
        course.badge = data["badge"]
    if "is_published" in data:
        course.is_published = data["is_published"]

    topic_ids = data.get("topic_ids")
    if topic_ids is not None:
        topics = Topic.query.filter(Topic.id.in_(topic_ids)).all()
        course.topics = topics

    db.session.commit()
    log_action(user_id, "update_course", "course", course.id, course.title)
    return jsonify(course.to_dict()), 200


@courses_bp.route("/<course_id>", methods=["DELETE"])
@role_required("admin")
def delete_course(course_id):
    course = Course.query.get_or_404(course_id)
    user_id = get_jwt_identity()

    db.session.delete(course)
    db.session.commit()

    log_action(user_id, "delete_course", "course", course_id)
    return jsonify({"message": "Course deleted"}), 200


@courses_bp.route("/<course_id>/enroll", methods=["POST"])
@jwt_required()
def enroll_course(course_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    course = Course.query.get_or_404(course_id)

    if user in course.enrolled_students:
        return jsonify({"error": "Already enrolled"}), 409

    course.enrolled_students.append(user)
    db.session.commit()

    log_action(user_id, "enroll_course", "course", course_id)
    return jsonify({"message": "Enrolled successfully", "is_enrolled": True}), 200


@courses_bp.route("/<course_id>/unenroll", methods=["POST"])
@jwt_required()
def unenroll_course(course_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    course = Course.query.get_or_404(course_id)

    if user not in course.enrolled_students:
        return jsonify({"error": "Not enrolled"}), 404

    course.enrolled_students.remove(user)
    db.session.commit()

    log_action(user_id, "unenroll_course", "course", course_id)
    return jsonify({"message": "Unenrolled successfully"}), 200


# ── Topic CRUD ──────────────────────────────────────────────────────

@courses_bp.route("/topics", methods=["GET"])
@jwt_required()
def list_topics():
    topics = Topic.query.order_by(Topic.name).all()
    return jsonify([t.to_dict() for t in topics]), 200


@courses_bp.route("/topics", methods=["POST"])
@role_required("admin", "instructor")
def create_topic():
    data = request.get_json()
    ok, err = validate_required_fields(data, ["name"])
    if not ok:
        return jsonify({"error": err}), 400

    topic = Topic(
        name=data["name"],
        description=data.get("description", ""),
        keywords=data.get("keywords", ""),
    )
    db.session.add(topic)
    db.session.commit()

    return jsonify(topic.to_dict()), 201


@courses_bp.route("/topics/<topic_id>", methods=["PUT"])
@role_required("admin", "instructor")
def update_topic(topic_id):
    topic = Topic.query.get_or_404(topic_id)
    data = request.get_json()

    if data.get("name"):
        topic.name = data["name"]
    if "description" in data:
        topic.description = data["description"]
    if "keywords" in data:
        topic.keywords = data["keywords"]

    db.session.commit()
    return jsonify(topic.to_dict()), 200


@courses_bp.route("/topics/<topic_id>", methods=["DELETE"])
@role_required("admin")
def delete_topic(topic_id):
    topic = Topic.query.get_or_404(topic_id)
    db.session.delete(topic)
    db.session.commit()
    return jsonify({"message": "Topic deleted"}), 200
