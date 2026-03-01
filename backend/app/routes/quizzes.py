import json
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Quiz, QuizQuestion, QuizAttempt, Course, Topic, Material, User, Certificate
from app.utils import role_required, log_action, validate_required_fields, paginate_query, create_notification
from app.llm_service import LLMService, LLMConnectionError, LLMParseError
from app.email_service import EmailService
from app.certificate_generator import CertificateGenerator

quizzes_bp = Blueprint("quizzes", __name__)


# ── List Quizzes ────────────────────────────────────────────────────

@quizzes_bp.route("", methods=["GET"])
@jwt_required()
def list_quizzes():
    query = Quiz.query
    course_id = request.args.get("course_id")
    topic_id = request.args.get("topic_id")
    approval = request.args.get("approval_status")

    if course_id:
        query = query.filter_by(course_id=course_id)
    if topic_id:
        query = query.filter_by(topic_id=topic_id)

    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if user.role == "student":
        # Students see only active + approved quizzes
        query = query.filter_by(is_active=True, approval_status="approved")
    elif approval:
        query = query.filter_by(approval_status=approval)

    return jsonify(paginate_query(query.order_by(Quiz.created_at.desc()))), 200


@quizzes_bp.route("/<quiz_id>", methods=["GET"])
@jwt_required()
def get_quiz(quiz_id):
    quiz = Quiz.query.get_or_404(quiz_id)
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    data = quiz.to_dict(include_questions=True)

    # Hide answers for students
    if user.role == "student":
        data["questions"] = [q.to_dict(hide_answer=True) for q in quiz.questions.all()]

    # Include enrollment check for final exams
    if quiz.is_final_exam and quiz.course_id:
        course = Course.query.get(quiz.course_id)
        data["is_enrolled"] = user in course.enrolled_students if course else False

    return jsonify(data), 200


# ── Generate Quiz (AI) ─────────────────────────────────────────────

@quizzes_bp.route("/generate", methods=["POST"])
@jwt_required()
def generate_quiz():
    """AI-powered quiz generation. Students generate pending quizzes, admins/instructors generate approved ones."""
    data = request.get_json()
    ok, err = validate_required_fields(data, ["topic"])
    if not ok:
        return jsonify({"error": err}), 400

    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    topic_name = data["topic"]
    num_questions = min(int(data.get("num_questions", 5)), 20)
    difficulty = data.get("difficulty", "medium")
    course_id = data.get("course_id")
    topic_id = data.get("topic_id")
    is_final_exam = data.get("is_final_exam", False)
    time_limit = data.get("time_limit_minutes")
    proctor_mode = data.get("proctor_mode", False)

    # Final exams are admin/instructor only with specific settings
    if is_final_exam:
        if user.role == "student":
            return jsonify({"error": "Only instructors can create final exams"}), 403
        num_questions = max(num_questions, 20)
        proctor_mode = True

    # Gather context from course materials if available
    context = None
    if course_id:
        materials = Material.query.filter_by(course_id=course_id).all()
        context_parts = []
        for m in materials:
            if m.file_path and m.file_path.endswith(".pdf"):
                try:
                    from PyPDF2 import PdfReader
                    reader = PdfReader(m.file_path)
                    text = " ".join(page.extract_text() or "" for page in reader.pages[:5])
                    context_parts.append(text[:1500])
                except Exception:
                    pass
            if m.description:
                context_parts.append(m.description)
        if context_parts:
            context = "\n".join(context_parts)[:3000]

    try:
        questions_data = LLMService.generate_quiz(
            topic=topic_name,
            num_questions=num_questions,
            difficulty=difficulty,
            context=context,
        )
    except LLMConnectionError as e:
        return jsonify({"error": str(e)}), 503
    except LLMParseError as e:
        return jsonify({"error": str(e)}), 422

    # Approval workflow: students generate pending quizzes, admin/instructor → approved
    approval = "approved" if user.role in ("admin", "instructor") else "pending"

    quiz = Quiz(
        title=f"{'Final Exam' if is_final_exam else 'Quiz'}: {topic_name} ({difficulty})",
        course_id=course_id,
        topic_id=topic_id,
        generated_by=user_id,
        num_questions=len(questions_data),
        difficulty=difficulty,
        approval_status=approval,
        is_final_exam=is_final_exam,
        time_limit_minutes=time_limit,
        proctor_mode=proctor_mode,
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
            question_type=q.get("question_type", "mcq"),
            code_snippet=q.get("code_snippet"),
            order_index=idx,
        )
        db.session.add(question)

    db.session.commit()

    # Notify admins if student-generated quiz is pending approval
    if approval == "pending":
        admins = User.query.filter(User.role.in_(["admin", "instructor"])).all()
        for admin in admins:
            create_notification(
                admin.id,
                "Quiz Pending Approval",
                f"{user.full_name} generated a quiz on '{topic_name}' that needs review.",
                "quiz",
                f"/quizzes/{quiz.id}",
            )

    log_action(user_id, "generate_quiz", "quiz", quiz.id, f"Generated {len(questions_data)} questions")
    return jsonify(quiz.to_dict(include_questions=True)), 201


# ── Quiz Approval ──────────────────────────────────────────────────

@quizzes_bp.route("/<quiz_id>/approve", methods=["PUT"])
@role_required("admin", "instructor")
def approve_quiz(quiz_id):
    """Approve or reject a pending quiz."""
    quiz = Quiz.query.get_or_404(quiz_id)
    data = request.get_json()
    action = data.get("action", "approve")  # "approve" or "reject"
    user_id = get_jwt_identity()

    if action == "approve":
        quiz.approval_status = "approved"
        quiz.is_active = True
        msg = "Quiz approved and published"
    elif action == "reject":
        quiz.approval_status = "rejected"
        quiz.is_active = False
        msg = "Quiz rejected"
    else:
        return jsonify({"error": "Invalid action. Use 'approve' or 'reject'"}), 400

    db.session.commit()

    # Notify quiz creator
    create_notification(
        quiz.generated_by,
        f"Quiz {action.title()}d",
        f"Your quiz '{quiz.title}' has been {action}d.",
        "quiz",
        f"/quizzes/{quiz.id}",
    )

    log_action(user_id, f"quiz_{action}", "quiz", quiz.id)
    return jsonify({"message": msg, "quiz": quiz.to_dict()}), 200


# ── Question CRUD ──────────────────────────────────────────────────

@quizzes_bp.route("/<quiz_id>/questions", methods=["POST"])
@role_required("admin", "instructor")
def add_question(quiz_id):
    """Add a new question to a quiz."""
    quiz = Quiz.query.get_or_404(quiz_id)
    data = request.get_json()
    ok, err = validate_required_fields(data, ["question_text", "option_a", "option_b", "option_c", "option_d", "correct_answer"])
    if not ok:
        return jsonify({"error": err}), 400

    max_order = db.session.query(db.func.max(QuizQuestion.order_index)).filter_by(quiz_id=quiz_id).scalar() or 0
    question = QuizQuestion(
        quiz_id=quiz_id,
        question_text=data["question_text"],
        question_type=data.get("question_type", "mcq"),
        code_snippet=data.get("code_snippet"),
        option_a=data["option_a"],
        option_b=data["option_b"],
        option_c=data["option_c"],
        option_d=data["option_d"],
        correct_answer=data["correct_answer"].upper(),
        explanation=data.get("explanation", ""),
        order_index=max_order + 1,
    )
    db.session.add(question)
    quiz.num_questions = quiz.questions.count() + 1
    db.session.commit()

    user_id = get_jwt_identity()
    log_action(user_id, "add_question", "quiz_question", question.id)
    return jsonify(question.to_dict()), 201


@quizzes_bp.route("/<quiz_id>/questions/<question_id>", methods=["PUT"])
@role_required("admin", "instructor")
def edit_question(quiz_id, question_id):
    """Edit a single quiz question."""
    question = QuizQuestion.query.filter_by(id=question_id, quiz_id=quiz_id).first_or_404()
    data = request.get_json()

    for field in ["question_text", "option_a", "option_b", "option_c", "option_d",
                  "correct_answer", "explanation", "question_type", "code_snippet"]:
        if field in data:
            setattr(question, field, data[field])

    db.session.commit()
    return jsonify(question.to_dict()), 200


@quizzes_bp.route("/<quiz_id>/questions/<question_id>", methods=["DELETE"])
@role_required("admin", "instructor")
def delete_question(quiz_id, question_id):
    """Delete a question from a quiz."""
    question = QuizQuestion.query.filter_by(id=question_id, quiz_id=quiz_id).first_or_404()
    quiz = Quiz.query.get_or_404(quiz_id)

    db.session.delete(question)
    quiz.num_questions = max(quiz.questions.count() - 1, 0)
    db.session.commit()

    user_id = get_jwt_identity()
    log_action(user_id, "delete_question", "quiz_question", question_id)
    return jsonify({"message": "Question deleted"}), 200


# ── Submit Attempt ─────────────────────────────────────────────────

@quizzes_bp.route("/<quiz_id>/attempt", methods=["POST"])
@jwt_required()
def submit_attempt(quiz_id):
    """Submit quiz answers and get score."""
    quiz = Quiz.query.get_or_404(quiz_id)
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    data = request.get_json()

    # Students can only attempt approved quizzes
    if user.role == "student" and quiz.approval_status != "approved":
        return jsonify({"error": "This quiz is not yet approved"}), 403

    answers = data.get("answers", {})  # {question_id: "A"|"B"|"C"|"D"}
    duration = data.get("duration_seconds")

    questions = quiz.questions.all()
    correct = 0
    answers_detail = []

    for q in questions:
        selected = answers.get(q.id, "")
        is_correct = selected.upper() == q.correct_answer if selected else False
        if is_correct:
            correct += 1
        answers_detail.append({
            "question_id": q.id,
            "selected": selected,
            "correct_answer": q.correct_answer,
            "is_correct": is_correct,
        })

    score = (correct / len(questions) * 100) if questions else 0
    passing = score >= 70  # 70% pass mark for certification

    attempt = QuizAttempt(
        quiz_id=quiz_id,
        user_id=user_id,
        score=round(score, 2),
        total_questions=len(questions),
        correct_answers=correct,
        duration_seconds=duration,
        answers_json=json.dumps(answers_detail),
        completed_at=datetime.now(timezone.utc),
        is_final_exam=quiz.is_final_exam,
        passed=passing,
    )
    db.session.add(attempt)

    # Record streak on any attempt
    user.record_streak()

    db.session.commit()

    log_action(user_id, "submit_quiz", "quiz_attempt", attempt.id, f"Score: {score:.1f}%")

    # Send email notification
    course_title = quiz.course.title if quiz.course else quiz.title
    EmailService.send_quiz_result(user.email, user.full_name, course_title, score, passing)

    # Auto-generate certificate if passed final exam
    cert_data = None
    if quiz.is_final_exam and passing:
      try:
        cert = Certificate(
            user_id=user_id,
            course_id=quiz.course_id,
            quiz_attempt_id=attempt.id,
            score=score,
        )
        db.session.add(cert)
        db.session.flush()

        issued_str = cert.issued_at.strftime("%B %d, %Y") if cert.issued_at else None
        pdf_path = CertificateGenerator.generate(
            full_name=user.full_name,
            course_title=course_title,
            score=score,
            certificate_number=cert.certificate_number,
            date_str=issued_str,
        )
        cert.pdf_path = pdf_path
        db.session.commit()

        cert_data = cert.to_dict()

        # Send certificate email with PDF attachment
        EmailService.send_certificate(
            user.email, user.full_name, course_title,
            cert.certificate_number, pdf_path
        )

        create_notification(
            user_id, "Certificate Earned!",
            f"Congratulations! You earned a certificate for {course_title}.",
            "certificate", f"/certificates",
        )
      except Exception as e:
        print(f"Certificate generation error: {e}")
        db.session.rollback()

    result = attempt.to_dict()
    result["answers_detail"] = answers_detail
    result["questions"] = [q.to_dict(hide_answer=False) for q in questions]
    if cert_data:
        result["certificate"] = cert_data

    return jsonify(result), 201


# ── Final Exam for Course ──────────────────────────────────────────

@quizzes_bp.route("/final-exam/<course_id>", methods=["GET"])
@jwt_required()
def get_final_exam(course_id):
    """Get the final exam for a course (if one exists and is approved)."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    course = Course.query.get_or_404(course_id)

    # Must be enrolled
    if user.role == "student" and user not in course.enrolled_students:
        return jsonify({"error": "You must be enrolled in this course"}), 403

    exam = Quiz.query.filter_by(
        course_id=course_id, is_final_exam=True, approval_status="approved", is_active=True
    ).first()

    if not exam:
        return jsonify({"error": "No final exam available for this course"}), 404

    data = exam.to_dict(include_questions=True)
    if user.role == "student":
        data["questions"] = [q.to_dict(hide_answer=True) for q in exam.questions.all()]

    # Check if already passed
    passed_attempt = QuizAttempt.query.filter_by(
        quiz_id=exam.id, user_id=user_id, passed=True
    ).first()
    data["already_passed"] = passed_attempt is not None

    return jsonify(data), 200


# ── List Attempts ──────────────────────────────────────────────────

@quizzes_bp.route("/<quiz_id>/attempts", methods=["GET"])
@jwt_required()
def list_attempts(quiz_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    query = QuizAttempt.query.filter_by(quiz_id=quiz_id)
    if user.role == "student":
        query = query.filter_by(user_id=user_id)

    return jsonify(paginate_query(query.order_by(QuizAttempt.started_at.desc()))), 200


@quizzes_bp.route("/my-attempts", methods=["GET"])
@jwt_required()
def my_attempts():
    user_id = get_jwt_identity()
    query = QuizAttempt.query.filter_by(user_id=user_id)
    return jsonify(paginate_query(query.order_by(QuizAttempt.started_at.desc()))), 200


# ── Update / Delete Quiz ──────────────────────────────────────────

@quizzes_bp.route("/<quiz_id>", methods=["PUT"])
@role_required("admin", "instructor")
def update_quiz(quiz_id):
    quiz = Quiz.query.get_or_404(quiz_id)
    data = request.get_json()

    for field in ["title", "is_active", "difficulty", "time_limit_minutes", "proctor_mode", "is_final_exam"]:
        if field in data:
            setattr(quiz, field, data[field])

    db.session.commit()
    return jsonify(quiz.to_dict()), 200


@quizzes_bp.route("/<quiz_id>", methods=["DELETE"])
@role_required("admin")
def delete_quiz(quiz_id):
    quiz = Quiz.query.get_or_404(quiz_id)
    user_id = get_jwt_identity()

    db.session.delete(quiz)
    db.session.commit()

    log_action(user_id, "delete_quiz", "quiz", quiz_id)
    return jsonify({"message": "Quiz deleted"}), 200


# ── Pending Quizzes (for approval dashboard) ───────────────────────

@quizzes_bp.route("/pending", methods=["GET"])
@role_required("admin", "instructor")
def pending_quizzes():
    """List quizzes pending approval."""
    quizzes = Quiz.query.filter_by(approval_status="pending").order_by(Quiz.created_at.desc()).all()
    return jsonify([q.to_dict() for q in quizzes]), 200


# ── LLM Status ─────────────────────────────────────────────────────

@quizzes_bp.route("/llm-status", methods=["GET"])
@jwt_required()
def llm_status():
    """Check LLM service health."""
    status = LLMService.health_check()
    return jsonify(status), 200
