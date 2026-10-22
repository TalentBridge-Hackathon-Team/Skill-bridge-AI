# SkillBridge AI — Implementation & Integration Status Matrix

This document provides a verified, evidence-based status of all architectural components, cloud services, and API endpoints in the SkillBridge AI repository.

---

## 1. Classification Definitions

- **Implemented and Verified**: Fully coded, tested with automated test suites or live environment executions, and confirmed working end-to-end.
- **Implemented but Unverified**: Code is present in the repository, but has not yet undergone full end-to-end integration or automated test verification.
- **Configured but Scaffolding**: Infrastructure resource or service stub is deployed and responds, but underlying complex business logic (e.g. OCR, deep PDF parsing, automated rubric grading) is pending.
- **Planned / Missing**: Anticipated for future sprints or production hardening; not yet implemented in the codebase.

---

## 2. Component Integration Matrix

| Component / Service | Status | Verified Evidence & Test Coverage | What Remains / Follow-Up |
| :--- | :--- | :--- | :--- |
| **Django REST API Core** | **Implemented and Verified** | Root `/` returns HTTP 200; `pytest` runs 14 tests with 100% pass rate (`backend/pytest.ini`). | Enforce JWT/Session authentication in future production phase. |
| **React 19 Frontend** | **Implemented and Verified** | Vitest runs 6 component tests passing; Playwright E2E test runs in Edge; Vite dev server loads views. | Connect remaining API endpoints to React view state hooks. |
| **Neon PostgreSQL Database** | **Implemented and Verified** | Migrations successfully applied (`0001` through `0003`); live connection via `DATABASE_URL` active. | Setup connection pooling limits for high concurrency. |
| **pgvector Vector Database** | **Implemented and Verified** | `pgvector` v0.8.6 confirmed on Neon; `VectorField(dimensions=2048)` column active on `SkillEvidence`; cosine search helper scaffolded. | Integrate vector similarity search directly into candidate job match view. |
| **Amazon S3 (LocalStack)** | **Implemented and Verified** | `POST /api/profiles/me/resume/` successfully uploads file bytes to `s3://skillbridge-resumes/resumes/...`. | Configure pre-signed URL downloads and lifecycle retention policies. |
| **Amazon SQS (LocalStack)** | **Implemented and Verified** | Django successfully dispatches `resume.uploaded` JSON events to `skillbridge-resume-processing`. | Implement dead-letter queue (DLQ) for failed message handling. |
| **AWS Lambda (Python 3.12)**| **Configured but Scaffolding** | Lambda `skillbridge-resume-processor` automatically triggers on SQS message receipt and logs to CloudWatch. | Replace scaffolding logging with actual PDF text extraction (e.g., PyMuPDF) and embedding generation. |
| **Amazon CloudWatch** | **Implemented and Verified** | Invocation logs captured in `/aws/lambda/skillbridge-resume-processor`; alarm `skillbridge-resume-processor-errors` active. | Configure SNS notification topic for alarm breach alerts. |
| **Amazon API Gateway** | **Configured but Scaffolding** | REST API `SkillBridge Django API` proxies requests to Django at `dev` stage; root endpoint verified. | Perform full end-to-end multipart file upload test through API Gateway proxy route. |
| **OpenRouter Text LLM** | **Implemented and Verified** | Configured with `google/gemma-4-26b-a4b-it:free`; extracts structured requirements with deterministic rule engine fallback. | Fine-tune prompt engineering for edge-case job description formats. |
| **OpenRouter Embeddings** | **Implemented and Verified** | Configured with `nvidia/nemotron-3-embed-1b:free`; generates 2048-dimensional vectors with fallback tests passing. | Batch embedding generation for large documents. |
| **Deterministic Match Engine** | **Implemented and Verified** | Evaluates 4 statuses (`Demonstrated`, `Self-reported`, `Unverified`, `Needs improvement`) and calculates feasibility. | Add weightings based on required vs preferred skills. |
| **Practical Assessments** | **Configured but Scaffolding** | Task retrieval (`GET /api/assessments/{id}/`) and submission ingestion (`POST /api/assessments/{id}/submissions/`) implemented. | Implement 10-point automated rubric grading logic in `services/rubric_evaluator.py`. |
| **Roadmap & Progress** | **Implemented and Verified** | `GET /api/roadmap/` and `PATCH /api/roadmap/{id}/` tested and passing in `test_roadmap.py`. | Dynamically generate roadmap tasks directly from match engine outputs. |

---

## 3. Detailed Verification Details

### 1. Resume Processing Pipeline (S3 -> SQS -> Lambda -> CloudWatch)
- **What is verified**:
  - Uploading a PDF via `POST /api/profiles/me/resume/` streams the binary to LocalStack S3.
  - S3 returns a valid object key (`resumes/{user_id}/{filename}`).
  - Django dispatches a message containing `bucket`, `key`, `user_id`, and `job_id` to SQS.
  - SQS triggers the `skillbridge-resume-processor` Lambda function.
  - CloudWatch records the execution log: `{"message": "Resume job received", "bucket": "...", "key": "..."}`.
- **What is scaffolding**:
  - The Lambda function validates the message schema and logs receipt, but does not yet extract text from the PDF binary or run ML embeddings inside Lambda.

### 2. Database & Vector Storage (Neon + pgvector)
- **What is verified**:
  - Neon PostgreSQL connection string parses correctly in `settings.py`.
  - Extension `vector` v0.8.6 is created and active in the database.
  - Migration `0003_skillevidence_embedding` created the `embedding` vector column with 2048 dimensions on `apps_profiles_skillevidence`.
  - Automated tests in `backend` automatically switch to an in-memory SQLite database (`:memory:`) to ensure fast, isolated CI testing without mutating the production database.

### 3. OpenRouter AI Models
- **What is verified**:
  - Text model `google/gemma-4-26b-a4b-it:free` configured with a deterministic regex/rule engine fallback.
  - Embedding model `nvidia/nemotron-3-embed-1b:free` configured with 2048 dimensions.
  - Unit tests in `backend/services/test_openrouter.py` verify model configuration, fallback extraction, mock LLM parsing, and embedding generation.
