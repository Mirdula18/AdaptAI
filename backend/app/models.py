import uuid
import secrets
from datetime import datetime, timezone, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from app import db


def gen_uuid():
    return str(uuid.uuid4())


# ── Association Tables ──────────────────────────────────────────────

course_topics = db.Table(
    "course_topics",
    db.Column("course_id", db.String(36), db.ForeignKey("courses.id"), primary_key=True),
    db.Column("topic_id", db.String(36), db.ForeignKey("topics.id"), primary_key=True),
)

material_topics = db.Table(
    "material_topics",
    db.Column("material_id", db.String(36), db.ForeignKey("materials.id"), primary_key=True),
    db.Column("topic_id", db.String(36), db.ForeignKey("topics.id"), primary_key=True),
)

course_enrollments = db.Table(
    "course_enrollments",
    db.Column("user_id", db.String(36), db.ForeignKey("users.id"), primary_key=True),
    db.Column("course_id", db.String(36), db.ForeignKey("courses.id"), primary_key=True),
    db.Column("enrolled_at", db.DateTime, default=lambda: datetime.now(timezone.utc)),
)


# ── User ────────────────────────────────────────────────────────────

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    full_name = db.Column(db.String(150), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="student")  # student, instructor, admin
    is_active = db.Column(db.Boolean, default=True)
    avatar_url = db.Column(db.String(500), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    last_active = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    streak_dates = db.Column(db.Text, nullable=True)  # JSON array of ISO date strings
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    quiz_attempts = db.relationship("QuizAttempt", backref="user", lazy="dynamic")
    roadmaps = db.relationship("Roadmap", backref="user", lazy="dynamic")
    enrolled_courses = db.relationship("Course", secondary=course_enrollments, backref="enrolled_students")
    certificates = db.relationship("Certificate", backref="user", lazy="dynamic")
    notifications = db.relationship("Notification", backref="user", lazy="dynamic")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def record_streak(self):
        """Record today's date in the streak calendar."""
        import json
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        dates = json.loads(self.streak_dates) if self.streak_dates else []
        if today not in dates:
            dates.append(today)
            # Keep last 365 days
            dates = dates[-365:]
            self.streak_dates = json.dumps(dates)
        self.last_active = datetime.now(timezone.utc)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role,
            "is_active": self.is_active,
            "avatar_url": self.avatar_url,
            "bio": self.bio,
            "last_active": self.last_active.isoformat() if self.last_active else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ── Topic ───────────────────────────────────────────────────────────

class Topic(db.Model):
    __tablename__ = "topics"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    name = db.Column(db.String(150), nullable=False, index=True)
    description = db.Column(db.Text, nullable=True)
    keywords = db.Column(db.Text, nullable=True)  # comma-separated
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "keywords": self.keywords.split(",") if self.keywords else [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ── Course ──────────────────────────────────────────────────────────

class Course(db.Model):
    __tablename__ = "courses"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    badge = db.Column(db.String(100), nullable=True)  # e.g. "Web Development", "Data Structures"
    estimated_duration = db.Column(db.String(50), nullable=True)  # e.g. "4 weeks"
    instructor_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    is_published = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    instructor = db.relationship("User", backref="courses_taught", foreign_keys=[instructor_id])
    topics = db.relationship("Topic", secondary=course_topics, backref="courses")
    materials = db.relationship("Material", backref="course", lazy="dynamic")
    quizzes = db.relationship("Quiz", backref="course", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "badge": self.badge,
            "estimated_duration": self.estimated_duration,
            "instructor_id": self.instructor_id,
            "instructor_name": self.instructor.full_name if self.instructor else None,
            "is_published": self.is_published,
            "topics": [t.to_dict() for t in self.topics],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ── Material ────────────────────────────────────────────────────────

class Material(db.Model):
    __tablename__ = "materials"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    material_type = db.Column(db.String(20), nullable=False)  # pdf, video, document, link
    file_path = db.Column(db.String(500), nullable=True)
    external_url = db.Column(db.String(500), nullable=True)
    course_id = db.Column(db.String(36), db.ForeignKey("courses.id"), nullable=True)
    uploaded_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    uploader = db.relationship("User", backref="uploads", foreign_keys=[uploaded_by])
    topics = db.relationship("Topic", secondary=material_topics, backref="materials")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "material_type": self.material_type,
            "file_path": self.file_path,
            "external_url": self.external_url,
            "course_id": self.course_id,
            "topics": [t.to_dict() for t in self.topics],
            "uploaded_by": self.uploaded_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ── Quiz ────────────────────────────────────────────────────────────

class Quiz(db.Model):
    __tablename__ = "quizzes"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    title = db.Column(db.String(200), nullable=False)
    course_id = db.Column(db.String(36), db.ForeignKey("courses.id"), nullable=True)
    topic_id = db.Column(db.String(36), db.ForeignKey("topics.id"), nullable=True)
    generated_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    num_questions = db.Column(db.Integer, default=5)
    difficulty = db.Column(db.String(20), default="medium")  # easy, medium, hard
    is_active = db.Column(db.Boolean, default=True)
    approval_status = db.Column(db.String(20), default="approved")  # pending, approved, rejected
    is_final_exam = db.Column(db.Boolean, default=False)
    time_limit_minutes = db.Column(db.Integer, nullable=True)  # null = no limit
    proctor_mode = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    topic = db.relationship("Topic", backref="quizzes")
    generator = db.relationship("User", backref="quizzes_generated", foreign_keys=[generated_by])
    questions = db.relationship("QuizQuestion", backref="quiz", lazy="dynamic", cascade="all, delete-orphan")
    attempts = db.relationship("QuizAttempt", backref="quiz", lazy="dynamic")

    def to_dict(self, include_questions=False):
        data = {
            "id": self.id,
            "title": self.title,
            "course_id": self.course_id,
            "topic_id": self.topic_id,
            "generated_by": self.generated_by,
            "num_questions": self.num_questions,
            "difficulty": self.difficulty,
            "is_active": self.is_active,
            "approval_status": self.approval_status,
            "is_final_exam": self.is_final_exam,
            "time_limit_minutes": self.time_limit_minutes,
            "proctor_mode": self.proctor_mode,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_questions:
            data["questions"] = [q.to_dict() for q in self.questions.all()]
        return data


class QuizQuestion(db.Model):
    __tablename__ = "quiz_questions"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    quiz_id = db.Column(db.String(36), db.ForeignKey("quizzes.id"), nullable=False)
    question_text = db.Column(db.Text, nullable=False)
    question_type = db.Column(db.String(20), default="mcq")  # mcq, code
    code_snippet = db.Column(db.Text, nullable=True)  # code block for code questions
    option_a = db.Column(db.Text, nullable=False)
    option_b = db.Column(db.Text, nullable=False)
    option_c = db.Column(db.Text, nullable=False)
    option_d = db.Column(db.Text, nullable=False)
    correct_answer = db.Column(db.String(1), nullable=False)  # A, B, C, D
    explanation = db.Column(db.Text, nullable=True)
    order_index = db.Column(db.Integer, default=0)

    def to_dict(self, hide_answer=False):
        data = {
            "id": self.id,
            "question_text": self.question_text,
            "question_type": self.question_type,
            "code_snippet": self.code_snippet,
            "option_a": self.option_a,
            "option_b": self.option_b,
            "option_c": self.option_c,
            "option_d": self.option_d,
            "order_index": self.order_index,
        }
        if not hide_answer:
            data["correct_answer"] = self.correct_answer
            data["explanation"] = self.explanation
        return data


# ── Quiz Attempt ────────────────────────────────────────────────────

class QuizAttempt(db.Model):
    __tablename__ = "quiz_attempts"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    quiz_id = db.Column(db.String(36), db.ForeignKey("quizzes.id"), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    score = db.Column(db.Float, nullable=False, default=0)
    total_questions = db.Column(db.Integer, nullable=False)
    correct_answers = db.Column(db.Integer, nullable=False, default=0)
    duration_seconds = db.Column(db.Integer, nullable=True)
    answers_json = db.Column(db.Text, nullable=True)  # JSON: [{question_id, selected, correct}]
    is_final_exam = db.Column(db.Boolean, default=False)
    passed = db.Column(db.Boolean, default=False)
    started_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "quiz_id": self.quiz_id,
            "user_id": self.user_id,
            "score": self.score,
            "total_questions": self.total_questions,
            "correct_answers": self.correct_answers,
            "duration_seconds": self.duration_seconds,
            "answers_json": self.answers_json,
            "is_final_exam": self.is_final_exam,
            "passed": self.passed,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


# ── Roadmap ─────────────────────────────────────────────────────────

class Roadmap(db.Model):
    __tablename__ = "roadmaps"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    course_id = db.Column(db.String(36), db.ForeignKey("courses.id"), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    duration_weeks = db.Column(db.Integer, default=6)
    plan_json = db.Column(db.Text, nullable=False)  # JSON: [{week, focus, topics, resources, goals}]
    generated_from_quiz_id = db.Column(db.String(36), db.ForeignKey("quizzes.id"), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    course = db.relationship("Course", backref="roadmaps")
    source_quiz = db.relationship("Quiz", backref="roadmaps")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "course_id": self.course_id,
            "title": self.title,
            "duration_weeks": self.duration_weeks,
            "plan_json": self.plan_json,
            "generated_from_quiz_id": self.generated_from_quiz_id,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ── Audit Log ───────────────────────────────────────────────────────

class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    action = db.Column(db.String(100), nullable=False)
    resource_type = db.Column(db.String(50), nullable=True)
    resource_id = db.Column(db.String(36), nullable=True)
    details = db.Column(db.Text, nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", backref="audit_logs")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "username": self.user.username if self.user else None,
            "action": self.action,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "details": self.details,
            "ip_address": self.ip_address,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


# ── License Key ─────────────────────────────────────────────────────

class LicenseActivation(db.Model):
    __tablename__ = "license_activations"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    license_key = db.Column(db.String(100), nullable=False)
    activated_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    machine_id = db.Column(db.String(200), nullable=True)
    is_valid = db.Column(db.Boolean, default=True)
    activated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "license_key": self.license_key,
            "activated_by": self.activated_by,
            "is_valid": self.is_valid,
            "activated_at": self.activated_at.isoformat() if self.activated_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
        }


# ── Password Reset Token ───────────────────────────────────────────

class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    token = db.Column(db.String(100), unique=True, nullable=False, default=lambda: secrets.token_urlsafe(32))
    otp = db.Column(db.String(6), nullable=True)
    is_used = db.Column(db.Boolean, default=False)
    expires_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.utcnow() + timedelta(hours=1))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref="reset_tokens")

    @property
    def is_expired(self):
        return datetime.utcnow() > self.expires_at

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "token": self.token,
            "is_used": self.is_used,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
        }


# ── Certificate ─────────────────────────────────────────────────────

class Certificate(db.Model):
    __tablename__ = "certificates"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    course_id = db.Column(db.String(36), db.ForeignKey("courses.id"), nullable=False)
    quiz_attempt_id = db.Column(db.String(36), db.ForeignKey("quiz_attempts.id"), nullable=True)
    score = db.Column(db.Float, nullable=False)
    certificate_number = db.Column(db.String(50), unique=True, nullable=False, default=lambda: f"CERT-{secrets.token_hex(6).upper()}")
    pdf_path = db.Column(db.String(500), nullable=True)
    issued_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    course = db.relationship("Course", backref="certificates")
    attempt = db.relationship("QuizAttempt", backref="certificate")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "course_id": self.course_id,
            "course_title": self.course.title if self.course else None,
            "quiz_attempt_id": self.quiz_attempt_id,
            "score": self.score,
            "certificate_number": self.certificate_number,
            "pdf_path": self.pdf_path,
            "issued_at": self.issued_at.isoformat() if self.issued_at else None,
        }


# ── Notification ────────────────────────────────────────────────────

class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    notification_type = db.Column(db.String(50), nullable=False)  # roadmap, quiz, certificate, reminder, system
    is_read = db.Column(db.Boolean, default=False)
    link = db.Column(db.String(500), nullable=True)  # optional frontend link
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "message": self.message,
            "notification_type": self.notification_type,
            "is_read": self.is_read,
            "link": self.link,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ── Chat Message ────────────────────────────────────────────────────

class ChatMessage(db.Model):
    __tablename__ = "chat_messages"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # user, assistant
    content = db.Column(db.Text, nullable=False)
    session_id = db.Column(db.String(36), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    user_rel = db.relationship("User", backref="chat_messages")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "role": self.role,
            "content": self.content,
            "session_id": self.session_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
