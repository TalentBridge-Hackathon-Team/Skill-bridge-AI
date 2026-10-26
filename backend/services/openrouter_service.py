"""
SkillBridge AI — OpenRouter AI Service
Primary AI layer for SkillBridge. Handles:
  - Text generation / job requirement extraction  → google/gemma-4-26b-a4b-it:free
  - RAG vector embeddings                         → nvidia/nemotron-3-embed-1b:free

Fallback chain for extraction (no external dependency required):
  1. OpenRouter LLM  — if OPENROUTER_API_KEY is configured
  2. Deterministic rule engine — always available, no network calls

The rule engine covers a wide range of roles, not just Junior Backend Developer.
"""

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Deterministic multi-role rule engine
# ---------------------------------------------------------------------------
# Each tuple: (keyword_to_detect, skill_name, category, importance)
# Rules are checked via case-insensitive substring match against the JD text.
# They are intentionally broad so they cover many role variants.

_RULES: List[tuple] = [
    # ── Languages ──────────────────────────────────────────────────────────
    ("python",          "Python",           "language",  "required"),
    ("javascript",      "JavaScript",        "language",  "required"),
    ("typescript",      "TypeScript",        "language",  "required"),
    ("java",            "Java",              "language",  "required"),
    ("kotlin",          "Kotlin",            "language",  "required"),
    ("swift",           "Swift",             "language",  "required"),
    ("c#",              "C#",                "language",  "required"),
    ("golang",          "Go",                "language",  "required"),
    (" go ",            "Go",                "language",  "required"),
    ("rust",            "Rust",              "language",  "required"),
    ("ruby",            "Ruby",              "language",  "required"),
    ("php",             "PHP",               "language",  "required"),
    ("scala",           "Scala",             "language",  "required"),
    ("r programming",   "R",                 "language",  "required"),
    ("c++",             "C++",               "language",  "required"),
    ("bash",            "Bash/Shell",        "tools",     "preferred"),
    ("shell scripting", "Bash/Shell",        "tools",     "preferred"),

    # ── Backend Frameworks ─────────────────────────────────────────────────
    ("django",          "Django REST Framework", "framework", "required"),
    ("flask",           "Flask",             "framework", "required"),
    ("fastapi",         "FastAPI",           "framework", "required"),
    ("express",         "Express.js",        "framework", "required"),
    ("node.js",         "Node.js",           "framework", "required"),
    ("nodejs",          "Node.js",           "framework", "required"),
    ("spring boot",     "Spring Boot",       "framework", "required"),
    ("spring",          "Spring",            "framework", "required"),
    ("rails",           "Ruby on Rails",     "framework", "required"),
    ("laravel",         "Laravel",           "framework", "required"),
    ("nest",            "NestJS",            "framework", "required"),
    ("gin",             "Gin",               "framework", "required"),
    ("fiber",           "Fiber",             "framework", "required"),
    ("asp.net",         "ASP.NET",           "framework", "required"),
    (".net",            ".NET",              "framework", "required"),

    # ── Frontend Frameworks ────────────────────────────────────────────────
    ("react",           "React",             "framework", "required"),
    ("vue",             "Vue.js",            "framework", "required"),
    ("angular",         "Angular",           "framework", "required"),
    ("svelte",          "Svelte",            "framework", "required"),
    ("next.js",         "Next.js",           "framework", "required"),
    ("nextjs",          "Next.js",           "framework", "required"),
    ("tailwind",        "Tailwind CSS",      "framework", "preferred"),
    ("html",            "HTML/CSS",          "language",  "required"),
    ("css",             "HTML/CSS",          "language",  "required"),

    # ── Mobile ─────────────────────────────────────────────────────────────
    ("react native",    "React Native",      "framework", "required"),
    ("flutter",         "Flutter",           "framework", "required"),
    ("android",         "Android SDK",       "framework", "required"),
    ("ios",             "iOS / Xcode",       "tools",     "required"),
    ("xcode",           "iOS / Xcode",       "tools",     "required"),
    ("jetpack compose", "Jetpack Compose",   "framework", "required"),
    ("swiftui",         "SwiftUI",           "framework", "required"),

    # ── Databases ──────────────────────────────────────────────────────────
    ("postgresql",      "PostgreSQL",        "database",  "required"),
    ("postgres",        "PostgreSQL",        "database",  "required"),
    ("mysql",           "MySQL",             "database",  "required"),
    ("sqlite",          "SQLite",            "database",  "preferred"),
    ("mongodb",         "MongoDB",           "database",  "required"),
    ("redis",           "Redis",             "database",  "preferred"),
    ("elasticsearch",   "Elasticsearch",     "database",  "preferred"),
    ("cassandra",       "Cassandra",         "database",  "preferred"),
    ("dynamodb",        "DynamoDB",          "database",  "preferred"),
    ("firebase",        "Firebase",          "database",  "preferred"),
    ("supabase",        "Supabase",          "database",  "preferred"),
    ("sql server",      "SQL Server",        "database",  "required"),
    ("oracle",          "Oracle DB",         "database",  "preferred"),
    (" sql ",           "SQL",               "database",  "required"),

    # ── DevOps / Cloud ─────────────────────────────────────────────────────
    ("docker",          "Docker",            "devops",    "preferred"),
    ("kubernetes",      "Kubernetes",        "devops",    "preferred"),
    ("k8s",             "Kubernetes",        "devops",    "preferred"),
    ("aws",             "AWS",               "devops",    "preferred"),
    ("azure",           "Azure",             "devops",    "preferred"),
    ("gcp",             "GCP",               "devops",    "preferred"),
    ("google cloud",    "GCP",               "devops",    "preferred"),
    ("terraform",       "Terraform",         "devops",    "preferred"),
    ("ansible",         "Ansible",           "devops",    "preferred"),
    ("ci/cd",           "CI/CD",             "devops",    "preferred"),
    ("jenkins",         "Jenkins",           "devops",    "preferred"),
    ("github actions",  "GitHub Actions",    "devops",    "preferred"),
    ("linux",           "Linux",             "tools",     "preferred"),
    ("nginx",           "Nginx",             "devops",    "preferred"),

    # ── Testing ────────────────────────────────────────────────────────────
    ("pytest",          "API Testing",       "testing",   "required"),
    ("unit test",       "Unit Testing",      "testing",   "required"),
    ("jest",            "Jest",              "testing",   "required"),
    ("cypress",         "Cypress",           "testing",   "preferred"),
    ("selenium",        "Selenium",          "testing",   "preferred"),
    ("api testing",     "API Testing",       "testing",   "required"),
    ("test driven",     "TDD",               "testing",   "preferred"),
    ("tdd",             "TDD",               "testing",   "preferred"),

    # ── Data / ML / AI ─────────────────────────────────────────────────────
    ("machine learning", "Machine Learning", "concepts",  "required"),
    ("deep learning",   "Deep Learning",     "concepts",  "required"),
    ("tensorflow",      "TensorFlow",        "framework", "required"),
    ("pytorch",         "PyTorch",           "framework", "required"),
    ("scikit",          "Scikit-learn",      "framework", "required"),
    ("pandas",          "Pandas",            "framework", "required"),
    ("numpy",           "NumPy",             "framework", "required"),
    ("data analysis",   "Data Analysis",     "concepts",  "required"),
    ("data visualization", "Data Visualization", "concepts", "required"),
    ("power bi",        "Power BI",          "tools",     "required"),
    ("tableau",         "Tableau",           "tools",     "required"),
    ("spark",           "Apache Spark",      "framework", "preferred"),
    ("hadoop",          "Hadoop",            "framework", "preferred"),
    ("airflow",         "Apache Airflow",    "tools",     "preferred"),
    ("dbt",             "dbt",               "tools",     "preferred"),
    ("llm",             "LLM / GenAI",       "concepts",  "required"),
    ("langchain",       "LangChain",         "framework", "preferred"),
    ("openai",          "OpenAI API",        "tools",     "preferred"),
    ("nlp",             "NLP",               "concepts",  "required"),
    ("computer vision", "Computer Vision",   "concepts",  "required"),

    # ── Security ───────────────────────────────────────────────────────────
    ("oauth",           "OAuth / JWT",       "concepts",  "required"),
    ("jwt",             "OAuth / JWT",       "concepts",  "required"),
    ("penetration",     "Penetration Testing","testing",  "required"),
    ("vulnerability",   "Security Auditing", "concepts",  "required"),
    ("siem",            "SIEM",              "tools",     "required"),
    ("soc",             "SOC Operations",    "concepts",  "required"),
    ("firewall",        "Firewall / Network Security", "concepts", "required"),
    ("encryption",      "Cryptography",      "concepts",  "required"),

    # ── General Tools ──────────────────────────────────────────────────────
    ("git",             "Git",               "tools",     "required"),
    ("github",          "Git",               "tools",     "required"),
    ("gitlab",          "Git",               "tools",     "required"),
    ("rest api",        "RESTful API Design", "concepts", "required"),
    ("restful",         "RESTful API Design", "concepts", "required"),
    ("graphql",         "GraphQL",           "concepts",  "preferred"),
    ("microservices",   "Microservices",     "concepts",  "preferred"),
    ("agile",           "Agile / Scrum",     "concepts",  "preferred"),
    ("scrum",           "Agile / Scrum",     "concepts",  "preferred"),
    ("jira",            "Jira",              "tools",     "preferred"),
    ("figma",           "Figma",             "tools",     "preferred"),
    ("celery",          "Celery",            "tools",     "preferred"),
    ("rabbitmq",        "RabbitMQ",          "tools",     "preferred"),
    ("kafka",           "Kafka",             "tools",     "preferred"),
    ("grpc",            "gRPC",              "concepts",  "preferred"),
    ("websocket",       "WebSockets",        "concepts",  "preferred"),
    ("oauth2",          "OAuth2",            "concepts",  "required"),
]

# Default fallback requirements — shown when nothing matches AND LLM fails.
# Deliberately generic so they apply to almost any software role.
_GENERIC_DEFAULTS: List[Dict[str, Any]] = [
    {"skill_name": "Git", "category": "tools", "importance": "required",
     "source_excerpt": "Version control is expected for all software roles."},
    {"skill_name": "Problem Solving", "category": "concepts", "importance": "required",
     "source_excerpt": "Analytical and problem-solving skills required."},
    {"skill_name": "Agile / Scrum", "category": "concepts", "importance": "preferred",
     "source_excerpt": "Familiarity with agile development workflows."},
    {"skill_name": "Communication", "category": "concepts", "importance": "required",
     "source_excerpt": "Strong written and verbal communication skills."},
]


def _extract_role_title(job_text: str) -> str:
    """
    Attempts to heuristically extract a role title from the first 3 lines of
    the JD. Falls back to 'Software Role' if nothing identifiable is found.
    """
    title_patterns = [
        r"(?:job title|role|position|we are (?:hiring|looking for)|seeking a?)\s*[:\-]?\s*(.+)",
        r"^(.{5,60}(?:developer|engineer|analyst|designer|scientist|manager|lead|intern|specialist|architect))",
    ]
    first_lines = "\n".join(job_text.strip().split("\n")[:5])
    for pattern in title_patterns:
        match = re.search(pattern, first_lines, re.IGNORECASE | re.MULTILINE)
        if match:
            candidate = match.group(1).strip().rstrip(".,;:")
            # Sanity check: not too long, not empty
            if 3 < len(candidate) < 80:
                return candidate
    return "Software Role"


def _rule_engine_extract(job_text: str) -> Dict[str, Any]:
    """
    Pure keyword-based requirement extraction. Works for any role.
    Deduplicates by skill_name (first match wins).
    Returns a standard extraction dict.
    """
    lower_text = job_text.lower()
    seen: set = set()
    requirements: List[Dict[str, Any]] = []

    for keyword, skill_name, category, importance in _RULES:
        if skill_name in seen:
            continue
        if keyword in lower_text:
            # Find actual excerpt from the source text
            idx = lower_text.find(keyword)
            start = max(0, idx - 40)
            end = min(len(job_text), idx + len(keyword) + 80)
            excerpt = job_text[start:end].strip().replace("\n", " ")
            seen.add(skill_name)
            requirements.append({
                "skill_name": skill_name,
                "category": category,
                "importance": importance,
                "source_excerpt": excerpt or f"'{keyword}' found in job description",
            })

    if not requirements:
        requirements = _GENERIC_DEFAULTS[:]

    role_title = _extract_role_title(job_text)

    return {
        "role_title": role_title,
        "summary": f"Requirements extracted via rule engine for '{role_title}'.",
        "requirements": requirements,
        "extraction_source": "rule_engine",
    }


def _clean_llm_json(raw_text: str) -> Dict[str, Any]:
    """
    Strips markdown code fences and parses JSON from LLM output.
    Raises ValueError if the result is missing required keys or is malformed.
    """
    text = raw_text.strip()

    # Strip ```json ... ``` or ``` ... ```
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text.strip()).strip()

    parsed = json.loads(text)

    if not isinstance(parsed, dict):
        raise ValueError("LLM response is not a JSON object")
    if "requirements" not in parsed:
        raise ValueError("Missing 'requirements' key")
    if not isinstance(parsed["requirements"], list) or len(parsed["requirements"]) == 0:
        raise ValueError("'requirements' is empty or not a list")

    # Validate and coerce each item
    valid_reqs = []
    for item in parsed["requirements"]:
        if not isinstance(item, dict):
            continue
        skill = item.get("skill_name", "").strip()
        if not skill:
            continue
        valid_reqs.append({
            "skill_name": skill,
            "category": item.get("category", "concepts"),
            "importance": item.get("importance", "required")
                          if item.get("importance") in ("required", "preferred")
                          else "required",
            "source_excerpt": item.get("source_excerpt", f"Mentioned in job description: {skill}"),
        })

    if not valid_reqs:
        raise ValueError("No valid requirements after parsing")

    parsed["requirements"] = valid_reqs
    return parsed


# ---------------------------------------------------------------------------
# OpenRouter Service
# ---------------------------------------------------------------------------

class OpenRouterService:
    """
    Unified service for OpenRouter LLM text generation and RAG embeddings.
    This is the single AI integration point for SkillBridge.
    """

    def __init__(self):
        self.api_key = getattr(settings, "OPENROUTER_API_KEY",
                               os.getenv("OPENROUTER_API_KEY", ""))
        self.base_url = getattr(settings, "OPENROUTER_BASE_URL",
                                os.getenv("OPENROUTER_BASE_URL",
                                          "https://openrouter.ai/api/v1")).rstrip("/")
        self.text_model = getattr(settings, "OPENROUTER_TEXT_MODEL",
                                  os.getenv("OPENROUTER_TEXT_MODEL",
                                            "google/gemma-4-26b-a4b-it:free"))
        self.embed_model = getattr(settings, "OPENROUTER_EMBED_MODEL",
                                   os.getenv("OPENROUTER_EMBED_MODEL",
                                             "nvidia/nemotron-3-embed-1b:free"))
        self.site_url = getattr(settings, "OPENROUTER_SITE_URL",
                                os.getenv("OPENROUTER_SITE_URL", "http://localhost:4000"))
        self.site_name = getattr(settings, "OPENROUTER_SITE_NAME",
                                 os.getenv("OPENROUTER_SITE_NAME", "skillbridge"))

    def _headers(self) -> Dict[str, str]:
        h = {
            "Content-Type": "application/json",
            "HTTP-Referer": self.site_url,
            "X-Title": self.site_name,
        }
        if self.api_key:
            h["Authorization"] = f"Bearer {self.api_key}"
        return h

    # ── Text generation ───────────────────────────────────────────────────────

    def generate_text(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 1500,
    ) -> Dict[str, Any]:
        """
        Calls the OpenRouter chat completions endpoint.
        Always returns a dict with 'success', 'text', and 'model' keys.
        Never raises.
        """
        if not self.api_key:
            logger.warning("OPENROUTER_API_KEY not configured — using rule engine only.")
            return {"success": False, "error": "no_api_key",
                    "text": "", "model": self.text_model}

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            resp = requests.post(
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json={"model": self.text_model, "messages": messages,
                      "temperature": temperature, "max_tokens": max_tokens},
                timeout=30,
            )
            if resp.status_code == 200:
                data = resp.json()
                content = (data.get("choices", [{}])[0]
                               .get("message", {}).get("content", ""))
                return {"success": True, "text": content,
                        "model": data.get("model", self.text_model),
                        "usage": data.get("usage", {})}

            logger.warning("OpenRouter %s: %s", resp.status_code, resp.text[:200])
            return {"success": False,
                    "error": f"HTTP {resp.status_code}",
                    "text": "", "model": self.text_model}

        except Exception as exc:
            logger.error("OpenRouter request failed: %s", exc)
            return {"success": False, "error": str(exc),
                    "text": "", "model": self.text_model}

    # ── Job requirement extraction ────────────────────────────────────────────

    def extract_job_requirements(self, job_text: str) -> Dict[str, Any]:
        """
        Extracts structured skill requirements from a job description.

        Fallback chain:
          1. OpenRouter LLM (google/gemma-4-26b-a4b-it:free)
          2. Deterministic rule engine

        Always returns:
          {role_title, summary, requirements[{skill_name, category,
           importance, source_excerpt}], extraction_source}
        """
        system_prompt = (
            "You are a technical recruiter assistant. Analyze the job description carefully. "
            "Extract ALL required and preferred technical skills, tools, and technologies. "
            "Return ONLY valid JSON with exactly these keys: "
            "'role_title' (string — the job title), "
            "'summary' (string — 1-2 sentences describing the role), "
            "'requirements' (array of objects, each with: "
            "  'skill_name' (string), "
            "  'category' (one of: language, framework, database, testing, devops, tools, concepts), "
            "  'importance' ('required' or 'preferred'), "
            "  'source_excerpt' (short direct quote from the job text)). "
            "Do NOT wrap output in markdown code fences. "
            "Do NOT invent skills not mentioned in the job text. "
            "Extract skills for ANY role type — backend, frontend, mobile, data, ML, security, etc."
        )

        llm_result = self.generate_text(
            prompt=f"Job Description:\n\n{job_text}",
            system_prompt=system_prompt,
            temperature=0.1,
            max_tokens=2000,
        )

        if llm_result.get("success") and llm_result.get("text"):
            try:
                parsed = _clean_llm_json(llm_result["text"])
                parsed["extraction_source"] = "openrouter"
                logger.info("OpenRouter extraction succeeded: %d requirements",
                            len(parsed["requirements"]))
                return parsed
            except Exception as exc:
                logger.info("LLM output parse failed (%s) — falling back to rule engine.", exc)

        # Rule engine fallback
        logger.info("Using rule engine for extraction.")
        return _rule_engine_extract(job_text)

    # ── Embeddings ────────────────────────────────────────────────────────────

    def generate_embeddings(self, text: str) -> List[float]:
        """
        Generates 2048-dim vector embeddings via nvidia/nemotron-3-embed-1b:free.
        Returns a zero vector on any failure so callers are never blocked.
        """
        if not self.api_key:
            logger.warning("OPENROUTER_API_KEY not set — returning zero embedding vector.")
            return [0.0] * 2048

        try:
            resp = requests.post(
                f"{self.base_url}/embeddings",
                headers=self._headers(),
                json={"model": self.embed_model,
                      "input": text[:2000] if text else "empty"},
                timeout=30,
            )
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("data", [])
                if items and "embedding" in items[0]:
                    return items[0]["embedding"]
            logger.warning("Embedding endpoint returned %s: %s",
                           resp.status_code, resp.text[:200])
        except Exception as exc:
            logger.error("Embedding request failed: %s", exc)

        return [0.0] * 2048

    # ── Health check ──────────────────────────────────────────────────────────

    def health_check(self) -> Dict[str, Any]:
        """Returns the current configuration status for debugging."""
        return {
            "openrouter": {
                "available": bool(self.api_key),
                "api_key_configured": bool(self.api_key),
                "text_model": self.text_model,
                "embed_model": self.embed_model,
            },
            "rule_engine": {
                "available": True,
                "rules_count": len(_RULES),
                "note": "Always available — no external dependencies.",
            },
        }


# Module-level singletons — import these in views and other services
openrouter_service = OpenRouterService()
job_extractor = openrouter_service   # alias used in older imports
JobExtractor = OpenRouterService     # class alias
