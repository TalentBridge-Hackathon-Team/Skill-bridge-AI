# SkillBridge AI — Development Setup & Run Guide

This guide provides step-by-step instructions to configure, run, test, and troubleshoot the complete SkillBridge AI development environment on **Windows with PowerShell** (along with standard macOS / Linux alternatives).

---

## 1. Prerequisites

You only need **one** primary tool installed on your machine to run the entire stack:

| Tool | Recommended Version | Verification Command | Notes |
| :--- | :--- | :--- | :--- |
| **Docker Desktop** *(Primary)* | `24.x+` (Compose v2) | `docker compose version` | **Required**: Runs LocalStack, Django backend, and React frontend with zero local python/node installs |
| **Git** | `2.40+` | `git --version` | Required for version control |
| **Python** *(Optional)* | `3.11`–`3.14` | `python --version` | *Only needed if developing bare-metal outside Docker* |
| **Node.js & npm** *(Optional)* | `v20.x` / `npm 10.x+` | `node --version` | *Only needed if developing bare-metal outside Docker* |

> [!TIP]
> **Zero Local Dependencies:** Because the backend and frontend are fully containerized in `docker-compose.yml`, teammates do **not** need to install Python, virtual environments, pip packages, Node.js, or npm on their host workstation! Docker runs everything with live volume mounting for instant code hot-reloading.

---

## 2. Quick Start: One-Click Environment Boot

If Docker Desktop is running, bootstrap the entire environment with a single command:

```powershell
docker compose up -d
```
*(or run `.\start-dev.ps1`)*

This automated command:
1. Builds and launches the **LocalStack** container (auto-provisioning S3, SQS, Lambda, and API Gateway).
2. Builds and launches the **Django Backend** container (auto-running migrations and serving on `http://localhost:8000`).
3. Builds and launches the **React Frontend** container (serving Vite on `http://localhost:5173`).
4. Mounts host directories `./backend` and `./frontend` into the containers, so any changes made on the host immediately hot-reload in the browser and API!

---

## 3. Step-by-Step Manual Setup

### Step 1: Clone and Open Repository
```powershell
git clone <repository-url>
cd Skill-bridge-AI
```

---

### Step 2: Configure Environment Variables
Copy the template to create your local `.env`:
```powershell
Copy-Item .env.example .env
```
Open `.env` in your editor. Ensure `DATABASE_URL` contains your Neon PostgreSQL connection string and `OPENROUTER_API_KEY` contains your OpenRouter API key.

> [!IMPORTANT]
> Never commit `.env` to Git. The `.gitignore` file already excludes `.env`, `.env.local`, and `backend/.env`.

---

### Step 3: Start LocalStack Cloud Emulation
Start the LocalStack container in the background:
```powershell
docker compose up -d
```
Verify the container is healthy:
```powershell
docker ps --filter "name=skillbridge-localstack"
```
The automated script in [localstack-init/01-init-aws.sh](file:///d:/Skill%20bridge%20AI/Skill-bridge-AI/localstack-init/01-init-aws.sh) runs automatically inside the container when LocalStack is ready, creating:
- S3 bucket: `skillbridge-resumes`
- SQS queue: `skillbridge-resume-processing`
- Lambda function: `skillbridge-resume-processor` (packaged from `lambda/resume_processor/handler.py`)
- SQS-to-Lambda trigger mapping
- CloudWatch metric alarm: `skillbridge-resume-processor-errors`
- API Gateway REST API: `SkillBridge Django API` (proxying to `http://host.docker.internal:8000/`)

---

### Step 4: Configure Backend (Django + Python)
1. **Activate the Python virtual environment**:
   - **Windows (PowerShell)**:
     ```powershell
     .\backend\venv\Scripts\Activate.ps1
     ```
     *(If script execution is disabled in PowerShell, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first).*
   - **macOS / Linux**:
     ```bash
     source backend/venv/bin/activate
     ```

2. **Install dependencies**:
   ```powershell
   pip install -r backend/requirements.txt
   ```

3. **Apply database migrations**:
   Applies schema migrations, including the `pgvector` extension and `SkillEvidence` vector embedding column, to Neon PostgreSQL:
   ```powershell
   python backend/manage.py migrate
   ```

4. **Start the Django development server**:
   ```powershell
   python backend/manage.py runserver 0.0.0.0:8000
   ```
   *Expected output:*
   ```text
   Starting development server at http://0.0.0.0:8000/
   Quit the server with CTRL-BREAK.
   ```
   Open `http://127.0.0.1:8000/` in your browser. You should receive the API root JSON status.

---

### Step 5: Configure Frontend (React + Vite)
In a new terminal window:

1. **Install dependencies**:
   ```powershell
   cd frontend
   npm install
   ```

2. **Start Vite development server**:
   ```powershell
   npm run dev
   ```
   *Expected output:*
   ```text
   VITE v6.x.x  ready in 350 ms
   ➜  Local:   http://localhost:5173/
   ```
   Open `http://localhost:5173/` in your browser to interact with the SkillBridge UI.

---

## 4. Environment Variables Inventory

The following table documents all environment variables consumed across the system:

| Variable | Consumer | Required? | Purpose & Sample Value |
| :--- | :--- | :---: | :--- |
| `DEBUG` | Backend (Django) | No (default: `True`) | Enables verbose debug tracebacks. |
| `SECRET_KEY` | Backend (Django) | Yes | Django cryptographic signing key. |
| `ALLOWED_HOSTS` | Backend (Django) | No (default: `localhost,127.0.0.1`) | Comma-separated list of permitted host headers. |
| `CORS_ALLOWED_ORIGINS` | Backend (Django) | No (default: `*`) | Permitted origins for frontend cross-origin requests. |
| `DATABASE_URL` | Backend (Django) | Yes | Connection string for Neon PostgreSQL database (`postgresql://user:pass@host/db?sslmode=require`). |
| `Realtime_SQL_API_endpoint_URL`| Backend (Django) | No | Optional Neon HTTP SQL endpoint URL. |
| `AWS_REGION` | Backend (Django) | No (default: `us-east-1`) | AWS region for S3, SQS, and CloudWatch. |
| `AWS_ACCESS_KEY_ID` | Backend (Django) | No (default: `test`) | Access key for LocalStack emulation. |
| `AWS_SECRET_ACCESS_KEY`| Backend (Django) | No (default: `test`) | Secret key for LocalStack emulation. |
| `AWS_ENDPOINT_URL` | Backend (Django) | No (default: `http://localhost:4566`) | Points boto3 to LocalStack emulator. Set to empty string in real AWS. |
| `AWS_S3_BUCKET_NAME` | Backend (Django) | No (default: `skillbridge-resumes`) | Target S3 bucket for learner resumes. |
| `AWS_SQS_RESUME_QUEUE_URL`| Backend (Django) | No | Queue URL for dispatching resume processing jobs. |
| `LOCALSTACK_AUTH_TOKEN`| Docker Compose | No | LocalStack Pro token (optional; placeholder used in community mode). |
| `OPENROUTER_API_KEY` | Backend (Services)| Yes | API key for OpenRouter LLM and embedding calls. |
| `OPENROUTER_TEXT_MODEL`| Backend (Services)| No (default: `google/gemma-4-26b-a4b-it:free`) | LLM model identifier for job requirement extraction. |
| `OPENROUTER_EMBED_MODEL`| Backend (Services)| No (default: `nvidia/nemotron-3-embed-1b:free`)| Model identifier for 2048-dim vector embeddings. |
| `OPENROUTER_BASE_URL` | Backend (Services)| No (default: `https://openrouter.ai/api/v1`) | Base endpoint for OpenRouter completions and embeddings. |
| `VITE_API_BASE_URL` | Frontend (Vite) | No (default: `http://127.0.0.1:8000/api`) | Endpoint URL used by the React API client (`api.ts`). |

---

## 5. Automated Testing & Quality Checks

Run the automated test suites to ensure your changes have not broken existing integrations:

### 1. Backend Tests (`pytest` + `pytest-django`)
Executes all 14 unit and API endpoint tests (uses an isolated in-memory SQLite database):
```powershell
npm run backend:test
# Or from backend directory:
cd backend
python -m pytest
```
*Expected result:* **`14 passed in ~13s`**.

### 2. Frontend Unit Tests (`Vitest`)
Runs all React component and navigation unit tests:
```powershell
npm run frontend:test
# Or from frontend directory:
cd frontend
npm test
```
*Expected result:* **`6 passed in ~4s`**.

### 3. End-to-End Browser Tests (`Playwright` in Microsoft Edge)
Executes real browser interaction across all navigation views and input forms:
```powershell
npm run test:e2e
```
Or run with visible browser window:
```powershell
cd frontend
npm run test:e2e:headed
```

---

## 6. Inspecting LocalStack Resources & Logs

When running LocalStack via Docker, you can verify cloud resources directly:

### Check S3 Bucket Contents
```powershell
docker exec skillbridge-localstack awslocal s3 ls s3://skillbridge-resumes/resumes/ --recursive
```

### Inspect SQS Queue Status
```powershell
docker exec skillbridge-localstack awslocal sqs get-queue-attributes `
  --queue-url http://localhost:4566/000000000000/skillbridge-resume-processing `
  --attribute-names All
```

### View Lambda Execution Logs (CloudWatch)
```powershell
docker exec skillbridge-localstack awslocal logs tail /aws/lambda/skillbridge-resume-processor
```

### Check CloudWatch Metric Alarm Status
```powershell
docker exec skillbridge-localstack awslocal cloudwatch describe-alarms `
  --alarm-names skillbridge-resume-processor-errors
```

---

## 7. Troubleshooting Common Issues

### Issue 1: `ModuleNotFoundError: No module named 'psycopg2'` or `'pgvector'`
- **Cause**: Packages were installed into the global Python environment instead of `backend/venv`.
- **Solution**: Activate `backend\venv\Scripts\Activate.ps1` before running `pip install -r backend/requirements.txt`.

### Issue 2: `docker compose up -d` fails or Docker daemon not running
- **Cause**: Docker Desktop is not started or Docker daemon is stopped.
- **Solution**: Open Docker Desktop from the Windows Start menu and wait until the status shows "Engine running". Then re-run `docker compose up -d`.

### Issue 3: Django returns `DisallowedHost at /`
- **Cause**: The incoming `Host` header is not present in `ALLOWED_HOSTS`.
- **Solution**: In `.env`, ensure `ALLOWED_HOSTS=localhost,127.0.0.1,host.docker.internal`.

### Issue 4: LocalStack S3 or SQS raises `NoSuchBucket` or `QueueDoesNotExist`
- **Cause**: LocalStack was started clean without running the init script.
- **Solution**: The backend `services/aws_service.py` has built-in self-healing that automatically provisions the missing bucket or queue upon the next upload request. You can also re-trigger the init script:
  ```powershell
  docker exec skillbridge-localstack bash /etc/localstack/init/ready.d/01-init-aws.sh
  ```

### Issue 5: OpenRouter API returns 401 or Rate Limits
- **Cause**: Missing or exhausted free tier OpenRouter API key.
- **Solution**: Check `OPENROUTER_API_KEY` in `.env`. Note that [backend/services/openrouter_service.py](file:///d:/Skill%20bridge%20AI/Skill-bridge-AI/backend/services/openrouter_service.py) includes a deterministic fallback rule engine that automatically parses key skills even if the external LLM is offline.
