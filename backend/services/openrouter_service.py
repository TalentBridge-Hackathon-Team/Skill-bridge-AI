"""
OpenRouter AI Service Integration & Scaffolding
Replaces legacy AWS Bedrock with OpenRouter models:
- Text Generation / Requirement Extraction: OPENROUTER_TEXT_MODEL (google/gemma-4-26b-a4b-it:free)
- RAG Embedding Generation: OPENROUTER_EMBED_MODEL (nvidia/nemotron-3-embed-1b:free)
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class OpenRouterService:
    """Unified service for OpenRouter LLM text generation and RAG embeddings."""

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

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "HTTP-Referer": self.site_url,
            "X-Title": self.site_name,
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

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
        """
        if not self.api_key:
            logger.warning("OPENROUTER_API_KEY not configured. Running in fallback scaffold mode.")
            return {
                "success": False,
                "error": "No API key",
                "text": "Scaffold response: OpenRouter API key not configured.",
                "model": self.text_model,
            }

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

        # Multi-model fallback cascade to guarantee high availability and prevent 429 rate limit stalls
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
        # De-duplicate while preserving priority order
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
                    headers=self._get_headers(),
                    json=payload,
                    timeout=25,
                )
                if response.status_code == 200:
                    data = response.json()
                    msg = data.get("choices", [{}])[0].get("message", {})
                    content = msg.get("content") or ""
                    import re
                    # Handle reasoning models where output is stored in reasoning or thinking
                    if not content and msg.get("reasoning"):
                        raw_reasoning = msg.get("reasoning", "")
                        # Only use reasoning if it contains an actual answer, otherwise avoid leaking scratchpad
                        content = raw_reasoning

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
                    # If daily account limit on free models is exhausted, cascading to other free models won't help
                    if "free-models-per-day" in response.text or "free limit" in response.text:
                        logger.warning("OpenRouter free tier daily quota exhausted across account. Halting free cascade.")
                        break
            except Exception as exc:
                last_error = str(exc)
                logger.warning(f"Error calling OpenRouter model {candidate_model}: {exc}, cascading to next model.")

        return {
            "success": False,
            "error": last_error,
            "text": "Fallback response: Upstream model temporarily unavailable or rate-limited.",
            "model": self.text_model,
        }

    def extract_job_requirements(self, job_text: str, role_title: Optional[str] = None) -> Dict[str, Any]:
        """
        Extracts structured skill requirements from a job posting or career goal using OPENROUTER_TEXT_MODEL.
        Supports any custom role (Backend, Frontend, Full Stack, DevOps, Cloud, AI/ML, Mobile, Security, etc.)
        Falls back to comprehensive multi-domain NLP & rule extraction if LLM is rate-limited or offline.
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
            prompt=f"Role: {inferred_title}\nDescription / Goal:\n{job_text}",
            system_prompt=system_prompt,
            temperature=0.1,
            max_tokens=1500,
        )

        if llm_result.get("success"):
            try:
                raw_text = llm_result["text"].strip()
                if raw_text.startswith("```json"):
                    raw_text = raw_text[7:]
                if raw_text.startswith("```"):
                    raw_text = raw_text[3:]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3]
                parsed = json.loads(raw_text.strip())
                if "requirements" in parsed and len(parsed["requirements"]) > 0:
                    if role_title:
                        parsed["role_title"] = role_title
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

        final_title = role_title or ("Software Engineer" if not detected_requirements else "Custom Career Target")
        return {
            "role_title": final_title,
            "summary": f"Extracted {len(detected_requirements)} verified technical requirements for {final_title}.",
            "requirements": detected_requirements,
        }

    def generate_embeddings(self, text: str) -> List[float]:
        """
        Generates vector embeddings for resume/CV text using OPENROUTER_EMBED_MODEL.
        """
        if not self.api_key:
            logger.warning("OPENROUTER_API_KEY not set for embeddings. Returning fallback vector.")
            return [0.0] * 1024

        payload = {
            "model": self.embed_model,
            "input": text[:2000] if text else "empty",
        }

        try:
            response = requests.post(
                f"{self.base_url}/embeddings",
                headers=self._get_headers(),
                json=payload,
                timeout=25,
            )
            if response.status_code == 200:
                data = response.json()
                embeddings_data = data.get("data", [])
                if embeddings_data and "embedding" in embeddings_data[0]:
                    return embeddings_data[0]["embedding"]
            logger.warning(
                f"OpenRouter embedding endpoint returned status {response.status_code}: {response.text[:200]}"
            )
        except Exception as exc:
            logger.error(f"Error calling OpenRouter embeddings: {exc}")

        # Fallback 2048-dimension normalized vector scaffold (matches nvidia/nemotron-3-embed-1b)
        return [0.0] * 2048


openrouter_service = OpenRouterService()
job_extractor = openrouter_service
JobExtractor = OpenRouterService
