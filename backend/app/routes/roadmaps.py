import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Roadmap, QuizAttempt, Quiz, QuizQuestion, Course, User
from app.utils import role_required, log_action, validate_required_fields, paginate_query, safe_json_loads, create_notification
from app.llm_service import LLMService, LLMConnectionError, LLMParseError
from app.email_service import EmailService

roadmaps_bp = Blueprint("roadmaps", __name__)


@roadmaps_bp.route("", methods=["GET"])
@jwt_required()
def list_roadmaps():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    query = Roadmap.query
    course_id = request.args.get("course_id")
    if course_id:
        query = query.filter_by(course_id=course_id)
    if user.role == "student":
        query = query.filter_by(user_id=user_id)

    result = paginate_query(query.order_by(Roadmap.created_at.desc()))
    # Enrich with course titles
    for item in result["items"]:
        if item.get("course_id"):
            c = Course.query.get(item["course_id"])
            item["course_title"] = c.title if c else None
    return jsonify(result), 200


@roadmaps_bp.route("/<roadmap_id>", methods=["GET"])
@jwt_required()
def get_roadmap(roadmap_id):
    roadmap = Roadmap.query.get_or_404(roadmap_id)
    data = roadmap.to_dict()
    data["plan"] = safe_json_loads(roadmap.plan_json, [])

    # Include related info
    if roadmap.course:
        data["course_title"] = roadmap.course.title
    if roadmap.source_quiz:
        data["quiz_title"] = roadmap.source_quiz.title

    return jsonify(data), 200


@roadmaps_bp.route("/generate", methods=["POST"])
@jwt_required()
def generate_roadmap():
    """AI-powered roadmap generation using local LLM."""
    data = request.get_json()
    user_id = get_jwt_identity()

    quiz_attempt_id = data.get("quiz_attempt_id")
    course_id = data.get("course_id")
    duration_weeks = min(int(data.get("duration_weeks", 6)), 12)

    if not quiz_attempt_id and not course_id:
        return jsonify({"error": "Either quiz_attempt_id or course_id is required"}), 400

    # Gather data for roadmap generation
    course_title = data.get("course_title", "General Learning")
    score_percent = 50.0
    weak_topics = []

    if quiz_attempt_id:
        attempt = QuizAttempt.query.get(quiz_attempt_id)
        if attempt:
            score_percent = attempt.score
            quiz = Quiz.query.get(attempt.quiz_id)
            if quiz and quiz.course:
                course_title = quiz.course.title
                course_id = quiz.course_id

            # Analyze wrong answers to find weak topics
            answers = safe_json_loads(attempt.answers_json, [])
            for ans in answers:
                if not ans.get("is_correct"):
                    question = db.session.get(
                        __import__("app.models", fromlist=["QuizQuestion"]).QuizQuestion,
                        ans.get("question_id")
                    )
                    if question:
                        weak_topics.append(question.question_text[:50])

    elif course_id:
        course = Course.query.get(course_id)
        if course:
            course_title = course.title
            weak_topics = [t.name for t in course.topics]

    if not weak_topics:
        weak_topics = [course_title]

    try:
        plan_data = LLMService.generate_roadmap(
            course_title=course_title,
            score_percent=score_percent,
            weak_topics=weak_topics[:5],
            duration_weeks=duration_weeks,
        )
    except LLMConnectionError as e:
        return jsonify({"error": str(e)}), 503
    except LLMParseError as e:
        return jsonify({"error": str(e)}), 422

    roadmap = Roadmap(
        user_id=user_id,
        course_id=course_id,
        title=f"Learning Plan: {course_title}",
        duration_weeks=duration_weeks,
        plan_json=json.dumps(plan_data),
        generated_from_quiz_id=QuizAttempt.query.get(quiz_attempt_id).quiz_id if quiz_attempt_id and QuizAttempt.query.get(quiz_attempt_id) else None,
    )
    db.session.add(roadmap)
    db.session.commit()

    log_action(user_id, "generate_roadmap", "roadmap", roadmap.id)

    # Notify user & send email
    user = User.query.get(user_id)
    create_notification(
        user_id,
        "Roadmap Created!",
        f"Your personalized learning plan for '{course_title}' is ready.",
        "roadmap",
        f"/roadmaps/{roadmap.id}",
    )
    EmailService.send_roadmap_created(user.email, user.full_name, f"{course_title} ({duration_weeks} weeks)")

    # Auto-generate a final quiz for this roadmap (approved, locked until completion)
    final_quiz = None
    try:
        # Gather topics from the generated roadmap plan
        all_topics = []
        for week in plan_data:
            all_topics.extend(week.get("topics", []))
            all_topics.append(week.get("focus", ""))
        all_topics = list(set(t for t in all_topics if t))
        topic_str = ", ".join(all_topics[:10]) if all_topics else course_title

        questions_data = LLMService.generate_quiz(
            topic=f"Final assessment: {topic_str}",
            num_questions=10,
            difficulty="medium",
        )

        final_quiz = Quiz(
            title=f"Final Quiz: {course_title}",
            course_id=course_id,
            generated_by=user_id,
            num_questions=len(questions_data),
            difficulty="medium",
            approval_status="approved",
            is_active=True,
            is_final_exam=True,
            time_limit_minutes=30,
            proctor_mode=True,
        )
        db.session.add(final_quiz)
        db.session.flush()

        for idx, q in enumerate(questions_data):
            question = QuizQuestion(
                quiz_id=final_quiz.id,
                question_text=q["question"],
                option_a=q["option_a"],
                option_b=q["option_b"],
                option_c=q["option_c"],
                option_d=q["option_d"],
                correct_answer=q["correct_answer"],
                explanation=q.get("explanation", ""),
                order_index=idx,
            )
            db.session.add(question)

        db.session.commit()
        log_action(user_id, "auto_generate_final_quiz", "quiz", final_quiz.id, f"From roadmap {roadmap.id}")
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Failed to auto-generate final quiz: {e}")

    result = roadmap.to_dict()
    result["plan"] = plan_data
    if final_quiz:
        result["final_quiz_id"] = final_quiz.id
    return jsonify(result), 201


@roadmaps_bp.route("/<roadmap_id>", methods=["PUT"])
@role_required("admin", "instructor")
def update_roadmap(roadmap_id):
    roadmap = Roadmap.query.get_or_404(roadmap_id)
    data = request.get_json()
    user_id = get_jwt_identity()

    if "title" in data:
        roadmap.title = data["title"]
    if "plan" in data:
        roadmap.plan_json = json.dumps(data["plan"])
    if "duration_weeks" in data:
        roadmap.duration_weeks = data["duration_weeks"]
    if "is_active" in data:
        roadmap.is_active = data["is_active"]

    db.session.commit()
    log_action(user_id, "update_roadmap", "roadmap", roadmap.id)

    result = roadmap.to_dict()
    result["plan"] = safe_json_loads(roadmap.plan_json, [])
    return jsonify(result), 200


@roadmaps_bp.route("/<roadmap_id>", methods=["DELETE"])
@role_required("admin")
def delete_roadmap(roadmap_id):
    roadmap = Roadmap.query.get_or_404(roadmap_id)
    user_id = get_jwt_identity()

    db.session.delete(roadmap)
    db.session.commit()

    log_action(user_id, "delete_roadmap", "roadmap", roadmap_id)
    return jsonify({"message": "Roadmap deleted"}), 200


# ── Generate Personalized Quiz from Roadmap ────────────────────────

@roadmaps_bp.route("/<roadmap_id>/generate-quiz", methods=["POST"])
@jwt_required()
def generate_quiz_from_roadmap(roadmap_id):
    """Generate a personalized final quiz after all roadmap weeks are completed."""
    roadmap = Roadmap.query.get_or_404(roadmap_id)
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if roadmap.user_id != user_id and user.role == "student":
        return jsonify({"error": "Not your roadmap"}), 403

    # Gather topics from roadmap plan
    plan = safe_json_loads(roadmap.plan_json, [])
    all_topics = []
    for week in plan:
        all_topics.extend(week.get("topics", []))
        all_topics.append(week.get("focus", ""))
    all_topics = list(set(t for t in all_topics if t))

    course_title = "General Learning"
    course_id = roadmap.course_id
    if course_id:
        course = Course.query.get(course_id)
        if course:
            course_title = course.title

    topic_str = ", ".join(all_topics[:10]) if all_topics else course_title

    try:
        questions_data = LLMService.generate_quiz(
            topic=f"Comprehensive assessment: {topic_str}",
            num_questions=10,
            difficulty="medium",
        )
    except LLMConnectionError as e:
        return jsonify({"error": str(e)}), 503
    except LLMParseError as e:
        return jsonify({"error": str(e)}), 422

    # Create quiz as final exam — auto-approved, no admin approval needed
    quiz = Quiz(
        title=f"Personalized Assessment: {course_title}",
        course_id=course_id,
        generated_by=user_id,
        num_questions=len(questions_data),
        difficulty="medium",
        approval_status="approved",
        is_active=True,
        is_final_exam=True,
        time_limit_minutes=30,
        proctor_mode=True,
    )
    db.session.add(quiz)
    db.session.flush()

    for idx, q in enumerate(questions_data):
        question = QuizQuestion(
            quiz_id=quiz.id,
            question_text=q["question"],
            option_a=q["option_a"],
            option_b=q["option_b"],
            option_c=q["option_c"],
            option_d=q["option_d"],
            correct_answer=q["correct_answer"],
            explanation=q.get("explanation", ""),
            order_index=idx,
        )
        db.session.add(question)

    db.session.commit()

    # Notify user that quiz is ready
    create_notification(
        user_id,
        "Final Quiz Ready!",
        f"Your personalized final quiz for '{course_title}' is ready. Complete all roadmap weeks to unlock it.",
        "quiz",
        f"/quizzes/{quiz.id}",
    )

    log_action(user_id, "generate_personalized_quiz", "quiz", quiz.id, f"From roadmap {roadmap_id}")
    return jsonify(quiz.to_dict(include_questions=True)), 201
