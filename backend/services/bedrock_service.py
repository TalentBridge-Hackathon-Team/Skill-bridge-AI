"""
SkillBridge AI — Amazon Bedrock Extraction Service
Uses Amazon Bedrock (Claude via boto3) to extract structured job requirements.

Fallback chain:
  1. Amazon Bedrock (boto3) — if AWS credentials and region are configured
  2. OpenRouter (requests) — if OPENROUTER_API_KEY is set
  3. Deterministic rule engine — always available, no external calls

Never raises an unhandled exception. The caller always receives a valid
extraction dict with 'role_title', 'summary', and 'requirements'.

Design notes:
  - Never hardcode AWS credentials; read from environment only.
  - Model ID defaults to Claude 3 Haiku (cheapest/fastest Bedrock option).
    Override with BEDROCK_MODEL_ID env var.
  - All boto3 import and client creation happens inside methods so that missing
    boto3 or missing credentials never crash the module at import time.
"""

import json
import logging
import os
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Bedrock model configuration
# ---------------------------------------------------------------------------
# Default: Claude 3 Haiku — fast, cheap, supports JSON instruction following.
# Supported alternatives (set BEDROCK_MODEL_ID in .env):
#   anthropic.claude-3-sonnet-20240229-v1:0   (higher quality)
#   amazon.titan-text-express-v1               (Amazon native)
DEFAULT_BEDROCK_MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0"

EXTRACTION_SYSTEM_PROMPT = (
    "You are a technical recruiter assistant. "
    "Extract required and preferred technical skills from the job description. "
    "Return ONLY a JSON object (no markdown, no code fences) with these exact keys: "
    "'role_title' (string), 'summary' (string, 1-2 sentences), and "
    "'requirements' (array of objects each with: "
    "'skill_name' (string), "
    "'category' (one of: language, framework, database, testing, devops, tools, concepts), "
    "'importance' (either 'required' or 'preferred'), "
    "'source_excerpt' (short direct quote from the job text)). "
    "Do not invent requirements that are not mentioned in the job text."
)


# ---------------------------------------------------------------------------
# Deterministic rule engine (always available, no external calls)
# ---------------------------------------------------------------------------
_RULES: List[tuple] = [
    # (keyword_in_jd, skill_name, category, importance)
    ("python", "Python", "language", "required"),
    ("django", "Django REST Framework", "framework", "required"),
    ("flask", "Flask", "framework", "required"),
    ("fastapi", "FastAPI", "framework", "required"),
    ("postgresql", "PostgreSQL", "database", "required"),
    ("postgres", "PostgreSQL", "database", "required"),
    ("mysql", "MySQL", "database", "required"),
    ("sqlite", "SQLite", "database", "preferred"),
    ("sql", "SQL", "database", "required"),
    ("rest api", "RESTful API Design", "concepts", "required"),
    ("restful", "RESTful API Design", "concepts", "required"),
    ("api testing", "API Testing", "testing", "required"),
    ("pytest", "API Testing", "testing", "required"),
    ("unit test", "API Testing", "testing", "required"),
    ("docker", "Docker", "devops", "preferred"),
    ("kubernetes", "Kubernetes", "devops", "preferred"),
    ("git", "Git", "tools", "required"),
    ("github", "Git", "tools", "required"),
    ("gitlab", "Git", "tools", "required"),
    ("redis", "Redis", "database", "preferred"),
    ("celery", "Celery", "tools", "preferred"),
    ("aws", "AWS", "devops", "preferred"),
    ("linux", "Linux", "tools", "preferred"),
    ("bash", "Linux", "tools", "preferred"),
]

_DEFAULT_REQUIREMENTS: List[Dict[str, Any]] = [
    {"skill_name": "Python", "category": "language", "importance": "required",
     "source_excerpt": "Core language for backend development (default profile)"},
    {"skill_name": "Django REST Framework", "category": "framework", "importance": "required",
     "source_excerpt": "Standard backend API framework (default profile)"},
    {"skill_name": "PostgreSQL", "category": "database", "importance": "required",
     "source_excerpt": "Relational database (default profile)"},
    {"skill_name": "API Testing", "category": "testing", "importance": "required",
     "source_excerpt": "Quality assurance requirement (default profile)"},
]


def _rule_engine_extract(job_text: str) -> Dict[str, Any]:
    """
    Keyword-based requirement extraction. Deduplicates by skill_name.
    Returns results in the standard extraction dict format.
    """
    lower_text = job_text.lower()
    seen: set = set()
    requirements: List[Dict[str, Any]] = []

    for keyword, skill_name, category, importance in _RULES:
        if keyword in lower_text and skill_name not in seen:
            seen.add(skill_name)
            # Find the first short snippet from the text containing the keyword
            idx = lower_text.find(keyword)
            start = max(0, idx - 30)
            end = min(len(job_text), idx + len(keyword) + 60)
            excerpt = job_text[start:end].strip().replace("\n", " ")
            requirements.append({
                "skill_name": skill_name,
                "category": category,
                "importance": importance,
                "source_excerpt": excerpt or f"Keyword '{keyword}' found in job description",
            })

    if not requirements:
        requirements = _DEFAULT_REQUIREMENTS[:]

    return {
        "role_title": "Junior Backend Developer",
        "summary": "Requirements extracted via deterministic rule engine (fallback mode).",
        "requirements": requirements,
        "extraction_source": "rule_engine",
    }


# ---------------------------------------------------------------------------
# JSON parse helper (shared by both Bedrock and OpenRouter paths)
# ---------------------------------------------------------------------------
def _parse_llm_json(raw_text: str) -> Dict[str, Any]:
    """
    Strips markdown code fences and parses JSON from LLM output.
    Raises ValueError if parsing fails or required keys are missing.
    """
    text = raw_text.strip()
    # Strip ```json ... ``` or ``` ... ```
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json or ```) and last line (```)
        inner_lines = lines[1:] if lines[0].startswith("```") else lines
        if inner_lines and inner_lines[-1].strip() == "```":
            inner_lines = inner_lines[:-1]
        text = "\n".join(inner_lines).strip()

    parsed = json.loads(text)

    if not isinstance(parsed, dict):
        raise ValueError("LLM output is not a JSON object")
    if "requirements" not in parsed or not isinstance(parsed["requirements"], list):
        raise ValueError("Missing or invalid 'requirements' key in LLM output")
    if len(parsed["requirements"]) == 0:
        raise ValueError("LLM returned an empty requirements list")

    return parsed


# ---------------------------------------------------------------------------
# Bedrock extraction
# ---------------------------------------------------------------------------
def _extract_via_bedrock(job_text: str) -> Dict[str, Any]:
    """
    Calls Amazon Bedrock (Claude) to extract requirements.
    Raises any exception on failure — callers must handle it.
    """
    try:
        import boto3  # noqa: PLC0415
        from botocore.exceptions import BotoCoreError, ClientError  # noqa: PLC0415
    except ImportError as exc:
        raise RuntimeError("boto3 is not installed") from exc

    aws_region = os.getenv("AWS_REGION", "us-east-1")
    model_id = os.getenv("BEDROCK_MODEL_ID", DEFAULT_BEDROCK_MODEL_ID)

    # boto3 will pick up credentials from the environment automatically:
    # AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN, or
    # an IAM role if running on EC2/Lambda/ECS.
    client = boto3.client("bedrock-runtime", region_name=aws_region)

    # Claude Messages API payload (works for Claude 3 family on Bedrock)
    payload = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 2000,
        "temperature": 0.1,
        "system": EXTRACTION_SYSTEM_PROMPT,
        "messages": [
            {
                "role": "user",
                "content": f"Job Description:\n{job_text}",
            }
        ],
    }

    response = client.invoke_model(
        modelId=model_id,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(payload),
    )

    response_body = json.loads(response["body"].read())
    raw_text = response_body["content"][0]["text"]
    parsed = _parse_llm_json(raw_text)
    parsed["extraction_source"] = "bedrock"
    return parsed


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------
class BedrockExtractionService:
    """
    Extracts structured job requirements using the fallback chain:
      Bedrock → OpenRouter → Rule engine

    Usage:
        from services.bedrock_service import bedrock_extractor
        result = bedrock_extractor.extract_job_requirements(job_text)
    """

    def extract_job_requirements(self, job_text: str) -> Dict[str, Any]:
        """
        Extracts requirements from a job description string.
        Never raises. Returns a dict with keys:
          - role_title: str
          - summary: str
          - requirements: list of {skill_name, category, importance, source_excerpt}
          - extraction_source: 'bedrock' | 'openrouter' | 'rule_engine'
        """
        # ── Try 1: Amazon Bedrock ────────────────────────────────────────────
        aws_key = os.getenv("AWS_ACCESS_KEY_ID", "")
        aws_secret = os.getenv("AWS_SECRET_ACCESS_KEY", "")

        # Only attempt Bedrock if real credentials look present.
        # The project defaults these to the literal string "test" for LocalStack,
        # which is not valid for real Bedrock calls.
        bedrock_available = (
            aws_key
            and aws_key not in ("test", "")
            and aws_secret
            and aws_secret not in ("test", "")
        )

        if bedrock_available:
            try:
                logger.info("Attempting requirement extraction via Amazon Bedrock.")
                result = _extract_via_bedrock(job_text)
                logger.info("Bedrock extraction succeeded.")
                return result
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Bedrock extraction failed (%s). Falling back to OpenRouter.", exc
                )

        # ── Try 2: OpenRouter ────────────────────────────────────────────────
        try:
            # Import lazily so the module loads even without Django configured
            from services.openrouter_service import openrouter_service  # noqa: PLC0415

            result = openrouter_service.extract_job_requirements(job_text)
            # OpenRouter service returns extraction_source only if it used the
            # rule engine internally; otherwise mark it.
            if "extraction_source" not in result:
                openrouter_key = os.getenv("OPENROUTER_API_KEY", "")
                result["extraction_source"] = (
                    "openrouter" if openrouter_key else "rule_engine"
                )
            logger.info(
                "Extraction via %s succeeded.", result.get("extraction_source")
            )
            return result
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "OpenRouter extraction also failed (%s). Using rule engine.", exc
            )

        # ── Try 3: Deterministic rule engine (always works) ──────────────────
        logger.info("Using deterministic rule engine for extraction.")
        return _rule_engine_extract(job_text)

    def health_check(self) -> Dict[str, Any]:
        """
        Returns the availability status of each extraction method.
        Useful for a /api/health/ endpoint or debugging.
        """
        aws_key = os.getenv("AWS_ACCESS_KEY_ID", "")
        aws_secret = os.getenv("AWS_SECRET_ACCESS_KEY", "")
        openrouter_key = os.getenv("OPENROUTER_API_KEY", "")

        bedrock_configured = bool(
            aws_key
            and aws_key not in ("test", "")
            and aws_secret
            and aws_secret not in ("test", "")
        )

        try:
            import boto3  # noqa: F401, PLC0415
            boto3_installed = True
        except ImportError:
            boto3_installed = False

        return {
            "bedrock": {
                "available": bedrock_configured and boto3_installed,
                "boto3_installed": boto3_installed,
                "credentials_configured": bedrock_configured,
                "model_id": os.getenv("BEDROCK_MODEL_ID", DEFAULT_BEDROCK_MODEL_ID),
            },
            "openrouter": {
                "available": bool(openrouter_key),
                "api_key_set": bool(openrouter_key),
            },
            "rule_engine": {
                "available": True,
                "note": "Always available; no external dependencies.",
            },
        }


# Module-level singleton — import this in views
bedrock_extractor = BedrockExtractionService()
