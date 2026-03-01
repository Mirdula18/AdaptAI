# 🎓 AdaptIQ — ACADEX AI

> **Complete, Offline-Capable, AI-Powered Adaptive Learning Platform**

AdaptIQ is a full-stack learning management system with AI quiz generation, personalized roadmaps, and comprehensive analytics — all powered by local LLM inference via Ollama.

![Stack](https://img.shields.io/badge/Backend-Flask-blue) ![Stack](https://img.shields.io/badge/Frontend-Next.js-black) ![Stack](https://img.shields.io/badge/LLM-Ollama-green) ![Stack](https://img.shields.io/badge/DB-SQLite-orange) ![Stack](https://img.shields.io/badge/Theme-Purple-purple)

---

## ✨ Features

| Module | Description |
|---|---|
| **User/Role System** | JWT auth, 3 roles (student, instructor, admin), profile management |
| **Course Management** | Full CRUD with topics, difficulty levels, enrollment tracking |
| **Learning Materials** | Upload PDF/DOCX/videos, organize by topic and course |
| **AI Quiz Engine** | Generate quizzes from any topic via Ollama LLM, auto-grade |
| **Roadmap Generator** | Personalized weekly learning plans based on quiz performance |
| **Admin Dashboard** | User management, platform analytics, audit logs |
| **Quiz Attempt Logging** | Full history, score trends, time tracking |
| **License System** | Activation key management for deployment |
| **CSV Export** | Export quiz attempts and analytics data |
| **Docker Deployment** | One-command full stack deployment |

---

## 🏗️ Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│   Ollama     │
│  Next.js     │     │  Flask API   │     │  LLM Engine  │
│  Port 3000   │     │  Port 8000   │     │  Port 11434  │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                     ┌──────▼───────┐
                     │   SQLite DB  │
                     │  acadex.db   │
                     └──────────────┘
```

---

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone and navigate
cd "Acadex AI"

# Start everything
docker-compose up --build

# Pull an LLM model (in a separate terminal)
docker exec -it acadex-ollama ollama pull gemma:2b
```

Then open **http://localhost:3000**

### Option 2: Manual Setup

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Start the server
python run.py
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

#### Ollama (for AI features)

```bash
# Install Ollama from https://ollama.ai
ollama serve

# Pull a model
ollama pull gemma:2b
```

---

## 🔑 Default Credentials

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |

> ⚠️ Change the admin password after first login!

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh JWT token |
| GET | `/api/auth/me` | Get current user |

### Courses
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/courses/` | List courses |
| POST | `/api/courses/` | Create course |
| GET | `/api/courses/:id` | Get course details |
| PUT | `/api/courses/:id` | Update course |
| DELETE | `/api/courses/:id` | Delete course |
| POST | `/api/courses/:id/enroll` | Enroll in course |

### Quizzes
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/quizzes/` | List quizzes |
| POST | `/api/quizzes/generate` | AI-generate a quiz |
| GET | `/api/quizzes/:id` | Get quiz with questions |
| POST | `/api/quizzes/:id/submit` | Submit quiz attempt |
| GET | `/api/quizzes/my-attempts` | Get my attempts |

### Roadmaps
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/roadmaps/` | List roadmaps |
| POST | `/api/roadmaps/generate` | AI-generate roadmap |
| GET | `/api/roadmaps/:id` | Get roadmap plan |

### Materials
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/materials/` | List materials |
| POST | `/api/materials/` | Upload material |
| GET | `/api/materials/:id/download` | Download file |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/dashboard` | Platform stats |
| GET | `/api/admin/quiz-analytics` | Quiz performance data |
| GET | `/api/admin/audit-logs` | Audit trail |
| GET | `/api/admin/export/attempts` | CSV export |

---

## 🧪 Running Tests

```bash
cd backend
pip install pytest
pytest tests/ -v
```

---

## 🎨 Theme

The platform uses a custom light purple theme:

| Token | Color | Hex |
|---|---|---|
| Primary | Purple | `#6C63FF` |
| Surface | Light Purple | `#F5F3FF` |
| Background | Lavender | `#FAFAFF` |
| Primary Light | Pale Purple | `#EAE6FD` |

---

## 📁 Project Structure

```
Acadex AI/
├── backend/
│   ├── app/
│   │   ├── __init__.py          # App factory
│   │   ├── models.py            # SQLAlchemy models
│   │   ├── utils.py             # Decorators & helpers
│   │   ├── llm_service.py       # Ollama LLM integration
│   │   └── routes/
│   │       ├── auth.py          # Authentication
│   │       ├── courses.py       # Course CRUD
│   │       ├── materials.py     # File upload/download
│   │       ├── quizzes.py       # Quiz generation & grading
│   │       ├── roadmaps.py      # AI roadmap generation
│   │       ├── users.py         # User management
│   │       ├── admin.py         # Admin dashboard
│   │       ├── analytics.py     # Student analytics
│   │       └── license.py       # License system
│   ├── tests/
│   ├── config.py
│   ├── run.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.tsx       # Sidebar layout
│   │   │   └── ui.tsx           # Reusable UI components
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx   # Auth state management
│   │   ├── lib/
│   │   │   └── api.ts           # Axios API client
│   │   ├── pages/
│   │   │   ├── index.tsx        # Landing page
│   │   │   ├── login.tsx        # Login
│   │   │   ├── register.tsx     # Registration
│   │   │   ├── dashboard.tsx    # Role-based dashboard
│   │   │   ├── progress.tsx     # Student analytics
│   │   │   ├── materials.tsx    # Material management
│   │   │   ├── courses/         # Course pages
│   │   │   ├── quizzes/         # Quiz pages
│   │   │   ├── roadmaps/        # Roadmap pages
│   │   │   └── admin/           # Admin pages
│   │   └── styles/
│   │       └── globals.css
│   ├── package.json
│   ├── tailwind.config.js
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 🛡️ License Key

Default license key: `ACADEX-PRO-2024`

Activate via Admin → Settings or API:
```bash
curl -X POST http://localhost:8000/api/license/activate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"license_key": "ACADEX-PRO-2024"}'
```

---

## 🤖 LLM Configuration

The platform uses **Ollama** for local AI inference. Supported models:

| Model | Size | Recommended For |
|---|---|---|
| `gemma:2b` | ~1.5GB | Low-resource machines |
| `llama3:8b` | ~4.7GB | Best quality/speed balance |
| `mistral:7b` | ~4.1GB | Great for quizzes |

Change the model in `backend/.env`:
```
LLM_MODEL=llama3:8b
```

---

Built with ❤️ by **ACADEX AI Team**
