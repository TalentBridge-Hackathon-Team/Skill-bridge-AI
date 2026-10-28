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
    Attempts to heuristically extract a role title from the first few lines of
    the JD. Falls back to 'Software Engineer' if nothing identifiable is found.
    """
    title_patterns = [
        # Explicit labels: Title: Senior Frontend Engineer, Role - Full Stack Developer
        r"(?:(?:job\s+)?title|role|position)\s*[:\-]?\s*([^\n\r]+)",
        # Intro phrases: We are looking for a Senior React Developer to... / Seeking an iOS Engineer...
        r"(?:we are (?:hiring|looking for)|seeking|hiring for)\s+(?:a|an)?\s*([A-Za-z0-9/\-\s]+?(?:developer|engineer|analyst|designer|scientist|manager|lead|intern|specialist|architect))(?:\s+to|\s+who|\s+for|\.|\n|$)",
        # Line starting directly with title
        r"^([A-Za-z0-9/\-\s]{3,60}(?:developer|engineer|analyst|designer|scientist|manager|lead|intern|specialist|architect))",
    ]
    first_lines = "\n".join(job_text.strip().split("\n")[:6])
    for pattern in title_patterns:
        match = re.search(pattern, first_lines, re.IGNORECASE | re.MULTILINE)
        if match:
            candidate = match.group(1).strip().rstrip(".,;:")
            # Sanity check: not too long, not empty
            if 3 < len(candidate) < 80:
                return candidate
    return "Software Engineer"


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
        self.api_key = getattr(
            settings, "OPENROUTER_API_KEY", os.getenv("OPENROUTER_API_KEY", "")
        )
        self.base_url = getattr(
            settings, "OPENROUTER_BASE_URL", os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
        ).rstrip("/")
        self.text_model = getattr(
            settings, "OPENROUTER_TEXT_MODEL", os.getenv("OPENROUTER_TEXT_MODEL", "cohere/north-mini-code:free")
        )
        self.embed_model = getattr(
            settings, "OPENROUTER_EMBED_MODEL", os.getenv("OPENROUTER_EMBED_MODEL", "nvidia/nemotron-3-embed-1b:free")
        )
        self.site_url = getattr(
            settings, "OPENROUTER_SITE_URL", os.getenv("OPENROUTER_SITE_URL", "http://localhost:4000")
        )
        self.site_name = getattr(
            settings, "OPENROUTER_SITE_NAME", os.getenv("OPENROUTER_SITE_NAME", "skillbridge")
        )
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

    def _get_headers(self) -> Dict[str, str]:
        return self._headers()

    # ── Text generation ───────────────────────────────────────────────────────

    def generate_text(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 2500,
        conversation_messages: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """
        Invokes OpenRouter chat completions with OPENROUTER_TEXT_MODEL.
        Includes graceful fallback handling for rate limits (429) or offline states.
        Supports multi-turn conversation history for self-supervised context awareness.
        Always returns a dict with 'success', 'text', and 'model' keys. Never raises.
        """
        # If OpenRouter is not configured, directly use Gemini if available
        if not self.api_key:
            try:
                from services.gemini_service import gemini_service
                if gemini_service.is_configured():
                    logger.info("OPENROUTER_API_KEY not configured — routing to Google Gemini.")
                    return gemini_service.generate_text(
                        prompt=prompt,
                        system_prompt=system_prompt,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        conversation_messages=conversation_messages
                    )
            except Exception as e:
                logger.warning(f"Gemini direct call error: {e}")
            return {"success": False, "error": "no_api_key",
                    "text": "", "model": self.text_model}

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        if conversation_messages:
            for msg in conversation_messages:
                role = msg.get("role") or ("user" if msg.get("sender") == "learner" else "assistant")
                content = msg.get("content") or msg.get("text", "")
                if content:
                    messages.append({"role": role, "content": content})
            if prompt and (not messages or messages[-1].get("content") != prompt):
                messages.append({"role": "user", "content": prompt})
        else:
            messages.append({"role": "user", "content": prompt})

        # Multi-model fallback cascade across OpenRouter free models
        configured_models = []
        if self.text_model:
            configured_models = [m.strip() for m in self.text_model.split(",") if m.strip()]

        candidate_models = [
            *configured_models,
            "google/gemma-4-31b-it:free",
            "google/gemma-4-26b-a4b-it:free",
            "cohere/north-mini-code:free",
            "nvidia/nemotron-3.5-lightning:free",
            "poolside/laguna-s-2.1:free",
            "liquid/lfm-2.5-2.6b:free",
            "recursive/flint-v1.0:free",
            "xingchen-agi/xing4.0-29b-a4b:free",
            "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
        ]
        seen_models = set()
        models_to_try = [m for m in candidate_models if m and not (m in seen_models or seen_models.add(m))]

        last_error = "All candidate models failed"
        for candidate_model in models_to_try:
            payload = {
                "model": candidate_model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            try:
                response = requests.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json=payload,
                    timeout=7,
                )
                if response.status_code == 200:
                    data = response.json()
                    msg = data.get("choices", [{}])[0].get("message", {})
                    content = msg.get("content") or ""
                    import re
                    if not content and msg.get("reasoning"):
                        content = msg.get("reasoning", "")

                    if content:
                        content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()

                    if content and content.strip():
                        return {
                            "success": True,
                            "text": content.strip(),
                            "model": data.get("model", candidate_model),
                            "usage": data.get("usage", {}),
                        }
                    else:
                        logger.info(f"Model {candidate_model} returned empty content, trying next fallback.")
                else:
                    last_error = f"HTTP {response.status_code}: {response.text[:150]}"
                    logger.warning(
                        f"OpenRouter model {candidate_model} returned status {response.status_code}, cascading to fallback."
                    )
                    # If daily account limit on free models is exhausted, break immediately to Gemini
                    if "free-models-per-day" in response.text or "free limit" in response.text or response.status_code == 429:
                        logger.warning("OpenRouter free tier quota exceeded. Cascading directly to Google Gemini.")
                        break
            except Exception as exc:
                last_error = str(exc)
                logger.warning(f"Error calling OpenRouter model {candidate_model}: {exc}")

        # Cascade immediately to Google Gemini API
        try:
            from services.gemini_service import gemini_service
            if gemini_service.is_configured():
                logger.info("Routing request to Google Gemini (%s) for live AI inference.", gemini_service.model)
                gem_res = gemini_service.generate_text(
                    prompt=prompt,
                    system_prompt=system_prompt,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    conversation_messages=conversation_messages
                )
                if gem_res.get("success") and gem_res.get("text"):
                    return {
                        "success": True,
                        "text": gem_res["text"],
                        "model": gem_res.get("model", f"google/{gemini_service.model}"),
                        "usage": gem_res.get("usage", {}),
                    }
                else:
                    logger.warning(f"Gemini API returned error: {gem_res.get('error')}")
        except Exception as gem_exc:
            logger.warning(f"Failed to route to Gemini: {gem_exc}")

        return {
            "success": False,
            "error": last_error,
            "text": "Upstream AI models temporarily rate-limited. Please retry shortly.",
            "model": self.text_model,
        }

    def extract_job_requirements(self, job_text: str, role_title: Optional[str] = None) -> Dict[str, Any]:
        """
        Extracts structured skill requirements from a job posting or career goal using OPENROUTER_TEXT_MODEL.
        Supports any custom role (Backend, Frontend, Full Stack, DevOps, Cloud, AI/ML, Mobile, Security, etc.)
        Falls back to comprehensive multi-domain NLP & rule extraction if LLM is rate-limited or offline.
        Extracts structured skill requirements from a job description.

        Fallback chain:
          1. OpenRouter LLM (google/gemma-4-26b-a4b-it:free)
          2. Deterministic rule engine

        Always returns:
          {role_title, summary, requirements[{skill_name, category,
           importance, source_excerpt}], extraction_source}
        """
        inferred_title = role_title or "Software Engineer"
        system_prompt = (
            f"You are a technical recruiter and talent architect assistant. Extract required and preferred technical skills "
            f"from the job description or career goal for the role '{inferred_title}'. "
            f"Return JSON strictly formatted with keys: 'role_title', 'summary', and 'requirements' "
            f"(a list of objects with 'skill_name', 'category' ['language'|'framework'|'database'|'cloud'|'devops'|'testing'|'architecture'|'tools'], "
            f"'importance' ['required'|'preferred'], and 'source_excerpt'). Do not include markdown code fence formatting outside the JSON."
        )

        llm_result = self.generate_text(
            prompt=f"Job Description:\n\n{job_text}",
            system_prompt=system_prompt,
            temperature=0.1,
            max_tokens=2000,
        )

        if llm_result.get("success") and llm_result.get("text"):
            try:
                import re
                raw_text = llm_result["text"].strip()
                fence_match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', raw_text)
                if fence_match:
                    candidate_json = fence_match.group(1).strip()
                else:
                    brace_match = re.search(r'(\{[\s\S]*\})', raw_text)
                    candidate_json = brace_match.group(1).strip() if brace_match else raw_text

                parsed = json.loads(candidate_json)
                if "requirements" in parsed and len(parsed["requirements"]) > 0:
                    if not parsed.get("role_title") or parsed.get("role_title") in ("Software Engineer", "Software Role", "Junior Backend Developer"):
                        if role_title and role_title not in ("Software Engineer", "Software Role", "Junior Backend Developer"):
                            parsed["role_title"] = role_title
                        else:
                            parsed["role_title"] = _extract_role_title(job_text)
                    elif role_title and role_title not in ("Software Engineer", "Software Role", "Junior Backend Developer"):
                        parsed["role_title"] = role_title
                    source_model = llm_result.get("model", "")
                    parsed.setdefault("extraction_source", f"live_ai_{source_model}" if source_model else "live_ai")
                    return parsed
            except Exception as e:
                logger.info(f"Could not parse LLM JSON output, using dynamic rule fallback: {e}")

        # Comprehensive Multi-Domain Dynamic Extraction
        detected_requirements = []
        lower_text = job_text.lower() if job_text else ""

        # Comprehensive Technical Skills Knowledge Base
        SKILL_CATALOG = [
            # Languages
            ("Python", "language", "required", ["python", "python3", "py"]),
            ("TypeScript", "language", "required", ["typescript", "ts"]),
            ("JavaScript", "language", "required", ["javascript", "js", "es6", "ecmascript"]),
            ("Go", "language", "required", ["golang", "go programming"]),
            ("Java", "language", "required", ["java ", "core java", "java 17", "java 21"]),
            ("Rust", "language", "required", ["rust", "rustlang"]),
            ("C++", "language", "required", ["c++", "cpp"]),
            ("C#", "language", "required", ["c#", "csharp", ".net"]),
            ("SQL", "language", "required", ["sql queries", "structured query language", "complex sql"]),
            ("HTML/CSS", "language", "preferred", ["html", "html5", "css", "css3"]),

            # Frontend & Web Frameworks
            ("React", "framework", "required", ["react", "react.js", "reactjs", "react hooks"]),
            ("Next.js", "framework", "required", ["next.js", "nextjs", "next js"]),
            ("Vue.js", "framework", "required", ["vue", "vue.js", "vuejs"]),
            ("Angular", "framework", "required", ["angular", "angularjs"]),
            ("TailwindCSS", "framework", "preferred", ["tailwind", "tailwindcss", "tailwind css"]),
            ("Redux", "tools", "preferred", ["redux", "redux toolkit", "rtk"]),

            # Backend & API Frameworks
            ("Django REST Framework", "framework", "required", ["django rest framework", "django rest", "drf", "django"]),
            ("FastAPI", "framework", "required", ["fastapi", "fast api", "async python"]),
            ("Node.js", "framework", "required", ["node.js", "nodejs", "node js", "node"]),
            ("Express.js", "framework", "required", ["express", "express.js", "expressjs"]),
            ("Spring Boot", "framework", "required", ["spring boot", "spring framework", "spring"]),
            ("Flask", "framework", "required", ["flask"]),
            ("NestJS", "framework", "required", ["nestjs", "nest.js"]),

            # Databases & Persistence
            ("PostgreSQL", "database", "required", ["postgresql", "postgres", "psql"]),
            ("MongoDB", "database", "required", ["mongodb", "mongo", "nosql"]),
            ("MySQL", "database", "required", ["mysql"]),
            ("Redis", "database", "preferred", ["redis", "caching", "in-memory cache"]),
            ("Vector Databases", "database", "required", ["vector database", "pgvector", "pinecone", "weaviate", "qdrant", "chroma", "embeddings search"]),
            ("DynamoDB", "database", "preferred", ["dynamodb"]),

            # Cloud, Infrastructure & DevOps
            ("AWS", "cloud", "required", ["aws", "amazon web services", "ec2", "s3", "lambda", "rds"]),
            ("Docker", "devops", "required", ["docker", "container", "containerization", "dockerfile"]),
            ("Kubernetes", "devops", "preferred", ["kubernetes", "k8s"]),
            ("Terraform", "cloud", "preferred", ["terraform", "infrastructure as code", "iac"]),
            ("CI/CD", "devops", "preferred", ["ci/cd", "continuous integration", "github actions", "gitlab ci", "jenkins"]),
            ("Linux", "tools", "preferred", ["linux", "bash", "shell scripting", "unix"]),
            ("Git", "tools", "preferred", ["git", "github", "gitlab", "version control"]),

            # Testing & Quality Assurance
            ("API Testing", "testing", "required", ["api testing", "postman", "integration testing", "api tests"]),
            ("Unit Testing", "testing", "required", ["unit testing", "unit tests", "pytest", "jest", "vitest", "tdd"]),

            # Architecture, Security & AI
            ("REST APIs", "architecture", "required", ["rest api", "restful", "rest apis", "rest endpoints"]),
            ("GraphQL", "architecture", "preferred", ["graphql"]),
            ("Microservices", "architecture", "preferred", ["microservices", "distributed systems", "event-driven"]),
            ("Authentication & Security", "architecture", "required", ["jwt", "oauth", "authentication", "authorization", "rbac", "security"]),
            ("Machine Learning", "architecture", "required", ["machine learning", "ml", "deep learning", "nlp"]),
            ("PyTorch", "framework", "required", ["pytorch", "torch"]),
            ("RAG Architecture", "architecture", "required", ["rag", "retrieval augmented generation", "langchain", "llamaindex", "llm"]),
            ("System Design", "architecture", "required", ["system design", "high availability", "scalability", "caching strategies"])
        ]

        seen_skills = set()
        for skill_name, cat, imp, triggers in SKILL_CATALOG:
            for trig in triggers:
                if trig in lower_text:
                    if skill_name not in seen_skills:
                        seen_skills.add(skill_name)
                        detected_requirements.append({
                            "skill_name": skill_name,
                            "category": cat,
                            "importance": imp,
                            "source_excerpt": f"Matched in specification: {trig}"
                        })
                    break

        # If custom role mentions specific terms not in text
        if role_title:
            rt_lower = role_title.lower()
            if "frontend" in rt_lower or "react" in rt_lower:
                for s, c, i in [("React", "framework", "required"), ("TypeScript", "language", "required"), ("HTML/CSS", "language", "preferred"), ("API Testing", "testing", "required")]:
                    if s not in seen_skills:
                        seen_skills.add(s)
                        detected_requirements.append({"skill_name": s, "category": c, "importance": i, "source_excerpt": f"Core competency for {role_title}"})
            elif "devops" in rt_lower or "cloud" in rt_lower or "sre" in rt_lower:
                for s, c, i in [("AWS", "cloud", "required"), ("Docker", "devops", "required"), ("Kubernetes", "devops", "preferred"), ("Terraform", "cloud", "preferred"), ("CI/CD", "devops", "required")]:
                    if s not in seen_skills:
                        seen_skills.add(s)
                        detected_requirements.append({"skill_name": s, "category": c, "importance": i, "source_excerpt": f"Core competency for {role_title}"})
            elif "ai" in rt_lower or "machine learning" in rt_lower or "data" in rt_lower:
                for s, c, i in [("Python", "language", "required"), ("Machine Learning", "architecture", "required"), ("PyTorch", "framework", "required"), ("Vector Databases", "database", "required"), ("SQL", "language", "required")]:
                    if s not in seen_skills:
                        seen_skills.add(s)
                        detected_requirements.append({"skill_name": s, "category": c, "importance": i, "source_excerpt": f"Core competency for {role_title}"})
            elif "full" in rt_lower and "stack" in rt_lower:
                for s, c, i in [("TypeScript", "language", "required"), ("React", "framework", "required"), ("Node.js", "framework", "required"), ("PostgreSQL", "database", "required"), ("REST APIs", "architecture", "required")]:
                    if s not in seen_skills:
                        seen_skills.add(s)
                        detected_requirements.append({"skill_name": s, "category": c, "importance": i, "source_excerpt": f"Core competency for {role_title}"})

        # Fallback if text was brief or non-technical
        if not detected_requirements:
            detected_requirements = [
                {"skill_name": "Software Engineering Fundamentals", "category": "architecture", "importance": "required", "source_excerpt": "Core development foundation"},
                {"skill_name": "Git & Version Control", "category": "tools", "importance": "required", "source_excerpt": "Code collaboration requirement"},
                {"skill_name": "API Design & Integration", "category": "architecture", "importance": "required", "source_excerpt": "System integration requirement"},
                {"skill_name": "Automated Testing", "category": "testing", "importance": "preferred", "source_excerpt": "Software quality assurance"}
            ]

        final_title = role_title if (role_title and role_title not in ("Software Engineer", "Software Role", "Junior Backend Developer")) else _extract_role_title(job_text)
        return {
            "role_title": final_title,
            "summary": f"Extracted {len(detected_requirements)} verified technical requirements for {final_title}.",
            "requirements": detected_requirements,
            "extraction_source": "rule_engine"
        }

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
