# SkillBridge AI — API Contract

> **Base URL (Local Development)**: `http://127.0.0.1:8000/api`  
> **API Root Status**: `http://127.0.0.1:8000/`  
> **LocalStack API Gateway URL (Emulated)**: `http://localhost:4566/_aws/execute-api/{api_id}/dev/`  
> **Authentication**: Open / `AllowAny` (Hackathon MVP phase). No session cookies or JWT tokens are currently enforced. Requests correlate state via a `user_id` query parameter or JSON body property (default: `"demo_user"`).

---

## 1. Overview & Conventions

### Global Headers
- **JSON Requests**:
  ```http
  Content-Type: application/json
  Accept: application/json
  ```
- **File Upload Requests (Multipart)**:
  ```http
  Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...
  ```

### Standard Status Codes
- `200 OK`: Request succeeded; entity retrieved or updated.
- `201 Created`: Resource successfully created (e.g., job analysis, uploaded resume, evidence record).
- `400 Bad Request`: Validation failure, missing required fields, or unsupported file payload.
- `404 Not Found`: Resource ID does not exist in the database.
- `500 Internal Server Error`: Unhandled server exception.

### Standard Error Format
When validation or processing fails, Django REST Framework returns a standard JSON error object:
```json
{
  "error": "Human-readable description of what went wrong"
}
```
Or for field-specific model validation errors:
```json
{
  "field_name": [
    "This field is required."
  ]
}
```

---

## 2. API Status & Root Index

### `GET /`
Returns the operational health and index of the primary backend API routes.

- **Status**: **Implemented & Verified**
- **Authentication**: None required (`AllowAny`)
- **Query Parameters**: None

#### Response (`200 OK`)
```json
{
  "project": "SkillBridge AI Backend API",
  "status": "online",
  "endpoints": {
    "profiles": "/api/profiles/me/",
    "goals": "/api/goals/",
    "job_analyses": "/api/job-analyses/",
    "assessments": "/api/assessments/",
    "roadmap": "/api/roadmap/",
    "admin": "/admin/"
  }
}
```

---

## 3. Profiles & Evidence (`/api/profiles/`)

Handles candidate learner profiles, portfolio project evidence records, vector embeddings, and resume document uploads.

---

### `GET /api/profiles/me/`
Retrieves the learner profile for the specified user. If the profile does not yet exist, the view auto-provisions a baseline profile with default values.

- **Status**: **Implemented & Verified** (Tested in `backend/apps/profiles/test_profiles.py`)
- **Authentication**: None (`AllowAny`)
- **Query Parameters**:
  - `user_id` (optional, string, default: `"demo_user"`): Unique identifier of the learner.

#### Response (`200 OK`)
```json
{
  "user_id": "alex_morgan_01",
  "name": "Alex Morgan",
  "target_role": "Junior Backend Developer",
  "education": "B.S. in Computer Science",
  "experience_level": "Entry Level",
  "skills": ["Python", "Django REST Framework", "PostgreSQL", "Git"],
  "resume_file": "/media/resumes/alex_resume.pdf",
  "resume_parsed_text": "Parsed CV text extracted from uploaded resume.",
  "evidence": [
    {
      "evidence_id": "evi_01",
      "skill_name": "Django REST Framework",
      "evidence_type": "project",
      "title": "FinTech Payment Gateway Microservice",
      "reference": "https://github.com/alexmorgan/fintech-payment-api",
      "description": "Production REST API with JWT auth and test suite.",
      "review_status": "verified",
      "created_at": "2026-10-22T14:30:00Z"
    }
  ],
  "updated_at": "2026-10-22T17:15:00Z"
}
```

---

### `PUT /api/profiles/me/`
Updates fields on the candidate learner profile (supports partial updates).

- **Status**: **Implemented & Verified**
- **Authentication**: None (`AllowAny`)
- **Request Body (`application/json`)**:
  ```json
  {
    "user_id": "alex_morgan_01",
    "name": "Alex Morgan",
    "target_role": "Junior Backend Developer",
    "education": "B.S. in Computer Science",
    "experience_level": "Entry Level",
    "skills": ["Python", "Django REST Framework", "PostgreSQL", "Docker"]
  }
  ```

#### Response (`200 OK`)
```json
{
  "user_id": "alex_morgan_01",
  "name": "Alex Morgan",
  "target_role": "Junior Backend Developer",
  "education": "B.S. in Computer Science",
  "experience_level": "Entry Level",
  "skills": ["Python", "Django REST Framework", "PostgreSQL", "Docker"],
  "resume_file": null,
  "resume_parsed_text": "",
  "evidence": [],
  "updated_at": "2026-10-22T17:20:00Z"
}
```

---

### `POST /api/profiles/me/evidence/`
Appends a verified or unverified project, credential, or assessment claim to the learner's evidence portfolio.

- **Status**: **Implemented & Verified**
- **Authentication**: None (`AllowAny`)
- **Request Body (`application/json`)**:
  ```json
  {
    "evidence_id": "evi_proj_02",
    "profile": "alex_morgan_01",
    "skill_name": "PostgreSQL",
    "evidence_type": "project",
    "title": "E-Commerce Database Schema & Indexing",
    "reference": "https://github.com/alexmorgan/ecommerce-sql",
    "description": "Database schema design, query optimization, and pgvector semantic search.",
    "review_status": "verified"
  }
  ```

#### Allowed Field Values:
- `evidence_type`: `'project'` | `'self_reported'` | `'assessment'`
- `review_status`: `'verified'` | `'unverified'` | `'needs_improvement'`

#### Response (`201 Created`)
```json
{
  "evidence_id": "evi_proj_02",
  "skill_name": "PostgreSQL",
  "evidence_type": "project",
  "title": "E-Commerce Database Schema & Indexing",
  "reference": "https://github.com/alexmorgan/ecommerce-sql",
  "description": "Database schema design, query optimization, and pgvector semantic search.",
  "review_status": "verified",
  "created_at": "2026-10-22T17:25:00Z"
}
```

---

### `POST /api/profiles/me/resume/`
Uploads a learner's CV/resume document (.pdf, .docx, .txt), stores the binary in S3 (LocalStack / AWS), records an unverified `SkillEvidence` entry, and pushes a processing event to SQS for asynchronous Lambda consumption.

- **Status**: **Implemented & Verified** (Verified end-to-end via LocalStack S3 and SQS)
- **Content-Type**: `multipart/form-data`
- **Upload Form Fields**:
  - `file` (**required**, File Binary): The resume document (PDF, DOCX, TXT).
  - `user_id` (optional, string, default: `"demo_user"`): The learner identifier.

#### Request Example (cURL / HTTP):
```bash
curl -X POST http://127.0.0.1:8000/api/profiles/me/resume/ \
  -F "user_id=alex_morgan_01" \
  -F "file=@sample_cv.pdf;type=application/pdf"
```

#### Response (`201 Created`)
```json
{
  "message": "Resume uploaded successfully",
  "file_name": "sample_cv.pdf",
  "resume_url": "/media/resumes/sample_cv.pdf",
  "s3": {
    "success": true,
    "bucket": "skillbridge-resumes",
    "key": "resumes/alex_morgan_01/sample_cv.pdf",
    "filename": "sample_cv.pdf",
    "s3_url": "s3://skillbridge-resumes/resumes/alex_morgan_01/sample_cv.pdf"
  },
  "sqs": {
    "success": true,
    "message_id": "550e8400-e29b-41d4-a716-446655440000",
    "payload": {
      "type": "resume.uploaded",
      "bucket": "skillbridge-resumes",
      "key": "resumes/alex_morgan_01/sample_cv.pdf",
      "user_id": "alex_morgan_01",
      "filename": "sample_cv.pdf",
      "job_id": "3b2e3f52-8d24-4f22-9f37-123456789abc"
    }
  },
  "profile": {
    "user_id": "alex_morgan_01",
    "name": "Alex Morgan",
    "target_role": "Junior Backend Developer",
    "education": "",
    "experience_level": "Entry Level",
    "skills": ["Python", "Django REST Framework", "PostgreSQL"],
    "resume_file": "/media/resumes/sample_cv.pdf",
    "resume_parsed_text": "Parsed text placeholder from sample_cv.pdf",
    "evidence": [
      {
        "evidence_id": "evi_resume_alex_morgan_01",
        "skill_name": "CV / Resume Document",
        "evidence_type": "project",
        "title": "Uploaded CV (sample_cv.pdf)",
        "reference": "s3://skillbridge-resumes/resumes/alex_morgan_01/sample_cv.pdf",
        "description": "Learner CV stored in S3 (resumes/alex_morgan_01/sample_cv.pdf) and dispatched to SQS.",
        "review_status": "unverified",
        "created_at": "2026-10-22T17:30:00Z"
      }
    ],
    "updated_at": "2026-10-22T17:30:00Z"
  }
}
```

#### Error Response (`400 Bad Request`)
Returned if `file` is missing from the multipart request:
```json
{
  "error": "No file uploaded"
}
```

---

## 4. Job Analysis & Requirements (`/api/job-analyses/`)

Handles target job posting analysis, screenshot parsing, requirement extraction (via OpenRouter Gemma model with deterministic rule fallback), and candidate review.

---

### `GET /api/job-analyses/`
Lists all historical job analyses created for a learner.

- **Status**: **Implemented & Verified**
- **Authentication**: None (`AllowAny`)
- **Query Parameters**:
  - `user_id` (optional, string, default: `"demo_user"`)

#### Response (`200 OK`)
```json
[
  {
    "analysis_id": "job_a1b2c3d4",
    "user_id": "demo_user",
    "mode": "job_specific",
    "role_title": "Junior Backend Developer",
    "job_text": "We are seeking a Junior Backend Developer proficient in Python, Django REST Framework, and SQL...",
    "job_image": null,
    "days_remaining": 14,
    "study_hours_per_week": 14.0,
    "summary": "Extracted requirements aligned with Junior Backend Developer posting.",
    "status": "completed",
    "requirements": [
      {
        "requirement_id": "req_f1a2b3",
        "skill_name": "Django REST Framework",
        "category": "framework",
        "importance": "required",
        "source_excerpt": "Proficiency in Django REST Framework to build performant APIs",
        "user_confirmed": true
      }
    ],
    "created_at": "2026-10-22T15:00:00Z"
  }
]
```

---

### `POST /api/job-analyses/`
Creates a new job analysis record and triggers structured requirement extraction. Accepts either JSON payload or `multipart/form-data` with an image screenshot.

- **Status**: **Implemented & Verified** (Tested in `backend/apps/job_analysis/test_job_analysis.py`)
- **Authentication**: None (`AllowAny`)
- **Payload Options**:
  1. **JSON (`application/json`)**:
     ```json
     {
       "job_text": "Seeking a Junior Backend Developer proficient in Python, Django REST Framework, PostgreSQL, and unit testing.",
       "role_title": "Junior Backend Developer",
       "user_id": "demo_user",
       "days_remaining": 14,
       "study_hours_per_week": 14.0
     }
     ```
  2. **Multipart Form-Data (`multipart/form-data`)**:
     - `job_text` (text string)
     - `job_image` (file binary, e.g. screenshot `.png` / `.jpg`)
     - `role_title`, `user_id`, `days_remaining`, `study_hours_per_week`

#### Response (`201 Created`)
```json
{
  "analysis_id": "job_8f4a12bc",
  "user_id": "demo_user",
  "mode": "job_specific",
  "role_title": "Junior Backend Developer",
  "job_text": "Seeking a Junior Backend Developer proficient in Python, Django REST Framework, PostgreSQL, and unit testing.",
  "job_image": null,
  "days_remaining": 14,
  "study_hours_per_week": 14.0,
  "summary": "Extracted requirements aligned with Junior Backend Developer posting.",
  "status": "completed",
  "requirements": [
    {
      "requirement_id": "req_01a",
      "skill_name": "Python",
      "category": "language",
      "importance": "required",
      "source_excerpt": "proficient in Python",
      "user_confirmed": true
    },
    {
      "requirement_id": "req_02b",
      "skill_name": "Django REST Framework",
      "category": "framework",
      "importance": "required",
      "source_excerpt": "Django REST Framework",
      "user_confirmed": true
    },
    {
      "requirement_id": "req_03c",
      "skill_name": "PostgreSQL",
      "category": "database",
      "importance": "required",
      "source_excerpt": "PostgreSQL",
      "user_confirmed": true
    },
    {
      "requirement_id": "req_04d",
      "skill_name": "API Testing",
      "category": "testing",
      "importance": "required",
      "source_excerpt": "unit testing",
      "user_confirmed": true
    }
  ],
  "created_at": "2026-10-22T17:40:00Z"
}
```

#### Error Response (`400 Bad Request`)
Returned if neither `job_text` nor `job_image` is provided:
```json
{
  "error": "Please provide either job description text or an image/screenshot."
}
```

---

### `GET /api/job-analyses/{analysis_id}/`
Retrieves a specific job analysis by its identifier, including all extracted requirement items.

- **Status**: **Implemented & Verified**
- **Path Parameters**:
  - `analysis_id` (**required**, string): The analysis identifier (e.g. `job_8f4a12bc`).

#### Response (`200 OK`)
Returns the complete `JobAnalysis` object identical to the `POST` response structure.

#### Error Response (`404 Not Found`)
```json
{
  "error": "Not found"
}
```

---

### `PATCH /api/job-analyses/{analysis_id}/requirements/`
Allows the user to confirm, edit, or override extracted requirements after human review.

- **Status**: **Implemented** (Behavior verified against view logic)
- **Request Body (`application/json`)**:
  ```json
  {
    "requirements": [
      {
        "requirement_id": "req_01a",
        "skill_name": "Python",
        "category": "language",
        "importance": "required",
        "source_excerpt": "proficient in Python"
      },
      {
        "requirement_id": "req_05e",
        "skill_name": "Docker",
        "category": "devops",
        "importance": "preferred",
        "source_excerpt": "Familiarity with containerized workflows is a plus"
      }
    ]
  }
  ```

#### Response (`200 OK`)
```json
{
  "message": "Requirements updated",
  "analysis_id": "job_8f4a12bc"
}
```

---

## 5. Goals Mode (`/api/goals/`)

Supports Mode B: Goal-based career planning when a learner does not have a specific job description.

---

### `GET /api/goals/`
Lists career or skill goals for a learner.

- **Status**: **Implemented & Verified**
- **Query Parameters**:
  - `user_id` (optional, string, default: `"demo_user"`)

#### Response (`200 OK`)
```json
[
  {
    "goal_id": "goal_1a2b3c4d",
    "user_id": "demo_user",
    "goal_type": "career_role",
    "goal_text": "Transition to Junior Backend Developer in 30 days",
    "target_profile_id": "prof_junior_backend",
    "days_remaining": 30,
    "study_hours_per_week": 10.0,
    "created_at": "2026-10-22T15:30:00Z"
  }
]
```

---

### `POST /api/goals/`
Creates a new goal record.

- **Status**: **Implemented & Verified**
- **Request Body (`application/json`)**:
  ```json
  {
    "goal_text": "Become job-ready for Python / Django REST developer roles",
    "goal_type": "career_role",
    "user_id": "demo_user",
    "days_remaining": 30,
    "study_hours_per_week": 10.0
  }
  ```

#### Response (`201 Created`)
```json
{
  "goal_id": "goal_9z8y7x6w",
  "user_id": "demo_user",
  "goal_type": "career_role",
  "goal_text": "Become job-ready for Python / Django REST developer roles",
  "target_profile_id": "prof_junior_backend",
  "days_remaining": 30,
  "study_hours_per_week": 10.0,
  "created_at": "2026-10-22T17:45:00Z"
}
```

---

## 6. Skill Matching & Gap Analysis (`/api/job-analyses/{id}/`)

Executes deterministic matching comparing job requirements with candidate portfolio evidence, calculating deadline feasibility.

---

### `POST /api/job-analyses/{analysis_id}/match/`
Executes the deterministic matching engine against the candidate's verified evidence, self-reported skills, and completed assessments.

- **Status**: **Implemented & Verified** (Tested in `backend/apps/skill_matching/test_skill_matching.py`)
- **Path Parameters**:
  - `analysis_id` (**required**, string)

#### Response (`200 OK`)
```json
{
  "analysis_id": "job_8f4a12bc",
  "role_title": "Junior Backend Developer",
  "results": [
    {
      "report_id": "rep_req_01a",
      "skill_name": "Django REST Framework",
      "status": "Demonstrated",
      "priority": "Low",
      "reason": "Verified project evidence repository found in learner profile.",
      "recommended_action": "Ready to showcase in technical interview questions and portfolio.",
      "created_at": "2026-10-22T17:50:00Z"
    },
    {
      "report_id": "rep_req_03c",
      "skill_name": "PostgreSQL",
      "status": "Self-reported",
      "priority": "High",
      "reason": "Listed in profile skills, but no verified project repository or assessment linked.",
      "recommended_action": "Link a project repository featuring implementation code and tests.",
      "created_at": "2026-10-22T17:50:00Z"
    },
    {
      "report_id": "rep_req_04d",
      "skill_name": "API Testing",
      "status": "Unverified",
      "priority": "High",
      "reason": "Required role capability with no supporting project evidence or assessment.",
      "recommended_action": "Complete practical task and rubric assessment.",
      "created_at": "2026-10-22T17:50:00Z"
    }
  ],
  "feasibility": {
    "available_hours": 28.0,
    "estimated_plan_effort_hours": 18.0,
    "days_remaining": 14,
    "study_hours_per_day": 2.0,
    "feasibility_band": "Likely feasible",
    "interpretation": "Estimated prioritized effort (18.0 hrs) is comfortably below available study capacity (28.0 hrs).",
    "assumptions": [
      "14 days remaining before application closing date",
      "Assumes 2.0 hours/day sustained study commitment",
      "Includes 4.0 hours for application review and CV tailoring"
    ],
    "suggested_scope": "Focus on completing High-priority deliverables and maintaining steady study pace."
  }
}
```

#### Deterministic Match Statuses:
1. `Demonstrated`: Supported by verified project repository or assessment score ≥ 8/10. Effort = 0 hrs. Priority = Low.
2. `Self-reported`: Mentioned in candidate skills list, but lacking verified code. Effort = 8 hrs. Priority = High.
3. `Unverified`: Required skill with no supporting record. Effort = 6 hrs. Priority = High.
4. `Needs improvement`: Prior assessment score < 8/10. Effort = 4 hrs. Priority = High.

---

### `GET /api/job-analyses/{analysis_id}/gaps/`
Retrieves existing match reports and feasibility for an analysis.

- **Status**: **Implemented & Verified**
- **Path Parameters**:
  - `analysis_id` (**required**, string)

#### Response (`200 OK`)
Returns `{ "analysis_id": "...", "results": [...], "feasibility": {...} }`.

---

## 7. Practical Assessments (`/api/assessments/`)

Exposes controlled technical task specifications and receives candidate submission assertions.

---

### `GET /api/assessments/{task_id}/`
Retrieves assessment task prompt, rubric definitions, and constraints.

- **Status**: **Implemented & Verified** (Tested in `backend/apps/assessments/test_assessments.py`)
- **Path Parameters**:
  - `task_id` (**required**, string, e.g. `api_testing_01`)

#### Response (`200 OK`)
```json
{
  "task_id": "api_testing_01",
  "title": "REST API Testing Assessment",
  "task_type": "api_testing",
  "target_skill": "API Testing",
  "total_points": 10,
  "instructions": "Given a sample endpoint, submit test cases and assertions.",
  "rubric": []
}
```

---

### `POST /api/assessments/{task_id}/submissions/`
Receives test cases, code snippets, or API assertions for rubric review.

- **Status**: **Scaffolding Implemented** (Receives submission; automatic 10-point scoring evaluator in `backend/services/rubric_evaluator.py` is currently pending full implementation by Member 4).
- **Request Body (`application/json`)**:
  ```json
  {
    "submission": {
      "endpoint_tested": "/api/payments/",
      "test_cases": [
        {
          "name": "test_successful_creation",
          "code": "response = client.post('/api/payments/', {'amount': 100}); assert response.status_code == 201"
        }
      ]
    }
  }
  ```

#### Response (`201 Created`)
```json
{
  "task_id": "api_testing_01",
  "message": "Submission received. Pending rubric evaluation.",
  "submission": {
    "endpoint_tested": "/api/payments/",
    "test_cases": [...]
  }
}
```

---

## 8. Roadmap & Progress (`/api/roadmap/`)

Manages prioritized remediation milestones, effort estimates, and Mode A application readiness checklists.

---

### `GET /api/roadmap/`
Returns all prioritized learning tasks and checklist items for a user.

- **Status**: **Implemented & Verified** (Tested in `backend/apps/roadmap/test_roadmap.py`)
- **Query Parameters**:
  - `user_id` (optional, string, default: `"demo_user"`)

#### Response (`200 OK`)
```json
{
  "user_id": "demo_user",
  "tasks": [
    {
      "task_id": "task_01",
      "user_id": "demo_user",
      "title": "Complete REST API Testing Assessment",
      "target_skill": "API Testing",
      "status": "pending",
      "priority": "High",
      "estimated_hours": 6.0,
      "recommended_resource": "Write unit tests using pytest-django with assertions on status and JSON keys.",
      "order": 1,
      "created_at": "2026-10-22T16:00:00Z"
    }
  ],
  "checklist": [
    {
      "item_id": "chk_01",
      "user_id": "demo_user",
      "label": "Verify project repository link is public",
      "completed": true,
      "deadline_relative": "Day 12"
    }
  ]
}
```

---

### `PATCH /api/roadmap/{task_id}/`
Updates task execution status.

- **Status**: **Implemented & Verified**
- **Path Parameters**:
  - `task_id` (**required**, string)
- **Request Body (`application/json`)**:
  ```json
  {
    "status": "in_progress"
  }
  ```
  *Allowed status values*: `'pending'` | `'in_progress'` | `'completed'`

#### Response (`200 OK`)
```json
{
  "task_id": "task_01",
  "user_id": "demo_user",
  "title": "Complete REST API Testing Assessment",
  "target_skill": "API Testing",
  "status": "in_progress",
  "priority": "High",
  "estimated_hours": 6.0,
  "recommended_resource": "Write unit tests using pytest-django with assertions on status and JSON keys.",
  "order": 1,
  "created_at": "2026-10-22T16:00:00Z"
}
```
