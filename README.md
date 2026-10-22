# SkillBridge AI — Evidence-Based Job Readiness Platform

> **Evidence-Based Job Readiness Platform**  
> Connecting target job descriptions to learner evidence, deterministic matching, controlled practical assessments, and deadline-aware roadmaps.

---

## 📚 Complete Project Documentation

To get started, develop features, or integrate with existing services, refer to the dedicated documentation in the [`docs/`](docs/) directory:

- 📖 **[Development Setup & Run Guide](docs/development-setup.md)**: Prerequisites, environment variables, step-by-step local setup for Windows/PowerShell and macOS/Linux, testing suites, and troubleshooting.
- 🔌 **[API Contract & Specifications](docs/api-contract.md)**: Verified endpoints, authentication conventions, multipart file upload fields, request/response schemas, and realistic synthetic examples.
- 🏗️ **[Architecture & Integration Workflow](docs/architecture-and-workflow.md)**: System architecture, component boundaries, Mermaid sequence diagrams for the resume-upload pipeline, and extension guides for teammates.
- 📊 **[Integration & Verification Status Matrix](docs/integration-status.md)**: Explicit status breakdown of what is implemented and verified, what is scaffolding, and what is planned.

---

## ⚡ Quick Start

### Prerequisites
- **Node.js** (v20+ recommended) & **npm**
- **Python** (3.11–3.14) with virtual environment support
- **Docker Desktop** (for LocalStack cloud emulation)

### 1. One-Click Bootstrap (Windows PowerShell)
```powershell
.\start-dev.ps1
```
This script automatically initializes `.env`, launches LocalStack with automated cloud resource provisioning (S3, SQS, Lambda, API Gateway), and applies Django migrations against Neon PostgreSQL.

### 2. Run Services

```powershell
# Terminal 1: Backend API Server (Port 8000)
npm run backend:dev
# (or: python backend/manage.py runserver 0.0.0.0:8000)

# Terminal 2: Frontend Vite Server (Port 5173)
npm run frontend:dev
# (or: cd frontend && npm run dev)
```

- **Frontend Application**: `http://localhost:5173/`
- **Backend API Root**: `http://127.0.0.1:8000/api/`
- **Backend Health Check**: `http://127.0.0.1:8000/`

---

## 🧪 Automated Testing

The repository maintains automated test suites across all layers:

```powershell
# Run all backend unit & API tests (14 passed)
npm run backend:test

# Run frontend React component tests (6 passed)
npm run frontend:test

# Run end-to-end browser tests in Microsoft Edge (Playwright)
npm run test:e2e
```

---

## 🏗️ Repository Structure

```text
Skill-bridge-AI/
├── README.md                     # Main entry point & overview
├── package.json                  # Root convenience scripts (npm run backend:*, frontend:*)
├── start-dev.ps1                 # Automated developer environment bootstrapper
├── docker-compose.yml            # LocalStack cloud emulation service
├── .env.example                  # Template with safe placeholders (no secrets)
│
├── docs/                         # Detailed developer documentation
│   ├── api-contract.md           # Django REST API contract & payload schemas
│   ├── development-setup.md      # Step-by-step setup, configuration & troubleshooting
│   ├── architecture-and-workflow.md # Architectural diagrams & cloud workflow
│   └── integration-status.md     # Verified component status matrix
│
├── frontend/                     # React 19 + TypeScript + Vite + Tailwind CSS v4
│   ├── src/
│   │   ├── components/           # UI components (Navbar, StatusBadge)
│   │   ├── pages/                # Dashboard, Profile, JobAnalysis, SkillGap, Assessment, Roadmap
│   │   ├── services/api.ts       # Typed API client connecting to Django backend
│   │   └── types/                # Domain TypeScript interfaces
│   └── test/                     # Vitest component unit tests
│
├── backend/                      # Django REST API
│   ├── manage.py
│   ├── requirements.txt          # Python dependencies (Django, DRF, boto3, pgvector, etc.)
│   ├── skillbridge_backend/      # Core settings, database routing, CORS
│   ├── apps/
│   │   ├── profiles/             # Learner profiles, evidence portfolio, resume uploads
│   │   ├── job_analysis/         # Job description analysis, requirement extraction, goals
│   │   ├── skill_matching/       # Deterministic matching engine & deadline feasibility
│   │   ├── assessments/          # Controlled assessment tasks & rubric submission
│   │   └── roadmap/              # Prioritized remediation tasks & checklist
│   └── services/
│       ├── aws_service.py        # S3 resume upload & SQS job dispatching with fallbacks
│       ├── openrouter_service.py # OpenRouter LLM (Gemma) & Embeddings (Nemotron)
│       ├── rag_multimodal_service.py # Vector embedding & pgvector semantic search scaffold
│       └── matching_engine.py    # Deterministic matching & feasibility calculator
│
├── lambda/                       # AWS Lambda functions
│   └── resume_processor/         # SQS-triggered resume processing function (Python 3.12)
│       └── handler.py
│
├── localstack-init/              # Zero-touch LocalStack automated init scripts
│   └── 01-init-aws.sh            # Auto-provisions S3, SQS, Lambda, alarms & API Gateway
│
└── data/                         # Sample job descriptions and learner profiles
    ├── sample_job_description.txt
    ├── sample_learner_profile.json
    └── api_testing_rubric.json
```

---

## ☁️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React, Vitest, Playwright |
| **Backend** | Python, Django 5.x / 6.0, Django REST Framework, pytest-django |
| **Database & Vector DB** | Neon Serverless PostgreSQL (18.6) + `pgvector` extension (2048-dim vectors) |
| **Cloud Emulation** | LocalStack (S3, SQS, Lambda, CloudWatch, API Gateway) via Docker Compose |
| **AI Foundation Models** | OpenRouter (`google/gemma-4-26b-a4b-it:free`, `nvidia/nemotron-3-embed-1b:free`) |

---

## 📋 Teammate Onboarding Checklist

When joining the project, complete these initial steps:
1. [ ] Clone the repository and run `Copy-Item .env.example .env`.
2. [ ] Fill in `DATABASE_URL` (Neon PostgreSQL) and `OPENROUTER_API_KEY` in `.env`.
3. [ ] Launch Docker Desktop and execute `.\start-dev.ps1`.
4. [ ] Run `npm run backend:test` and `npm run frontend:test` to confirm baseline test suite passes.
5. [ ] Read **[docs/api-contract.md](docs/api-contract.md)** and **[docs/architecture-and-workflow.md](docs/architecture-and-workflow.md)** before writing new code.
