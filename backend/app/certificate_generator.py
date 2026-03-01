"""
Certificate Generator — Creates PDF certificates using ReportLab.
"""
import os
from datetime import datetime, timezone
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.units import inch, cm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_CENTER
from flask import current_app


class CertificateGenerator:
    """Generate PDF certificates for course completion."""

    PRIMARY = HexColor("#6C63FF")
    DARK = HexColor("#1a1a2e")
    GRAY = HexColor("#666666")
    LIGHT_BG = HexColor("#F5F3FF")

    @classmethod
    def generate(cls, full_name: str, course_title: str, score: float,
                 certificate_number: str, date_str: str = None) -> str:
        """Generate a PDF certificate and return the file path."""

        if date_str is None:
            date_str = datetime.now(timezone.utc).strftime("%B %d, %Y")

        # Ensure certs directory exists
        certs_dir = os.path.join(current_app.config.get("UPLOAD_FOLDER", "uploads"), "certificates")
        os.makedirs(certs_dir, exist_ok=True)

        filename = f"{certificate_number}.pdf"
        filepath = os.path.join(certs_dir, filename)

        width, height = landscape(A4)
        c = canvas.Canvas(filepath, pagesize=landscape(A4))

        # Background
        c.setFillColor(HexColor("#FAFAFF"))
        c.rect(0, 0, width, height, fill=True, stroke=False)

        # Border
        c.setStrokeColor(cls.PRIMARY)
        c.setLineWidth(3)
        c.rect(30, 30, width - 60, height - 60, fill=False, stroke=True)

        # Inner border
        c.setStrokeColor(HexColor("#EAE6FD"))
        c.setLineWidth(1)
        c.rect(40, 40, width - 80, height - 80, fill=False, stroke=True)

        # Header accent bar
        c.setFillColor(cls.PRIMARY)
        c.rect(30, height - 100, width - 60, 70, fill=True, stroke=False)

        # Platform name in accent bar
        c.setFillColor(HexColor("#FFFFFF"))
        c.setFont("Helvetica-Bold", 16)
        c.drawCentredString(width / 2, height - 75, "AdaptIQ — ACADEX AI")

        # Certificate title
        c.setFillColor(cls.PRIMARY)
        c.setFont("Helvetica-Bold", 32)
        c.drawCentredString(width / 2, height - 160, "Certificate of Completion")

        # Decorative line
        c.setStrokeColor(cls.PRIMARY)
        c.setLineWidth(2)
        c.line(width / 2 - 100, height - 175, width / 2 + 100, height - 175)

        # "This is to certify that"
        c.setFillColor(cls.GRAY)
        c.setFont("Helvetica", 14)
        c.drawCentredString(width / 2, height - 210, "This is to certify that")

        # Student name
        c.setFillColor(cls.DARK)
        c.setFont("Helvetica-Bold", 28)
        c.drawCentredString(width / 2, height - 250, full_name)

        # Underline name
        name_width = c.stringWidth(full_name, "Helvetica-Bold", 28)
        c.setStrokeColor(cls.PRIMARY)
        c.setLineWidth(1.5)
        c.line(width / 2 - name_width / 2, height - 258, width / 2 + name_width / 2, height - 258)

        # "has successfully completed"
        c.setFillColor(cls.GRAY)
        c.setFont("Helvetica", 14)
        c.drawCentredString(width / 2, height - 290, "has successfully completed the course")

        # Course title
        c.setFillColor(cls.DARK)
        c.setFont("Helvetica-Bold", 22)
        c.drawCentredString(width / 2, height - 325, course_title)

        # Score
        c.setFillColor(cls.PRIMARY)
        c.setFont("Helvetica-Bold", 16)
        c.drawCentredString(width / 2, height - 360, f"with a score of {score:.1f}%")

        # Footer info
        c.setFillColor(cls.GRAY)
        c.setFont("Helvetica", 11)
        c.drawCentredString(width / 2, 90, f"Certificate No: {certificate_number}  |  Date: {date_str}")

        # Footer accent
        c.setFillColor(cls.PRIMARY)
        c.rect(30, 30, width - 60, 30, fill=True, stroke=False)
        c.setFillColor(HexColor("#FFFFFF"))
        c.setFont("Helvetica", 9)
        c.drawCentredString(width / 2, 40, "Powered by AdaptIQ — AI-Powered Adaptive Learning Platform")

        c.save()
        return filepath
