"""
Skill-Gap Matching & Feasibility Engine
Blueprint 2.0 (Sections 7 & 8)
Member 3 responsibility: Deterministic & Vector Similarity requirement-to-evidence matching & deadline feasibility.
"""

import math
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class SkillMatchingEngine:
    """Service for deterministic & semantic requirement matching and deadline feasibility calculations."""

    @staticmethod
    def normalize_skill(skill: str) -> str:
        """Normalize skill string for resilient comparison."""
        if not skill:
            return ""
        import re
        spaced = re.sub(r"([a-z])([A-Z])", r"\1 \2", skill)
        return (
            spaced.lower()
            .replace("-", " ")
            .replace("_", " ")
            .replace(".", " ")
            .replace("/", " ")
            .strip()
        )

    @staticmethod
    def is_skill_match(skill_a: str, skill_b: str) -> bool:
        """Check direct or alias similarity between two skills."""
        a = SkillMatchingEngine.normalize_skill(skill_a)
        b = SkillMatchingEngine.normalize_skill(skill_b)
        if not a or not b:
            return False
        if a == b:
            return True

        a_comp = a.replace(" ", "")
        b_comp = b.replace(" ", "")
        if a_comp == b_comp:
            return True

        aliases = {
            "postgres": ["postgresql", "psql"],
            "postgresql": ["postgres", "psql"],
            "django rest framework": ["drf", "django rest", "django api"],
            "drf": ["django rest framework"],
            "js": ["javascript"],
            "ts": ["typescript"],
            "react": ["reactjs", "react js"],
            "node": ["nodejs", "node js"],
            "aws": ["amazon web services", "aws cloud"],
        }

        if (
            b in aliases.get(a, []) or a in aliases.get(b, []) or
            b in aliases.get(a_comp, []) or a in aliases.get(b_comp, []) or
            b_comp in aliases.get(a, []) or a_comp in aliases.get(b, []) or
            b_comp in aliases.get(a_comp, []) or a_comp in aliases.get(b_comp, [])
        ):
            return True

        # Check multi-word substring match
        return (len(a) > 3 and a in b) or (len(b) > 3 and b in a)

    # Broad domain family clusters for generic adjacent skill transferability
    DOMAIN_FAMILIES = {
        "languages": [
            "python", "javascript", "typescript", "ruby", "php", "java", "c++", "cpp",
            "c#", "csharp", "go", "golang", "rust", "swift", "kotlin", "scala", "dart",
            "perl", "r", "elixir", "clojure", "haskell", "lua", "shell", "bash"
        ],
        "relational_db": [
            "postgresql", "postgres", "mysql", "sqlite", "mariadb", "oracle", "mssql",
            "sql server", "cockroachdb", "timescaledb", "aurora", "rds", "pl/sql", "sql"
        ],
        "nosql_db": [
            "mongodb", "couchdb", "dynamodb", "cosmosdb", "firestore", "cassandra",
            "scylladb", "neo4j", "arangodb", "hbase"
        ],
        "in_memory_cache": [
            "redis", "memcached", "hazelcast", "aerospike", "dragonfly", "keydb"
        ],
        "search_engines": [
            "elasticsearch", "opensearch", "solr", "meilisearch", "typesense", "algolia"
        ],
        "vector_db": [
            "pinecone", "weaviate", "qdrant", "milvus", "chroma", "pgvector", "faiss"
        ],
        "web_frameworks": [
            "django", "fastapi", "flask", "express", "nest", "nestjs", "spring",
            "spring boot", "rails", "ruby on rails", "laravel", "gin", "echo", "fiber",
            "asp.net", "fastify", "koa", "tornado"
        ],
        "frontend_frameworks": [
            "react", "reactjs", "vue", "vuejs", "angular", "svelte", "solid", "solidjs",
            "next", "nextjs", "nuxt", "nuxtjs", "remix", "astro", "gatsby"
        ],
        "containers_orchestration": [
            "docker", "podman", "containerd", "kubernetes", "k8s", "nomad", "swarm",
            "docker compose", "ecs", "eks", "gke", "openshift", "helm"
        ],
        "cloud_providers": [
            "aws", "amazon web services", "gcp", "google cloud", "azure", "microsoft azure",
            "digitalocean", "linode", "oracle cloud"
        ],
        "iac_automation": [
            "terraform", "pulumi", "ansible", "puppet", "chef", "cloudformation",
            "bicep", "cdktf", "terragrunt"
        ],
        "message_streaming": [
            "kafka", "rabbitmq", "sqs", "sns", "pubsub", "nats", "eventbridge",
            "kinesis", "pulsar", "celery", "activemq"
        ],
        "testing_frameworks": [
            "pytest", "unittest", "jest", "vitest", "mocha", "chai", "cypress",
            "playwright", "selenium", "junit", "rspec", "supertest"
        ],
        "api_technologies": [
            "rest", "restful", "rest api", "graphql", "grpc", "trpc", "soap",
            "websocket", "openapi", "swagger", "json api"
        ],
        "version_control": [
            "git", "github", "gitlab", "bitbucket", "mercurial", "svn"
        ],
        "ci_cd": [
            "github actions", "gitlab ci", "jenkins", "circleci", "travis", "argocd",
            "flux", "tekton", "drone"
        ],
        "observability": [
            "prometheus", "grafana", "datadog", "new relic", "splunk", "jaeger",
            "opentelemetry", "sentry", "elk", "loki"
        ],
        "css_styling": [
            "tailwind", "tailwindcss", "bootstrap", "material ui", "mui", "chakra",
            "styled components", "scss", "sass", "css", "css3"
        ],
        "ai_ml": [
            "pytorch", "tensorflow", "keras", "scikit learn", "pandas", "numpy",
            "huggingface", "transformers", "langchain", "llamaindex", "rag", "llm"
        ]
    }

    @classmethod
    def get_skill_complexity(cls, category: str, skill_name: str) -> tuple:
        """
        Compute generic complexity multiplier (0.5x to 1.8x) based on requirement category,
        taxonomy keywords, or morphological token stems. Works universally for ANY current or future tool.
        Returns (multiplier: float, category_label: str).
        """
        cat_lower = (category or "").lower().strip()
        skill_norm = cls.normalize_skill(skill_name)

        # 1. Broad Primary Category Mapping (Works for any tool assigned these categories)
        if cat_lower in ["tools", "tool", "utility", "utilities", "cli", "documentation", "version_control", "vcs", "markup", "build"]:
            return (0.5, "utility / tool")
        elif cat_lower in ["testing", "test", "tests", "qa", "quality_assurance", "api", "apis", "library", "libraries", "package", "sdk"]:
            return (0.8, "testing / api")
        elif cat_lower in ["language", "languages", "framework", "frameworks", "database", "databases", "frontend", "backend", "mobile", "web", "fullstack"]:
            return (1.0, "core engineering")
        elif cat_lower in ["cloud", "devops", "infrastructure", "infra", "security", "networking", "sysadmin", "operations", "sre", "platform"]:
            return (1.4, "cloud & infrastructure")
        elif cat_lower in ["architecture", "distributed_systems", "distributed", "data_engineering", "big_data", "ai", "machine_learning", "ml", "deep_learning", "blockchain", "systems_programming", "embedded"]:
            return (1.8, "distributed systems / AI")

        # 2. Generic Keyword & Morphological Token Stems (Works for any unknown/custom tool)
        low_complexity_tokens = [
            "git", "github", "gitlab", "bash", "shell", "markdown", "json", "yaml", "toml", "csv",
            "postman", "jira", "npm", "pip", "yarn", "pnpm", "cli", "linter", "prettier", "eslint",
            "black", "webpack", "vite", "babel", "makefile", "regex"
        ]
        testing_api_tokens = [
            "test", "testing", "spec", "mock", "assert", "fixture", "cypress", "playwright",
            "selenium", "jest", "pytest", "vitest", "api", "rest", "graphql", "grpc", "swagger", "openapi"
        ]
        cloud_tokens = [
            "aws", "gcp", "azure", "docker", "kubernetes", "k8s", "ci/cd", "ci cd", "pipeline",
            "monitoring", "prometheus", "grafana", "telemetry", "terraform", "ansible", "pulumi",
            "infra", "cloud", "linux", "nginx", "container", "helm", "devops", "sre"
        ]
        high_complexity_tokens = [
            "distributed", "microservices", "concurrency", "multithreading", "kernel", "compiler",
            "consensus", "paxos", "raft", "crypto", "security", "encryption", "deep learning",
            "neural", "transformer", "llm", "rag", "agent", "architecture", "system design"
        ]

        if any(tok in skill_norm for tok in low_complexity_tokens):
            return (0.5, "utility / tool")
        elif any(tok in skill_norm for tok in high_complexity_tokens):
            return (1.8, "distributed systems / advanced")
        elif any(tok in skill_norm for tok in cloud_tokens):
            return (1.4, "cloud & infrastructure")
        elif any(tok in skill_norm for tok in testing_api_tokens):
            return (0.8, "testing / api")

        # Balanced default for any general or newly invented technical tool/skill
        return (1.0, "general technical skill")

    @classmethod
    def find_adjacent_transferable_skill(
        cls,
        target_skill: str,
        verified_skills: List[str],
        target_category: Optional[str] = None,
        verified_skill_categories: Optional[Dict[str, str]] = None
    ) -> Optional[tuple]:
        """
        Multi-tier generic adjacent skill transferability evaluation.
        Works for ANY current or future tool via:
        Tier 1: Canonical domain family clusters (40% discount)
        Tier 2: Morphological paradigm stems (e.g. *db, *sql, *framework, *test, *cloud, *mq) (35% discount)
        Tier 3: Category-level domain alignment (30% discount)
        Returns (adjacent_skill_name, discount_rate, rationale_label) or None.
        """
        if not target_skill or not verified_skills:
            return None

        target_norm = cls.normalize_skill(target_skill)

        # Helper for precise family membership check (avoids false-positive single-letter matches like 'r')
        def is_family_match(member: str, target: str) -> bool:
            if member == target:
                return True
            if len(member) >= 3 and len(target) >= 3:
                target_words = target.split()
                return member in target_words or (len(member) >= 4 and member in target)
            return False

        # Tier 1: Canonical Domain Family Clusters (40% transferability)
        for family_name, members in cls.DOMAIN_FAMILIES.items():
            is_target_in_family = any(is_family_match(m, target_norm) for m in members)
            if is_target_in_family:
                for v_skill in verified_skills:
                    v_norm = cls.normalize_skill(v_skill)
                    if v_norm != target_norm and any(is_family_match(m, v_norm) for m in members):
                        return (v_skill, 0.40, f"Domain family '{family_name.replace('_', ' ')}'")

        # Tier 2: Morphological Paradigm Stems (Works for novel/unknown tools, 35% discount)
        stem_paradigms = {
            "database": ["db", "sql", "store", "base", "table", "schema", "nosql"],
            "web/api framework": ["framework", "router", "mvc", "orm", "api", "rest", "server", "http"],
            "cloud/infrastructure": ["cloud", "infra", "container", "cluster", "deploy", "pipeline", "ops"],
            "messaging/streaming": ["queue", "mq", "stream", "bus", "broker", "event", "pubsub"],
            "testing/qa": ["test", "spec", "mock", "assert", "bench", "qa", "coverage"],
            "ai/machine learning": ["ai", "ml", "neural", "vision", "nlp", "llm", "model", "embed", "rag", "agent"]
        }

        for paradigm_name, stems in stem_paradigms.items():
            target_matches_stem = any(stem in target_norm for stem in stems)
            if target_matches_stem:
                for v_skill in verified_skills:
                    v_norm = cls.normalize_skill(v_skill)
                    if v_norm != target_norm and any(stem in v_norm for stem in stems):
                        return (v_skill, 0.35, f"Shared {paradigm_name} paradigm")

        # Tier 3: Category-Level Domain Alignment (30% discount)
        if target_category and verified_skill_categories:
            cat_norm = target_category.lower().strip()
            for v_skill in verified_skills:
                v_cat = (verified_skill_categories.get(v_skill) or "").lower().strip()
                if v_cat and v_cat == cat_norm and cls.normalize_skill(v_skill) != target_norm:
                    return (v_skill, 0.30, f"Shared category '{target_category}'")

        return None

    @classmethod
    def calculate_assessment_scaling(cls, score: Optional[float]) -> tuple:
        """
        Universal continuous linear scaling for assessment scores.
        Accepts any scoring system:
        - 0 to 10 scale (e.g. 7.5 / 10)
        - 0 to 100 percentage scale (e.g. 75 / 100)
        - 0.0 to 1.0 ratio scale (e.g. 0.75)
        Score >= 8.0 normalized -> 0.0 (Demonstrated, 0 hours)
        Score < 8.0 normalized -> scaled factor between 0.20 and 1.0.
        Returns (scaling_factor, normalized_score).
        """
        if score is None:
            return (1.0, 0.0)

        # Adaptive normalization to standard 0-10 scale
        raw_score = float(score)
        if raw_score > 10.0:
            norm_score = min(10.0, max(0.0, round(raw_score / 10.0, 1)))  # e.g., 75% -> 7.5
        elif 0.0 < raw_score <= 1.0:
            norm_score = min(10.0, max(0.0, round(raw_score * 10.0, 1)))  # e.g., 0.75 -> 7.5
        else:
            norm_score = min(10.0, max(0.0, round(raw_score, 1)))

        if norm_score >= 8.0:
            return (0.0, norm_score)

        # Continuous linear scale: max(0.20, (10 - score) / 10)
        scaling_factor = max(0.20, round((10.0 - norm_score) / 10.0, 2))
        return (scaling_factor, norm_score)

    @staticmethod
    def calculate_cosine_similarity(vec_a: Optional[List[float]], vec_b: Optional[List[float]]) -> float:
        """Compute cosine similarity between two vector embeddings."""
        if not vec_a or not vec_b:
            return 0.0

        length = min(len(vec_a), len(vec_b))
        if length == 0:
            return 0.0

        dot_product = sum(vec_a[i] * vec_b[i] for i in range(length))
        norm_a = math.sqrt(sum(vec_a[i] ** 2 for i in range(length)))
        norm_b = math.sqrt(sum(vec_b[i] ** 2 for i in range(length)))

        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0

        return round(dot_product / (norm_a * norm_b), 4)

    @classmethod
    def match(
        cls,
        requirements: List[Dict[str, Any]],
        profile: Dict[str, Any],
        completed_assessments: Optional[List[Dict[str, Any]]] = None,
        use_embeddings: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Compare target requirements against profile evidence records, embeddings, and self-reported skills.
        Statuses (Section 7):
        - Demonstrated: Relevant project or assessment provides evidence at the stated level.
        - Self-reported: Learner claims the skill, but supporting project evidence not verified.
        - Unverified: Insufficient information to determine ability.
        - Needs improvement: Assessment or reviewed evidence shows criteria not yet met.
        """
        evidence_records = profile.get("evidence", []) or profile.get("evidence_records", [])
        raw_skills = profile.get("skills", [])
        if isinstance(raw_skills, str):
            self_reported_skills = [cls.normalize_skill(s) for s in raw_skills.split(",") if s.strip()]
        else:
            self_reported_skills = [cls.normalize_skill(str(s)) for s in raw_skills if s]

        assessments = completed_assessments or []

        # Collect verified skills across the learner profile to compute adjacent transferability
        verified_skills_list = [
            e.get("skill_name") for e in evidence_records
            if (e.get("review_status") == "verified" or e.get("status") == "verified")
            and e.get("evidence_type") != "self_reported" and e.get("skill_name")
        ]
        verified_skill_categories = {
            e.get("skill_name"): e.get("category", "")
            for e in evidence_records
            if (e.get("review_status") == "verified" or e.get("status") == "verified") and e.get("skill_name")
        }
        for a in assessments:
            if a.get("score", 0) >= 8 and a.get("target_skill"):
                verified_skills_list.append(a.get("target_skill"))

        results = []
        for req in requirements:
            skill = req.get("skill_name", "")
            skill_norm = cls.normalize_skill(skill)
            importance = req.get("importance", "required")
            category = req.get("category", "concepts")
            req_id = req.get("requirement_id") or req.get("id") or f"req_{len(results) + 1}"

            # 1. Assessment check
            assessment_match = next(
                (a for a in assessments if cls.is_skill_match(a.get("target_skill", ""), skill)),
                None
            )

            # 2. Evidence matching (exact + alias + embedding similarity)
            matched_evidence = []
            highest_similarity = 0.0

            for ev in evidence_records:
                ev_name = ev.get("skill_name", "")
                is_match = cls.is_skill_match(ev_name, skill)
                similarity = 0.0

                # Semantic vector similarity if embeddings present
                req_emb = req.get("embedding")
                ev_emb = ev.get("embedding")
                if use_embeddings and req_emb and ev_emb:
                    similarity = cls.calculate_cosine_similarity(req_emb, ev_emb)
                    if similarity > highest_similarity:
                        highest_similarity = similarity
                    if similarity >= 0.78:
                        is_match = True

                if is_match:
                    matched_evidence.append(ev)

            # Check evidence statuses
            verified_evidence = [
                e for e in matched_evidence
                if (e.get("review_status") == "verified" or e.get("status") == "verified")
                and e.get("evidence_type") != "self_reported"
            ]
            needs_improvement_evidence = [
                e for e in matched_evidence
                if e.get("review_status") == "needs_improvement" or e.get("status") == "needs_improvement"
            ]

            # 3. Determine status, priority, reason, base effort
            supporting_ids = [e.get("evidence_id") or e.get("id") for e in matched_evidence if e.get("evidence_id") or e.get("id")]

            if assessment_match and assessment_match.get("score", 0) >= 8:
                status = "Demonstrated"
                priority = "Low"
                base_hours = 0.0
                reason = f"Verified by controlled assessment score of {assessment_match['score']}/10."
                action = "Ready to showcase in technical interviews."
            elif verified_evidence:
                status = "Demonstrated"
                priority = "Low"
                base_hours = 0.0
                titles = ", ".join(f'"{e.get("title", "Project")}"' for e in verified_evidence[:2])
                if highest_similarity >= 0.78:
                    reason = f"Verified project evidence found via semantic match (similarity {highest_similarity}): {titles}."
                else:
                    reason = f"Verified project evidence found in learner profile: {titles}."
                action = "Ready to showcase in technical interview questions and portfolio."
            elif assessment_match:
                status = "Needs improvement"
                priority = "High" if importance == "required" else "Medium"
                base_hours = 5.0
                reason = f"Assessment score of {assessment_match['score']}/10 indicates criteria need reinforcement."
                action = "Review assessment feedback and resubmit revised implementation."
            elif needs_improvement_evidence:
                status = "Needs improvement"
                priority = "High" if importance == "required" else "Medium"
                base_hours = 4.0
                reason = "Existing evidence reviewed but flagged for missing test cases or incomplete implementation."
                action = "Refactor project repository and update evidence documentation."
            elif any(cls.is_skill_match(s, skill) for s in self_reported_skills) or matched_evidence:
                status = "Self-reported"
                priority = "High" if importance == "required" else "Medium"
                base_hours = 8.0
                if matched_evidence:
                    reason = "Evidence linked, but pending repository verification or assessment confirmation."
                else:
                    reason = "Listed in profile skills, but no verified project repository or assessment linked."
                action = "Link a project repository featuring implementation code and unit tests."
            else:
                status = "Unverified"
                priority = "High" if importance == "required" else "Medium"
                base_hours = 6.0
                reason = "Required role capability with no supporting project evidence or recorded assessment."
                action = "Complete practical task and rubric assessment."

            # 4. Multi-factor dynamic remediation computation
            if status == "Demonstrated":
                effort = 0.0
                breakdown = {
                    "base_hours": 0.0,
                    "complexity_multiplier": 1.0,
                    "category": category,
                    "adjacent_skill_discount": 0.0,
                    "adjacent_skill_name": None,
                    "assessment_scaling_factor": 0.0,
                    "assessment_score": None,
                    "final_hours": 0.0,
                    "explanation": "Requirement is demonstrated by verified evidence or assessment. 0 remediation hours needed."
                }
            else:
                complexity_mult, cat_label = cls.get_skill_complexity(category, skill)
                adjacent_match = cls.find_adjacent_transferable_skill(
                    skill,
                    verified_skills_list,
                    target_category=category,
                    verified_skill_categories=verified_skill_categories
                )
                adjacent_discount = adjacent_match[1] if adjacent_match else 0.0
                adjacent_skill_name = adjacent_match[0] if adjacent_match else None
                adjacent_rationale = adjacent_match[2] if adjacent_match and len(adjacent_match) > 2 else "Adjacent skill"

                assessment_score = assessment_match.get("score") if assessment_match else None
                assessment_scale, norm_score = cls.calculate_assessment_scaling(assessment_score) if assessment_match else (1.0, 0.0)

                # Raw calculation: base * complexity * (1 - adjacent_discount) * assessment_scale
                raw_effort = base_hours * complexity_mult * (1.0 - adjacent_discount) * assessment_scale
                # Bound between 1.0h and 24.0h for any active remediation gap
                effort = max(1.0, min(24.0, round(raw_effort, 1)))

                # Formulate simple, professional explanation without exposing mathematical internal formulas
                if adjacent_discount > 0 and adjacent_skill_name:
                    explanation = f"Estimated ~{effort} hours of focused preparation, factoring in transferable experience from {adjacent_skill_name}."
                elif assessment_match and assessment_scale < 1.0:
                    explanation = f"Estimated ~{effort} hours of preparation tailored to criteria identified in your recent assessment ({norm_score}/10)."
                else:
                    explanation = f"Estimated ~{effort} hours of focused preparation to bridge this requirement and build demonstrable evidence."

                breakdown = {
                    "base_hours": base_hours,
                    "complexity_multiplier": complexity_mult,
                    "category": cat_label,
                    "adjacent_skill_discount": adjacent_discount,
                    "adjacent_skill_name": adjacent_skill_name,
                    "assessment_scaling_factor": assessment_scale,
                    "assessment_score": norm_score if assessment_match else None,
                    "final_hours": effort,
                    "explanation": explanation
                }

            results.append({
                "requirement_id": req_id,
                "skill_name": skill,
                "category": category,
                "importance": importance,
                "status": status,
                "priority": priority,
                "reason": reason,
                "recommended_action": action,
                "effort_hours_estimate": effort,
                "effort_breakdown": breakdown,
                "similarity_score": highest_similarity if highest_similarity > 0 else None,
                "supporting_evidence_ids": supporting_ids,
            })

        return results

    @staticmethod
    def calculate_match_summary(match_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculate weighted readiness score and metrics summary.
        Formula:
        - Required: weight 2.0, Preferred: weight 1.0
        - Demonstrated = 100%, Self-reported = 50%, Needs improvement = 25%, Unverified = 0%
        """
        if not match_results:
            return {
                "total_assessed": 0,
                "demonstrated_count": 0,
                "self_reported_count": 0,
                "needs_improvement_count": 0,
                "unverified_count": 0,
                "match_score": 0,
                "total_remediation_hours": 0.0,
            }

        demonstrated = 0
        self_reported = 0
        needs_improvement = 0
        unverified = 0
        total_points = 0.0
        earned_points = 0.0
        total_effort = 0.0

        for r in match_results:
            weight = 2.0 if r.get("importance") == "required" else 1.0
            total_points += weight
            total_effort += r.get("effort_hours_estimate", 0.0)

            status = r.get("status")
            if status == "Demonstrated":
                demonstrated += 1
                earned_points += 1.0 * weight
            elif status == "Self-reported":
                self_reported += 1
                earned_points += 0.5 * weight
            elif status == "Needs improvement":
                needs_improvement += 1
                earned_points += 0.25 * weight
            else:
                unverified += 1

        score = round((earned_points / total_points) * 100) if total_points > 0 else 0

        return {
            "total_assessed": len(match_results),
            "demonstrated_count": demonstrated,
            "self_reported_count": self_reported,
            "needs_improvement_count": needs_improvement,
            "unverified_count": unverified,
            "match_score": score,
            "total_remediation_hours": round(total_effort, 1),
        }

    @staticmethod
    def calculate_feasibility(
        days_remaining: Optional[int],
        study_hours_per_day: Optional[float],
        task_estimates: List[float],
        application_prep_hours: float = 4.0
    ) -> Dict[str, Any]:
        """
        Blueprint 2.0 Section 7: Deadline Feasibility Calculation
        Available hours = days remaining * planned study hours per day
        Estimated plan effort = sum of hours for selected tasks + application-preparation time.
        """
        if not days_remaining or days_remaining <= 0 or not study_hours_per_day or study_hours_per_day <= 0:
            return {
                "available_hours": 0,
                "estimated_plan_effort_hours": round(sum(task_estimates) + application_prep_hours, 1),
                "days_remaining": days_remaining or 0,
                "study_hours_per_day": study_hours_per_day or 0,
                "feasibility_band": "Insufficient information",
                "interpretation": "Missing deadline or daily study capacity prevents a useful comparison.",
                "assumptions": ["Please provide days remaining and planned daily study hours."],
                "suggested_scope": "Define deadline and study capacity to evaluate feasibility."
            }

        available_hours = round(days_remaining * study_hours_per_day, 1)
        plan_effort = round(sum(task_estimates) + application_prep_hours, 1)

        ratio = plan_effort / available_hours if available_hours > 0 else 999.0

        if ratio <= 0.85:
            band = "Likely feasible"
            interpretation = f"Estimated prioritized effort ({plan_effort} hrs) is comfortably below available study capacity ({available_hours} hrs)."
            suggested_scope = "Focus on completing High-priority deliverables and maintaining steady study pace."
        elif ratio <= 1.15:
            band = "Tight / uncertain"
            interpretation = f"Estimated effort ({plan_effort} hrs) is close to available time ({available_hours} hrs). Risks may arise if unexpected blockers occur."
            suggested_scope = "Reduce scope to the top 2 highest-value gaps; defer secondary tasks."
        else:
            band = "Not feasible as scoped"
            interpretation = f"Estimated effort ({plan_effort} hrs) exceeds available time ({available_hours} hrs)."
            suggested_scope = "Narrow scope to critical must-have gaps only; consider applying with transparent existing evidence."

        return {
            "available_hours": available_hours,
            "estimated_plan_effort_hours": plan_effort,
            "days_remaining": days_remaining,
            "study_hours_per_day": study_hours_per_day,
            "feasibility_band": band,
            "interpretation": interpretation,
            "assumptions": [
                f"{days_remaining} days remaining before application closing date",
                f"Assumes {study_hours_per_day} hours/day sustained study commitment",
                f"Includes {application_prep_hours} hours for application review and CV tailoring"
            ],
            "suggested_scope": suggested_scope
        }
