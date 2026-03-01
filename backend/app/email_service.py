"""
Email Service — Handles sending emails via SMTP.
Falls back to logging when SMTP is not configured (offline mode).
"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from flask import current_app

logger = logging.getLogger(__name__)


class EmailService:
    """Email sending via SMTP with offline fallback."""

    @staticmethod
    def _get_config():
        return {
            "host": current_app.config.get("SMTP_HOST", ""),
            "port": int(current_app.config.get("SMTP_PORT", 587)),
            "username": current_app.config.get("SMTP_USERNAME", ""),
            "password": current_app.config.get("SMTP_PASSWORD", ""),
            "from_email": current_app.config.get("SMTP_FROM_EMAIL", "noreply@acadex.local"),
            "from_name": current_app.config.get("SMTP_FROM_NAME", "AdaptIQ Platform"),
        }

    @classmethod
    def send_email(cls, to_email: str, subject: str, html_body: str, attachment_path: str = None) -> bool:
        """Send an email. Returns True on success, False on failure."""
        cfg = cls._get_config()

        if not cfg["host"] or not cfg["username"]:
            # Offline mode — log the email instead
            logger.info(f"[EMAIL-OFFLINE] To: {to_email} | Subject: {subject}")
            logger.debug(f"[EMAIL-OFFLINE] Body: {html_body[:200]}...")
            return True  # Don't block flow

        try:
            msg = MIMEMultipart()
            msg["From"] = f"{cfg['from_name']} <{cfg['from_email']}>"
            msg["To"] = to_email
            msg["Subject"] = subject
            msg.attach(MIMEText(html_body, "html"))

            if attachment_path:
                with open(attachment_path, "rb") as f:
                    part = MIMEBase("application", "octet-stream")
                    part.set_payload(f.read())
                    encoders.encode_base64(part)
                    filename = attachment_path.split("/")[-1].split("\\")[-1]
                    part.add_header("Content-Disposition", f"attachment; filename={filename}")
                    msg.attach(part)

            with smtplib.SMTP(cfg["host"], cfg["port"]) as server:
                server.starttls()
                server.login(cfg["username"], cfg["password"])
                server.send_message(msg)

            logger.info(f"[EMAIL] Sent to {to_email}: {subject}")
            return True

        except Exception as e:
            logger.error(f"[EMAIL-ERROR] Failed to send to {to_email}: {e}")
            return False

    @classmethod
    def send_welcome_instructor(cls, email: str, full_name: str, username: str, temp_password: str):
        """Send welcome email to new instructor with temporary password."""
        html = f"""
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #6C63FF, #9680F2); padding: 30px; border-radius: 16px; text-align: center; margin-bottom: 20px;">
                <h1 style="color: white; margin: 0;">Welcome to AdaptIQ!</h1>
            </div>
            <p>Hello <strong>{full_name}</strong>,</p>
            <p>Your instructor account has been created on AdaptIQ. Here are your credentials:</p>
            <div style="background: #F5F3FF; padding: 20px; border-radius: 12px; margin: 20px 0;">
                <p><strong>Username:</strong> {username}</p>
                <p><strong>Temporary Password:</strong> {temp_password}</p>
            </div>
            <p>Please change your password after first login.</p>
            <p style="color: #888; font-size: 12px;">— AdaptIQ by ACADEX AI</p>
        </div>
        """
        return cls.send_email(email, "Welcome to AdaptIQ — Instructor Account", html)

    @classmethod
    def send_password_reset(cls, email: str, full_name: str, otp: str, token: str):
        """Send password reset OTP/token email."""
        html = f"""
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #6C63FF, #9680F2); padding: 30px; border-radius: 16px; text-align: center; margin-bottom: 20px;">
                <h1 style="color: white; margin: 0;">Password Reset</h1>
            </div>
            <p>Hello <strong>{full_name}</strong>,</p>
            <p>Your password reset OTP is:</p>
            <div style="background: #F5F3FF; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
                <h2 style="color: #6C63FF; letter-spacing: 8px; font-size: 32px;">{otp}</h2>
            </div>
            <p>This code expires in 1 hour. If you didn't request this, ignore this email.</p>
            <p style="color: #888; font-size: 12px;">Reset Token: {token}</p>
            <p style="color: #888; font-size: 12px;">— AdaptIQ by ACADEX AI</p>
        </div>
        """
        return cls.send_email(email, "AdaptIQ — Password Reset OTP", html)

    @classmethod
    def send_quiz_result(cls, email: str, full_name: str, quiz_title: str, score: float, passed: bool):
        """Send quiz result notification email."""
        status = "Passed ✅" if passed else "Needs Improvement"
        color = "#22c55e" if passed else "#f59e0b"
        html = f"""
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #6C63FF, #9680F2); padding: 30px; border-radius: 16px; text-align: center; margin-bottom: 20px;">
                <h1 style="color: white; margin: 0;">Quiz Results</h1>
            </div>
            <p>Hello <strong>{full_name}</strong>,</p>
            <p>Here are your results for <strong>{quiz_title}</strong>:</p>
            <div style="background: #F5F3FF; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
                <h2 style="color: {color}; font-size: 36px; margin: 0;">{score:.1f}%</h2>
                <p style="color: {color}; font-weight: bold;">{status}</p>
            </div>
            <p>Login to see detailed results and explanations.</p>
            <p style="color: #888; font-size: 12px;">— AdaptIQ by ACADEX AI</p>
        </div>
        """
        return cls.send_email(email, f"Quiz Result: {quiz_title} — {score:.0f}%", html)

    @classmethod
    def send_certificate(cls, email: str, full_name: str, course_title: str, cert_number: str, pdf_path: str = None):
        """Send certificate email with PDF attachment."""
        html = f"""
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #6C63FF, #9680F2); padding: 30px; border-radius: 16px; text-align: center; margin-bottom: 20px;">
                <h1 style="color: white; margin: 0;">🎉 Congratulations!</h1>
            </div>
            <p>Hello <strong>{full_name}</strong>,</p>
            <p>You have successfully completed <strong>{course_title}</strong>!</p>
            <div style="background: #F5F3FF; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
                <p style="font-size: 14px; color: #666;">Certificate Number</p>
                <h3 style="color: #6C63FF;">{cert_number}</h3>
            </div>
            <p>Your certificate is attached to this email and available in your profile.</p>
            <p style="color: #888; font-size: 12px;">— AdaptIQ by ACADEX AI</p>
        </div>
        """
        return cls.send_email(email, f"Certificate: {course_title} Completed!", html, pdf_path)

    @classmethod
    def send_roadmap_created(cls, email: str, full_name: str, roadmap_title: str):
        """Send notification when roadmap is created."""
        html = f"""
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #6C63FF, #9680F2); padding: 30px; border-radius: 16px; text-align: center; margin-bottom: 20px;">
                <h1 style="color: white; margin: 0;">New Learning Roadmap</h1>
            </div>
            <p>Hello <strong>{full_name}</strong>,</p>
            <p>Your new personalized learning roadmap <strong>"{roadmap_title}"</strong> has been generated!</p>
            <p>Login to view your weekly goals, estimated study hours, and resource recommendations.</p>
            <p style="color: #888; font-size: 12px;">— AdaptIQ by ACADEX AI</p>
        </div>
        """
        return cls.send_email(email, f"New Roadmap: {roadmap_title}", html)

    @classmethod
    def send_welcome_student(cls, email, full_name, role="student"):
        """Send welcome email to newly registered user."""
        login_url = "http://localhost:3000/login"
        html = f"""
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #6C63FF, #9680F2); padding: 30px; border-radius: 16px; text-align: center; margin-bottom: 20px;">
                <h1 style="color: white; margin: 0;">Welcome to AdaptIQ! 🎓</h1>
            </div>
            <p>Hello <strong>{full_name}</strong>,</p>
            <p>Your <strong>{role}</strong> account has been created successfully on <strong>AdaptIQ</strong> — an AI-powered adaptive learning platform by ACADEX AI.</p>
            <div style="background: #F5F3FF; padding: 20px; border-radius: 12px; margin: 20px 0;">
                <h3 style="color: #6C63FF; margin-top: 0;">Getting Started</h3>
                <ul style="color: #555; line-height: 1.8;">
                    <li>📚 Browse and enroll in courses</li>
                    <li>🧪 Take AI-generated quizzes to assess your knowledge</li>
                    <li>🗺️ Get personalized learning roadmaps</li>
                    <li>🏆 Earn certificates upon course completion</li>
                    <li>💬 Chat with the AI Tutor anytime</li>
                </ul>
            </div>
            <div style="text-align: center; margin: 20px 0;">
                <a href="{login_url}" style="display: inline-block; background: #6C63FF; color: white; padding: 12px 32px; border-radius: 12px; text-decoration: none; font-weight: bold;">Log In to AdaptIQ</a>
            </div>
            <p style="color: #888; font-size: 12px;">— AdaptIQ by ACADEX AI</p>
        </div>
        """
        return cls.send_email(email, "Welcome to AdaptIQ — Let's Start Learning!", html)

    @classmethod
    def send_comeback_reminder(cls, email: str, full_name: str):
        """Send 'come back' reminder after inactivity."""
        html = f"""
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #6C63FF, #9680F2); padding: 30px; border-radius: 16px; text-align: center; margin-bottom: 20px;">
                <h1 style="color: white; margin: 0;">We Miss You! 👋</h1>
            </div>
            <p>Hello <strong>{full_name}</strong>,</p>
            <p>It's been a while since your last visit. Your learning roadmap is waiting for you!</p>
            <p>Don't break your streak — jump back in and continue learning.</p>
            <p style="color: #888; font-size: 12px;">— AdaptIQ by ACADEX AI</p>
        </div>
        """
        return cls.send_email(email, "We Miss You — Continue Your Learning Journey!", html)
