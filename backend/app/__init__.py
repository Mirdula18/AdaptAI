import os
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_sqlalchemy import SQLAlchemy

from config import config_map

db = SQLAlchemy()
jwt = JWTManager()


def create_app(config_name=None):
    if config_name is None:
        config_name = os.getenv("FLASK_ENV", "development")

    app = Flask(__name__)
    app.config.from_object(config_map.get(config_name, config_map["development"]))

    # Ensure upload directory exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Initialize extensions
    db.init_app(app)
    jwt.init_app(app)
    CORS(app, origins=app.config["CORS_ORIGINS"], supports_credentials=True)

    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.courses import courses_bp
    from app.routes.materials import materials_bp
    from app.routes.quizzes import quizzes_bp
    from app.routes.roadmaps import roadmaps_bp
    from app.routes.admin import admin_bp
    from app.routes.users import users_bp
    from app.routes.analytics import analytics_bp
    from app.routes.license import license_bp
    from app.routes.notifications import notifications_bp
    from app.routes.certificates import certificates_bp
    from app.routes.chatbot import chatbot_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(courses_bp, url_prefix="/api/courses")
    app.register_blueprint(materials_bp, url_prefix="/api/materials")
    app.register_blueprint(quizzes_bp, url_prefix="/api/quizzes")
    app.register_blueprint(roadmaps_bp, url_prefix="/api/roadmaps")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(analytics_bp, url_prefix="/api/analytics")
    app.register_blueprint(license_bp, url_prefix="/api/license")
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
    app.register_blueprint(certificates_bp, url_prefix="/api/certificates")
    app.register_blueprint(chatbot_bp, url_prefix="/api/chatbot")

    # Create tables
    with app.app_context():
        from app import models  # noqa: F401
        db.create_all()
        _seed_admin(app)
        _seed_sample_data(app)

    return app


def _seed_admin(app):
    """Create default admin user if none exists."""
    from app.models import User
    with app.app_context():
        admin = User.query.filter_by(role="admin").first()
        if not admin:
            admin = User(
                username="admin",
                email="admin@acadex.local",
                full_name="System Administrator",
                role="admin",
            )
            admin.set_password("admin123")
            db.session.add(admin)
            db.session.commit()


def _seed_sample_data(app):
    """Seed sample courses, topics, materials, and quizzes for beginners."""
    from app.models import User, Course, Topic, Material, Quiz, QuizQuestion
    with app.app_context():
        # Only seed if no courses exist yet
        if Course.query.first():
            return

        admin = User.query.filter_by(role="admin").first()
        if not admin:
            return

        # ── Topics ───────────────────────────────────────────────
        topics_data = [
            {"name": "Python Basics", "description": "Core Python programming concepts", "keywords": "python,variables,loops,functions"},
            {"name": "Data Structures", "description": "Arrays, lists, dictionaries, sets", "keywords": "arrays,lists,dicts,sets,stacks,queues"},
            {"name": "Web Development", "description": "HTML, CSS, JavaScript fundamentals", "keywords": "html,css,javascript,web"},
            {"name": "Database Fundamentals", "description": "SQL, relational databases, CRUD", "keywords": "sql,database,crud,tables"},
        ]
        topics = []
        for td in topics_data:
            t = Topic(name=td["name"], description=td["description"], keywords=td["keywords"])
            db.session.add(t)
            topics.append(t)
        db.session.flush()

        # ── Courses ──────────────────────────────────────────────
        courses_data = [
            {
                "title": "Python Programming for Beginners",
                "description": "Learn Python from scratch. Covers variables, data types, control flow, functions, and basic OOP. Perfect for absolute beginners.",
                "duration": "4 weeks",
                "topics": [0, 1],
            },
            {
                "title": "Web Development Fundamentals",
                "description": "Build your first website with HTML, CSS, and JavaScript. Learn responsive design, DOM manipulation, and basic interactivity.",
                "duration": "6 weeks",
                "topics": [2],
            },
            {
                "title": "Database & SQL Essentials",
                "description": "Master relational databases, SQL queries, joins, aggregations, and database design principles.",
                "duration": "3 weeks",
                "topics": [3],
            },
        ]

        courses = []
        for cd in courses_data:
            course = Course(
                title=cd["title"],
                description=cd["description"],
                estimated_duration=cd["duration"],
                instructor_id=admin.id,
                is_published=True,
            )
            course.topics = [topics[i] for i in cd["topics"]]
            db.session.add(course)
            courses.append(course)
        db.session.flush()

        # ── Materials (beginner study materials per course) ──────
        materials_data = [
            # Python course materials
            {"title": "Python Installation Guide", "desc": "Step-by-step guide to install Python and set up your development environment. Covers Windows, Mac, and Linux.", "type": "document", "course": 0},
            {"title": "Variables & Data Types", "desc": "Learn about integers, floats, strings, booleans, and type conversion in Python. Includes practice exercises.", "type": "document", "course": 0},
            {"title": "Control Flow: If/Else & Loops", "desc": "Master conditional statements (if/elif/else) and loops (for/while). Learn break, continue, and range().", "type": "document", "course": 0},
            {"title": "Functions & Modules", "desc": "Define and call functions, understand parameters, return values, scope, and how to import modules.", "type": "document", "course": 0},
            {"title": "Lists, Tuples & Dictionaries", "desc": "Deep dive into Python collections: creating, accessing, modifying, and iterating over data structures.", "type": "document", "course": 0},
            # Web Dev course materials
            {"title": "HTML Basics: Structure & Tags", "desc": "Learn HTML document structure, headings, paragraphs, links, images, lists, tables, and forms.", "type": "document", "course": 1},
            {"title": "CSS Fundamentals: Styling Pages", "desc": "Selectors, properties, box model, flexbox, grid layout, colors, fonts, and responsive design basics.", "type": "document", "course": 1},
            {"title": "JavaScript Essentials", "desc": "Variables, functions, DOM manipulation, event handlers, and basic interactivity for web pages.", "type": "document", "course": 1},
            # Database course materials
            {"title": "Introduction to Databases", "desc": "What are databases, types of databases, relational vs NoSQL, tables, rows, columns, and primary keys.", "type": "document", "course": 2},
            {"title": "SQL CRUD Operations", "desc": "Learn SELECT, INSERT, UPDATE, DELETE statements. Filtering with WHERE, sorting with ORDER BY, and LIMIT.", "type": "document", "course": 2},
            {"title": "Joins & Aggregations", "desc": "INNER JOIN, LEFT JOIN, RIGHT JOIN, GROUP BY, HAVING, COUNT, SUM, AVG, and subqueries.", "type": "document", "course": 2},
        ]

        for md in materials_data:
            mat = Material(
                title=md["title"],
                description=md["desc"],
                material_type=md["type"],
                course_id=courses[md["course"]].id,
                uploaded_by=admin.id,
            )
            db.session.add(mat)

        # ── Quizzes (beginner quizzes per course) ────────────────
        quiz_questions = {
            0: {  # Python course
                "title": "Python Basics Quiz",
                "questions": [
                    {"q": "What is the correct way to create a variable in Python?", "a": "x = 5", "b": "int x = 5", "c": "var x = 5", "d": "dim x = 5", "ans": "A", "exp": "Python uses dynamic typing. Simply assign a value with = to create a variable."},
                    {"q": "Which data type is used for text in Python?", "a": "int", "b": "float", "c": "str", "d": "char", "ans": "C", "exp": "str (string) is used for text data in Python. Python doesn't have a char type."},
                    {"q": "What does the len() function do?", "a": "Returns the type", "b": "Returns the length", "c": "Converts to list", "d": "Deletes an item", "ans": "B", "exp": "len() returns the number of items in a sequence (string, list, tuple, etc.)."},
                    {"q": "How do you start a for loop in Python?", "a": "for(i=0;i<n;i++)", "b": "for i in range(n):", "c": "foreach i in n:", "d": "loop i = 0 to n:", "ans": "B", "exp": "Python uses 'for variable in iterable:' syntax with a colon and indentation."},
                    {"q": "What is a Python dictionary?", "a": "An ordered sequence", "b": "A key-value pair collection", "c": "A linked list", "d": "An immutable tuple", "ans": "B", "exp": "A dictionary stores key-value pairs, accessed by unique keys. Defined with {key: value}."},
                ],
            },
            1: {  # Web Dev course
                "title": "Web Development Basics Quiz",
                "questions": [
                    {"q": "What does HTML stand for?", "a": "Hyper Text Markup Language", "b": "High Tech Modern Language", "c": "Hyper Transfer Markup Language", "d": "Home Tool Markup Language", "ans": "A", "exp": "HTML = HyperText Markup Language, the standard markup language for creating web pages."},
                    {"q": "Which CSS property changes text color?", "a": "font-color", "b": "text-color", "c": "color", "d": "foreground", "ans": "C", "exp": "The 'color' property in CSS sets the text color of an element."},
                    {"q": "What does CSS stand for?", "a": "Computer Style Sheets", "b": "Cascading Style Sheets", "c": "Creative Style System", "d": "Colorful Style Sheets", "ans": "B", "exp": "CSS = Cascading Style Sheets, used for styling HTML documents."},
                    {"q": "Which HTML tag creates a hyperlink?", "a": "<link>", "b": "<href>", "c": "<a>", "d": "<url>", "ans": "C", "exp": "The <a> (anchor) tag creates hyperlinks. Usage: <a href='url'>text</a>."},
                    {"q": "How do you select an element by ID in JavaScript?", "a": "document.getElement('id')", "b": "document.getElementById('id')", "c": "document.query('id')", "d": "document.find('id')", "ans": "B", "exp": "document.getElementById() is the standard method to select a DOM element by its ID."},
                ],
            },
            2: {  # Database course
                "title": "SQL Fundamentals Quiz",
                "questions": [
                    {"q": "What does SQL stand for?", "a": "Structured Query Language", "b": "Simple Query Logic", "c": "Standard Question Language", "d": "Sequential Query Loop", "ans": "A", "exp": "SQL = Structured Query Language, used to manage and query relational databases."},
                    {"q": "Which SQL keyword retrieves data from a table?", "a": "GET", "b": "FETCH", "c": "SELECT", "d": "RETRIEVE", "ans": "C", "exp": "SELECT is the SQL statement used to query and retrieve data from tables."},
                    {"q": "Which clause filters rows in a SQL query?", "a": "FILTER", "b": "WHERE", "c": "HAVING", "d": "WHEN", "ans": "B", "exp": "WHERE filters rows before grouping. HAVING filters after GROUP BY."},
                    {"q": "What is a PRIMARY KEY?", "a": "A foreign reference", "b": "A unique row identifier", "c": "A table name", "d": "An index type", "ans": "B", "exp": "A primary key uniquely identifies each row in a table. It must be unique and NOT NULL."},
                    {"q": "Which JOIN returns all rows from both tables?", "a": "INNER JOIN", "b": "LEFT JOIN", "c": "FULL OUTER JOIN", "d": "CROSS JOIN", "ans": "C", "exp": "FULL OUTER JOIN returns all rows from both tables, with NULLs where there's no match."},
                ],
            },
        }

        for course_idx, qdata in quiz_questions.items():
            quiz = Quiz(
                title=qdata["title"],
                course_id=courses[course_idx].id,
                generated_by=admin.id,
                num_questions=len(qdata["questions"]),
                difficulty="easy",
                is_active=True,
                approval_status="approved",
            )
            db.session.add(quiz)
            db.session.flush()

            for idx, q in enumerate(qdata["questions"]):
                question = QuizQuestion(
                    quiz_id=quiz.id,
                    question_text=q["q"],
                    option_a=q["a"],
                    option_b=q["b"],
                    option_c=q["c"],
                    option_d=q["d"],
                    correct_answer=q["ans"],
                    explanation=q["exp"],
                    order_index=idx,
                )
                db.session.add(question)

        db.session.commit()
        print("[SEED] Sample courses, materials, and quizzes created.")
