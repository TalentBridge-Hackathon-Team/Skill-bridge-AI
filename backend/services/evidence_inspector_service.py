"""
SkillBridge AI - Member 3: Evidence Inspector & Code Verification Service
Directly integrates GitHub API (https://api.github.com) with GITHUB_TOKEN
and OpenRouter AI models for automated code verification, test suite detection,
and skill proficiency scoring.
"""

import os
import re
import json
import logging
from typing import Dict, Any, Optional, List
import requests
from django.conf import settings
from services.domain_guard_service import domain_guard

logger = logging.getLogger(__name__)

class EvidenceInspectorService:
    """
    Automated Code & Artifact Verification Engine.
    Inspects GitHub repositories using GitHub REST API and OpenRouter LLM.
    """

    def __init__(self):
        self.github_token = getattr(
            settings, "GITHUB_TOKEN", os.getenv("GITHUB_TOKEN", "")
        )
        self.openrouter_api_key = getattr(
            settings, "OPENROUTER_API_KEY", os.getenv("OPENROUTER_API_KEY", "")
        )
        self.openrouter_base_url = getattr(
            settings, "OPENROUTER_BASE_URL", os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
        ).rstrip("/")
        # Load primary inspection model and fallback list from .env / settings
        primary_model = getattr(
            settings, "OPENROUTER_INSPECTION_MODEL", os.getenv("OPENROUTER_INSPECTION_MODEL", "poolside/laguna-s-2.1:free")
        )
        fallback_str = getattr(
            settings,
            "OPENROUTER_INSPECTION_FALLBACK_MODELS",
            os.getenv("OPENROUTER_INSPECTION_FALLBACK_MODELS", "cohere/north-mini-code:free,recursive/flint-v1.0:free,nvidia/nemotron-3.5-lightning:free")
        )
        fallback_list = [m.strip() for m in fallback_str.split(",") if m.strip()]
        self.preferred_models = [primary_model] + [m for m in fallback_list if m != primary_model]


    def _get_github_headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "SkillBridge-AI-Evidence-Inspector",
        }
        if self.github_token:
            headers["Authorization"] = f"token {self.github_token}"
        return headers

    def _get_openrouter_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "skillbridge-ai",
        }
        if self.openrouter_api_key:
            headers["Authorization"] = f"Bearer {self.openrouter_api_key}"
        return headers

    def parse_github_url(self, url: str) -> Optional[Dict[str, str]]:
        """
        Extracts owner and repository name from GitHub URLs.
        Matches formats:
        - https://github.com/owner/repo
        - https://github.com/owner/repo/tree/main/...
        - github.com/owner/repo
        """
        if not url:
            return None
        pattern = r"(?:https?://)?(?:www\.)?github\.com/([a-zA-Z0-9_\-\.]+)/([a-zA-Z0-9_\-\.]+)"
        match = re.search(pattern, url.strip())
        if match:
            owner = match.group(1)
            repo = match.group(2).rstrip("/").removesuffix(".git")
            return {"owner": owner, "repo": repo}
        return None

    def _deep_inspect_manifests(self, owner: str, repo: str, branch: str = "main") -> Dict[str, Any]:
        """
        Deep Manifest & Schema Discovery.
        Directly checks package.json, prisma schemas, requirements.txt, and targeted README highlights
        via high-reliability raw endpoints without rate-limit constraints.
        """
        data: Dict[str, Any] = {
            "accessible": False,
            "dependencies": [],
            "dev_dependencies": [],
            "schema_markers": [],
            "has_automated_tests": False,
            "has_docker": False,
            "readme_excerpt": "",
            "raw_readme_full": "",
        }

        branches = [branch, "main", "master"]
        # Remove duplicates while preserving order
        branches = list(dict.fromkeys([b for b in branches if b]))

        # 1. Package.json (Node/TypeScript ecosystem across root, backend, server, api, frontend)
        node_candidates = [
            "package.json", "backend/package.json", "server/package.json",
            "api/package.json", "src/package.json", "frontend/package.json"
        ]
        test_runners = ["vitest", "jest", "supertest", "mocha", "cypress", "playwright", "pytest"]

        for b in branches:
            found_node = False
            for rel_path in node_candidates:
                try:
                    r = requests.get(f"https://raw.githubusercontent.com/{owner}/{repo}/{b}/{rel_path}", timeout=2.5)
                    if r.status_code == 200:
                        data["accessible"] = True
                        pkg = r.json()
                        deps = list(pkg.get("dependencies", {}).keys())
                        dev_deps = list(pkg.get("devDependencies", {}).keys())
                        for d in deps:
                            if d not in data["dependencies"]:
                                data["dependencies"].append(d)
                        for dd in dev_deps:
                            if dd not in data["dev_dependencies"]:
                                data["dev_dependencies"].append(dd)

                        if any(any(tr in d.lower() for tr in test_runners) for d in deps + dev_deps):
                            data["has_automated_tests"] = True
                        found_node = True
                        break
                except Exception:
                    pass
            if found_node:
                break

        # 2. Python requirements / pyproject (root, backend, api, server)
        py_candidates = [
            "requirements.txt", "backend/requirements.txt", "api/requirements.txt",
            "server/requirements.txt", "pyproject.toml", "backend/pyproject.toml"
        ]
        for b in branches:
            found_py = False
            for rel_path in py_candidates:
                try:
                    r_req = requests.get(f"https://raw.githubusercontent.com/{owner}/{repo}/{b}/{rel_path}", timeout=2.5)
                    if r_req.status_code == 200:
                        data["accessible"] = True
                        lines = r_req.text.split("\n")
                        py_deps = [
                            line.strip().split("==")[0].split(">=")[0].split("<=")[0].strip()
                            for line in lines
                            if line.strip() and not line.startswith("#") and not line.startswith("-")
                        ]
                        for pd in py_deps[:15]:
                            if pd and pd not in data["dependencies"]:
                                data["dependencies"].append(pd)

                        if any(t in r_req.text.lower() for t in ["pytest", "unittest", "coverage"]):
                            data["has_automated_tests"] = True
                        found_py = True
                        break
                except Exception:
                    pass
            if found_py:
                break

        # 3. Prisma Schema / Database Vector Column Detection (root, backend, src, server)
        prisma_candidates = [
            "prisma/schema.prisma", "backend/prisma/schema.prisma",
            "src/prisma/schema.prisma", "server/prisma/schema.prisma"
        ]
        for b in branches:
            found_prisma = False
            for rel_path in prisma_candidates:
                try:
                    r_prisma = requests.get(f"https://raw.githubusercontent.com/{owner}/{repo}/{b}/{rel_path}", timeout=2.5)
                    if r_prisma.status_code == 200:
                        data["accessible"] = True
                        schema_txt = r_prisma.text
                        models = re.findall(r"model\s+(\w+)\s*\{", schema_txt)
                        if any(v in schema_txt.lower() for v in ["vector", "embedding", "pgvector"]):
                            if "Vector Embeddings (e.g. vector(2048) / pgvector)" not in data["schema_markers"]:
                                data["schema_markers"].append("Vector Embeddings (e.g. vector(2048) / pgvector)")
                        for m in models:
                            marker = f"Model: {m}"
                            if any(k in m.lower() for k in ["chunk", "resume", "screen", "embed", "vector", "document", "pipeline", "user", "job"]):
                                if marker not in data["schema_markers"]:
                                    data["schema_markers"].append(marker)
                        found_prisma = True
                        break
                except Exception:
                    pass
            if found_prisma:
                break

        # 4. Docker / Containerization discovery (root, backend, docker, deploy)
        docker_candidates = [
            "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
            "backend/Dockerfile", "docker/Dockerfile", "deploy/Dockerfile"
        ]
        for b in branches:
            for rel_path in docker_candidates:
                try:
                    r_dock = requests.get(f"https://raw.githubusercontent.com/{owner}/{repo}/{b}/{rel_path}", timeout=2.0)
                    if r_dock.status_code == 200:
                        data["has_docker"] = True
                        break
                except Exception:
                    pass
            if data["has_docker"]:
                break

        # 4. Deep README.md extraction with keyword targeting
        for b in branches:
            try:
                r_md = requests.get(f"https://raw.githubusercontent.com/{owner}/{repo}/{b}/README.md", timeout=4)
                if r_md.status_code == 200:
                    data["accessible"] = True
                    full_text = r_md.text
                    data["raw_readme_full"] = full_text
                    overview = full_text[:1200]

                    # Extract context around relevant architectural keywords
                    target_kw = [
                        "rag", "vector", "embedding", "retrieval", "pipeline", "screening",
                        "openrouter", "openai", "unpdf", "mammoth", "prisma", "postgres", "schema"
                    ]
                    lines = full_text.split("\n")
                    matched_snippets = []
                    for i, line in enumerate(lines):
                        if any(k in line.lower() for k in target_kw) and len(line.strip()) > 25:
                            snippet = " ".join([l.strip() for l in lines[max(0, i - 1):min(len(lines), i + 2)] if l.strip()])
                            if snippet not in matched_snippets:
                                matched_snippets.append(snippet)
                            if len(matched_snippets) >= 5:
                                break

                    combined = overview
                    if matched_snippets:
                        combined += "\n\n--- Architectural Highlights ---\n" + "\n".join(matched_snippets)

                    data["readme_excerpt"] = combined[:3500]
                    break
            except Exception:
                pass

        return data

    def fetch_github_repository_data(self, owner: str, repo: str) -> Dict[str, Any]:
        """
        Calls GitHub API endpoints to fetch metadata, language breakdown,
        directory structure, and deep file manifests.
        """
        base_api = f"https://api.github.com/repos/{owner}/{repo}"
        headers = self._get_github_headers()

        result: Dict[str, Any] = {
            "is_github": True,
            "owner": owner,
            "repo": repo,
            "full_name": f"{owner}/{repo}",
            "accessible": False,
            "description": "",
            "stars": 0,
            "languages": {},
            "root_files": [],
            "dependencies": [],
            "schema_markers": [],
            "has_automated_tests": False,
            "has_docker": False,
            "readme_excerpt": "",
        }

        # 1. Main repo metadata from GitHub API (if reachable)
        default_branch = "main"
        try:
            r_meta = requests.get(base_api, headers=headers, timeout=3)
            if r_meta.status_code == 200:
                result["accessible"] = True
                meta_json = r_meta.json()
                result["description"] = meta_json.get("description") or ""
                result["stars"] = meta_json.get("stargazers_count", 0)
                result["topics"] = meta_json.get("topics", [])
                default_branch = meta_json.get("default_branch", "main")
                result["default_branch"] = default_branch
            elif r_meta.status_code == 404:
                result["description"] = "Private repository or repository not found on GitHub."
            else:
                logger.warning(f"GitHub API metadata returned HTTP {r_meta.status_code}")

            # Languages distribution
            r_lang = requests.get(f"{base_api}/languages", headers=headers, timeout=3)
            if r_lang.status_code == 200:
                result["languages"] = r_lang.json()

            # Root directory contents
            r_contents = requests.get(f"{base_api}/contents", headers=headers, timeout=3)
            if r_contents.status_code == 200:
                items = r_contents.json()
                if isinstance(items, list):
                    file_names = [item.get("name", "") for item in items]
                    result["root_files"] = file_names

                    lower_names = [n.lower() for n in file_names]
                    test_indicators = ["test", "tests", "spec", "specs", "cypress", "e2e", "test_"]
                    result["has_automated_tests"] = any(
                        any(ind in name for ind in test_indicators) for name in lower_names
                    )
                    result["has_docker"] = any("docker" in n for n in lower_names)

        except Exception as exc:
            logger.warning(f"GitHub API fetch error for {owner}/{repo}: {exc}")

        # 2. Deep Manifest & Schema Discovery (inspects package.json, schema.prisma, and full README)
        deep_data = self._deep_inspect_manifests(owner, repo, branch=default_branch)
        if deep_data["accessible"]:
            result["accessible"] = True

        result["dependencies"] = deep_data.get("dependencies", [])
        result["schema_markers"] = deep_data.get("schema_markers", [])
        if deep_data.get("has_automated_tests"):
            result["has_automated_tests"] = True
        if deep_data.get("has_docker"):
            result["has_docker"] = True
        if deep_data.get("readme_excerpt"):
            result["readme_excerpt"] = deep_data["readme_excerpt"]

        # 3. Deep Recursive Directory Tree & Code Inspection (Git Trees API)
        try:
            r_tree = requests.get(f"{base_api}/git/trees/{default_branch}?recursive=1", headers=headers, timeout=4)
            if r_tree.status_code == 200:
                result["accessible"] = True
                tree_json = r_tree.json()
                tree_items = tree_json.get("tree", [])

                all_blobs = [item.get("path", "") for item in tree_items if item.get("type") == "blob"]
                all_dirs = list(set(item.get("path", "").rsplit("/", 1)[0] for item in tree_items if "/" in item.get("path", "")))

                result["all_directories"] = all_dirs[:30]
                result["total_files_indexed"] = len(all_blobs)

                # Check for automated tests anywhere in the deep directory hierarchy
                test_file_candidates = [
                    p for p in all_blobs
                    if any(t in p.lower() for t in ["test", "spec", "_test.", ".test.", "tests/"])
                    and not any(skip in p.lower() for skip in ["node_modules", ".git", "dist", "build"])
                ]
                if test_file_candidates:
                    result["has_automated_tests"] = True
                    result["detected_test_files"] = test_file_candidates[:12]

                # Identify skill-relevant deep source files across subdirectories
                relevant_candidates = [
                    p for p in all_blobs
                    if any(p.lower().endswith(ext) for ext in [".py", ".ts", ".js", ".sql", ".go", ".rs", ".java", ".json", ".yml", ".yaml"])
                    and not any(skip in p.lower() for skip in ["node_modules", ".git", "dist", "build", "vendor", "package-lock.json", "yarn.lock"])
                ]
                result["deep_source_files"] = relevant_candidates[:20]

                # Fetch deep code excerpts from the top relevant files
                deep_code_excerpts = []
                for deep_path in relevant_candidates[:6]:
                    try:
                        r_code = requests.get(f"https://raw.githubusercontent.com/{owner}/{repo}/{default_branch}/{deep_path}", timeout=2.5)
                        if r_code.status_code == 200 and len(r_code.text.strip()) > 20:
                            deep_code_excerpts.append({
                                "path": deep_path,
                                "snippet": r_code.text[:1200]
                            })
                    except Exception:
                        pass
                result["deep_code_excerpts"] = deep_code_excerpts
        except Exception as tree_err:
            logger.warning(f"Git tree deep inspection error for {owner}/{repo}: {tree_err}")

        return result


    def inspect_evidence(
        self,
        repository_url: str,
        skill_name: str,
        title: Optional[str] = None,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Comprehensive automated evidence audit.
        Fetches GitHub repo metrics and passes them through OpenRouter AI
        to produce verification score, detected technologies, test validation,
        and concrete strengths/recommendations.
        """
        title = title or f"Implementation of {skill_name}"
        description = description or ""

        # 1. URL Safety & Format Validation
        url_check = domain_guard.validate_repository_url(repository_url)
        if not url_check["is_valid"]:
            return {
                "success": False,
                "skill_name": skill_name,
                "evidence_title": title,
                "repository_url": repository_url,
                "github_verified": False,
                "github_metadata": {
                    "full_name": repository_url,
                    "stars": 0,
                    "languages": [],
                    "has_automated_tests": False,
                    "has_docker": False,
                    "root_files_sample": [],
                },
                "verification_score": 0,
                "suggested_status": "unverified",
                "has_automated_tests": False,
                "detected_technologies": [],
                "strengths": [],
                "recommendations": ["Provide a legitimate, public GitHub repository link containing source code files."],
                "summary_rationale": f"Suspicious or invalid repository URL: {url_check.get('reason')}",
                "evaluation_mode": "security_guardrail",
                "model_used": "domain_guard_engine"
            }

        # 2. Domain & Prompt Injection / Scam Guardrail
        safety_check = domain_guard.evaluate_input_safety_and_domain(description, skill_name)
        if not safety_check["is_safe"]:
            return {
                "success": False,
                "skill_name": skill_name,
                "evidence_title": title,
                "repository_url": repository_url,
                "github_verified": False,
                "github_metadata": {
                    "full_name": repository_url,
                    "stars": 0,
                    "languages": [],
                    "has_automated_tests": False,
                    "has_docker": False,
                    "root_files_sample": [],
                },
                "verification_score": 0,
                "suggested_status": "unverified",
                "has_automated_tests": False,
                "detected_technologies": [],
                "strengths": [],
                "recommendations": ["Submit genuine technical implementation notes matching verified repository files."],
                "summary_rationale": f"Audit safety flag: {safety_check.get('message')}",
                "evaluation_mode": "security_guardrail",
                "model_used": "domain_guard_engine"
            }

        if not safety_check["is_tech_domain"]:
            return {
                "success": False,
                "skill_name": skill_name,
                "evidence_title": title,
                "repository_url": repository_url,
                "github_verified": False,
                "github_metadata": {
                    "full_name": repository_url,
                    "stars": 0,
                    "languages": [],
                    "has_automated_tests": False,
                    "has_docker": False,
                    "root_files_sample": [],
                },
                "verification_score": 0,
                "suggested_status": "unverified",
                "has_automated_tests": False,
                "detected_technologies": [],
                "strengths": [],
                "recommendations": [
                    f"Select a technical requirement. {safety_check.get('detected_domain')} tracks are currently in development."
                ],
                "summary_rationale": safety_check.get("message"),
                "evaluation_mode": "domain_guardrail",
                "model_used": "domain_guard_engine"
            }

        parsed = self.parse_github_url(repository_url)

        github_data: Dict[str, Any] = {}
        if parsed:
            github_data = self.fetch_github_repository_data(parsed["owner"], parsed["repo"])
        else:
            github_data = {
                "is_github": False,
                "accessible": False,
                "full_name": repository_url,
                "description": description,
                "languages": {},
                "root_files": [],
                "has_automated_tests": False,
                "has_docker": False,
                "readme_excerpt": ""
            }

        # Attempt AI Verification with OpenRouter
        ai_assessment = self._evaluate_with_ai(
            skill_name=skill_name,
            title=title,
            description=description,
            github_data=github_data
        )

        # Merge results into final structured response
        return {
            "success": True,
            "skill_name": skill_name,
            "evidence_title": title,
            "repository_url": repository_url,
            "github_verified": bool(github_data.get("accessible")),
            "github_metadata": {
                "full_name": github_data.get("full_name", ""),
                "stars": github_data.get("stars", 0),
                "languages": list(github_data.get("languages", {}).keys()),
                "has_automated_tests": github_data.get("has_automated_tests", False),
                "has_docker": github_data.get("has_docker", False),
                "root_files_sample": github_data.get("root_files", [])[:8],
            },
            "verification_score": ai_assessment["verification_score"],
            "suggested_status": ai_assessment["suggested_status"],
            "has_automated_tests": ai_assessment["has_automated_tests"],
            "detected_technologies": ai_assessment["detected_technologies"],
            "strengths": ai_assessment["strengths"],
            "recommendations": ai_assessment["recommendations"],
            "summary_rationale": ai_assessment["summary_rationale"],
            "evaluation_mode": ai_assessment.get("evaluation_mode", "ai_llm"),
            "model_used": ai_assessment.get("model_used", self.preferred_models[0] if self.preferred_models else "openrouter"),
        }

    def _evaluate_with_ai(
        self,
        skill_name: str,
        title: str,
        description: str,
        github_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Queries OpenRouter models for code audit scoring.
        Falls back to rule-based evaluation if all LLMs are offline or rate-limited.
        """
        languages = list(github_data.get("languages", {}).keys())
        has_tests = github_data.get("has_automated_tests", False)
        root_files = github_data.get("root_files", [])[:10]
        repo_desc = github_data.get("description", "")
        dependencies = github_data.get("dependencies", [])
        schema_markers = github_data.get("schema_markers", [])
        readme_snippet = github_data.get("readme_excerpt", "")[:3500]

        deps_str = ", ".join(dependencies[:25]) if dependencies else "None detected"
        schema_str = ", ".join(schema_markers[:20]) if schema_markers else "None detected"
        dirs_str = ", ".join(github_data.get("all_directories", [])[:15]) if github_data.get("all_directories") else "Root only"

        deep_excerpts = github_data.get("deep_code_excerpts", [])
        deep_code_str = ""
        if deep_excerpts:
            deep_code_str = "\n\n--- Deep Directory Code Samples ---\n" + "\n\n".join(
                [f"File: {e['path']}\n```{e['snippet'][:800]}```" for e in deep_excerpts[:4]]
            )

        prompt = (
            f"Analyze this code repository evidence for the target skill requirement: '{skill_name}'.\n\n"
            f"Evidence Title: {title}\n"
            f"Learner Notes: {description}\n"
            f"Repository: {github_data.get('full_name', 'N/A')}\n"
            f"Repository Description: {repo_desc}\n"
            f"Detected Languages: {languages}\n"
            f"Indexed Directory Hierarchy: {dirs_str}\n"
            f"Key Files: {root_files}\n"
            f"Key Package Dependencies / Installed Libraries: {deps_str}\n"
            f"Database Schema Models & Vector Fields: {schema_str}\n"
            f"Automated Tests Detected in Files: {has_tests}\n"
            f"README Excerpt & Architectural Highlights:\n{readme_snippet}"
            f"{deep_code_str}\n\n"
            f"Evaluate whether this evidence demonstrates real hands-on competency in '{skill_name}'.\n"
            f"CRITICAL: Base your evaluation on concrete code artifacts, installed libraries/SDKs, vector embeddings, "
            f"data models, deep directory implementations, and architectural pipelines present in the repository.\n"
            f"Respond strictly in valid JSON format with NO markdown formatting:\n"
            f"{{\n"
            f'  "verification_score": <integer 0-100>,\n'
            f'  "suggested_status": <"verified" if score >= 70, "needs_improvement" if score >= 40, else "unverified">,\n'
            f'  "has_automated_tests": <true or false>,\n'
            f'  "detected_technologies": [<string>, ...],\n'
            f'  "strengths": [<2-3 concise bullet points>],\n'
            f'  "recommendations": [<1-2 targeted suggestions>],\n'
            f'  "summary_rationale": <1 sentence summary explanation>\n'
            f"}}"
        )

        for model in self.preferred_models:
            try:
                payload = {
                    "model": model,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are a senior software engineering auditor and code reviewer. "
                                "Assess whether the repository demonstrates the target skill requirement. "
                                "Return only raw, valid JSON."
                            )
                        },
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.1,
                    "max_tokens": 500
                }
                res = requests.post(
                    f"{self.openrouter_base_url}/chat/completions",
                    headers=self._get_openrouter_headers(),
                    json=payload,
                    timeout=15
                )
                if res.status_code == 200:
                    raw_text = res.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                    if raw_text:
                        clean_text = raw_text.strip().strip("```json").strip("```").strip()
                        try:
                            parsed = json.loads(clean_text)
                            if "verification_score" in parsed and "suggested_status" in parsed:
                                return {
                                    "verification_score": int(parsed["verification_score"]),
                                    "suggested_status": str(parsed["suggested_status"]),
                                    "has_automated_tests": bool(parsed.get("has_automated_tests", has_tests)),
                                    "detected_technologies": parsed.get("detected_technologies", languages or [skill_name]),
                                    "strengths": parsed.get("strengths", ["Relevant repository structure detected."]),
                                    "recommendations": parsed.get("recommendations", ["Add automated test suite."]),
                                    "summary_rationale": parsed.get("summary_rationale", f"Verified repository evidence for {skill_name}."),
                                    "evaluation_mode": "ai_llm",
                                    "model_used": model,
                                }
                        except Exception as parse_err:
                            logger.warning(f"OpenRouter model '{model}' JSON parse error: {parse_err}. Raw text: {raw_text[:150]}")
                else:
                    logger.warning(f"OpenRouter model '{model}' returned HTTP {res.status_code}: {res.text[:150]}")
            except Exception as e:
                logger.warning(f"OpenRouter model '{model}' skipped during verification: {e}")
                continue

        # Deterministic Heuristic Fallback Engine
        return self._heuristic_evidence_evaluation(
            skill_name=skill_name,
            title=title,
            description=description,
            github_data=github_data
        )

    def _heuristic_evidence_evaluation(
        self,
        skill_name: str,
        title: str,
        description: str,
        github_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Deterministic, audit-proof fallback evaluation when upstream LLMs are unreachable.
        Calculates score based on language matches, file markers, dependencies, schemas, and test suites.
        """
        score = 25  # baseline for submitting an accessible repo reference
        strengths = []
        recommendations = []
        detected_tech = set()

        skill_lower = skill_name.lower()
        combined_text = f"{title} {description} {github_data.get('description', '')} {github_data.get('readme_excerpt', '')}".lower()
        dependencies = [d.lower() for d in github_data.get("dependencies", [])]

        # Normalize skill for flexible alias matching
        skill_clean = re.sub(r"[^a-zA-Z0-9]", "", skill_lower)
        
        # Domain Ecosystem Library Registry for Multi-Stack Flexibility
        domain_ecosystems = {
            "ai_rag": [
                "openai", "langchain", "llamaindex", "pinecone", "chroma", "qdrant",
                "weaviate", "pgvector", "unpdf", "mammoth", "transformer", "huggingface",
                "torch", "tensorflow", "ollama", "mistral", "anthropic"
            ],
            "database": [
                "prisma", "pg", "psycopg", "postgres", "typeorm", "sqlalchemy",
                "mongoose", "mongodb", "redis", "mysql", "sqlite", "sequelize", "knex"
            ],
            "backend_api": [
                "express", "django", "rest_framework", "fastapi", "flask", "nestjs",
                "graphql", "apollo", "trpc", "koa", "fastify", "celery"
            ],
            "auth_security": [
                "jwt", "jose", "bcrypt", "passport", "auth0", "oauth", "crypto",
                "jsonwebtoken", "argon2", "helmet"
            ],
            "frontend_ui": [
                "react", "vue", "angular", "next", "nuxt", "svelte", "tailwind",
                "redux", "zustand", "radix", "lucide", "vite"
            ],
            "devops_cloud": [
                "docker", "kubernetes", "k8s", "terraform", "ansible", "boto3",
                "@aws-sdk", "aws", "gcp", "azure", "serverless", "helm"
            ],
            "testing": [
                "vitest", "jest", "pytest", "supertest", "mocha", "cypress",
                "playwright", "unittest", "testing-library", "coverage"
            ]
        }

        # 1. Check title/description/readme relevance
        if skill_lower in combined_text or skill_clean in combined_text.replace(" ", ""):
            score += 20
            strengths.append(f"Direct match for '{skill_name}' found in repository documentation and architecture.")
            detected_tech.add(skill_name)

        # 2. Check languages
        languages = github_data.get("languages", {})
        for lang in languages:
            detected_tech.add(lang)
            if lang.lower() in skill_lower or skill_lower in lang.lower():
                score += 15
                strengths.append(f"Repository source code heavily utilizes {lang}.")

        # 3. Dynamic Multi-Domain Dependency & SDK Audit
        relevant_deps = []
        for dep in github_data.get("dependencies", []):
            dep_l = dep.lower()
            dep_clean = re.sub(r"[^a-zA-Z0-9]", "", dep_l)
            
            # Direct skill matching in package names (e.g. redis in ioredis, react in react-dom, etc.)
            is_direct_skill_dep = (
                (len(skill_clean) >= 3 and skill_clean in dep_clean) or
                (len(dep_clean) >= 3 and dep_clean in skill_clean)
            )

            # Match against relevant domain ecosystems
            matches_domain = False
            for domain_keywords in domain_ecosystems.values():
                if any(kw in dep_l for kw in domain_keywords):
                    matches_domain = True
                    break

            if is_direct_skill_dep or matches_domain:
                relevant_deps.append(dep)
                detected_tech.add(dep)

        if relevant_deps:
            score += 20
            strengths.append(f"Verified core production libraries and SDKs: {', '.join(relevant_deps[:5])}.")

        # 4. Check schema models & vector/data fields
        schema_markers = github_data.get("schema_markers", [])
        if schema_markers:
            score += 20
            strengths.append(f"Verified structured data models / schema definitions: {', '.join(schema_markers[:3])}.")
            if any("vector" in s.lower() for s in schema_markers):
                detected_tech.add("Vector Embeddings")
            detected_tech.add("Database Schema")

        # 5. Check automated tests across multiple languages
        test_indicators = ["vitest", "jest", "pytest", "supertest", "mocha", "cypress", "playwright", "unittest"]
        has_tests = (
            github_data.get("has_automated_tests")
            or any(t in combined_text for t in ["test", "spec", "pytest"])
            or any(any(t in d for t in test_indicators) for d in dependencies)
        )
        if has_tests:
            score += 15
            strengths.append("Automated test suite (unit / integration specs) detected.")
            detected_tech.add("Automated Tests")
        else:
            recommendations.append(f"Add a dedicated test directory (e.g. tests/) validating {skill_name} features.")

        # 6. Check Docker / Cloud Deployment
        if github_data.get("has_docker") or "docker" in combined_text or any("docker" in d for d in dependencies):
            score += 10
            strengths.append("Containerization configuration (Dockerfile / docker-compose) present.")
            detected_tech.add("Docker")

        score = min(100, max(25, score))

        if score >= 70:
            status = "verified"
            rationale = f"Repository demonstrates verified hands-on implementation of {skill_name}."
        elif score >= 40:
            status = "needs_improvement"
            rationale = f"Relevant artifacts found for {skill_name}, but test coverage or depth needs improvement."
        else:
            status = "unverified"
            rationale = f"Artifact reference submitted, but direct code proof for {skill_name} is unverified."

        if not recommendations:
            recommendations.append("Continue maintaining documentation and test coverage.")

        return {
            "verification_score": score,
            "suggested_status": status,
            "has_automated_tests": bool(github_data.get("has_automated_tests", False)),
            "detected_technologies": list(detected_tech) if detected_tech else [skill_name],
            "strengths": strengths or [f"Active artifact linked for {skill_name}."],
            "recommendations": recommendations,
            "summary_rationale": rationale,
            "evaluation_mode": "fallback_heuristic",
            "model_used": "deterministic_rule_engine",
        }

    def generate_remediation_advice(
        self,
        skill_name: str,
        category: str,
        importance: str,
        remediation_hours: float,
        effort_breakdown: Optional[Dict[str, Any]] = None,
        experience_level: str = "Entry Level",
        role_title: str = "Software Developer",
        connected_evidence: Optional[List[Dict[str, Any]]] = None,
        skill_status: str = "Unverified",
        days_remaining: int = 14,
        feasibility_status: str = "moderate"
    ) -> Dict[str, Any]:
        """
        AI Contextual Remediation Advisor with Level-Calibrated Pedagogy and Smart Track Recommendation.
        """
        budget = max(3.0, float(remediation_hours or 8.0))
        h_foundation = max(2, int(round(budget * 0.75)))
        h_core = max(3, int(round(budget * 1.0)))
        h_stretch = max(4, int(round(budget * 1.25)))

        prompt = (
            f"You are a Senior Engineering Hiring Manager and Technical Mentor.\n"
            f"Candidate Experience Level: {experience_level}\n"
            f"Candidate Target Role: {role_title}\n"
            f"Target Skill Gap: {skill_name} ({category}, {importance})\n"
            f"Calculated Remediation Time Budget: {budget} hours\n\n"
            f"CRITICAL TIME & PEDAGOGY RULE:\n"
            f"Every project track MUST be strictly achievable within the candidate's time budget ({budget}h) and study schedule.\n"
            f"Do NOT give textbook toys (NO MNIST, NO Titanic), but do NOT give unrealistic Staff-level challenges that cause drop-off.\n"
            f"Scale project deliverables strictly to fit these exact time allocations:\n"
            f"  - Track 1: Foundation (Scoped to ~{h_foundation}h [~75% of budget], high confidence, minimal blockers, verified proof)\n"
            f"  - Track 2: Core (Scoped to ~{h_core}h [100% of budget], core job-ready benchmark for {role_title})\n"
            f"  - Track 3: Stretch (Scoped to ~{h_stretch}h [~125% of budget], achievable standout proof without schedule explosion)\n\n"
            f"Respond strictly in valid JSON format with NO markdown formatting:\n"
            f"{{\n"
            f'  "interview_focus_questions": [<3-4 technical questions tailored to {experience_level} interview expectations for {skill_name}>],\n'
            f'  "hands_on_project_exercise": <1-sentence high-level summary of the recommended core track>,\n'
            f'  "practice_project_options": [\n'
            f'    {{\n'
            f'      "title": <Specific, impressive project title>,\n'
            f'      "track": <"Foundation (~{h_foundation}h)" | "Core (~{h_core}h)" | "Stretch (~{h_stretch}h)">,\n'
            f'      "level": <"Foundation" | "Core Benchmark" | "Stretch Challenge">,\n'
            f'      "time_estimate_hours": <number matching the track allocation>,\n'
            f'      "difficulty_tier": <"foundation" | "core" | "stretch">,\n'
            f'      "description": <2-3 sentence detailed architectural description strictly achievable within the allocated hours>,\n'
            f'      "rationale": <1-2 clear, encouraging sentences explaining why this project is valuable for {role_title} within {budget} hours (do NOT use internal jargon like calibrated or anti-toy)>,\n'
            f'      "key_tech": [<4-6 concrete libraries and tools>],\n'
            f'      "target_deliverables": [<2-3 specific repository files or artifacts to commit>]\n'
            f'    }}\n'
            f'  ],\n'
            f'  "recommended_deliverables": [<2-3 portfolio artifacts>]\n'
            f"}}"
        )

        for model in self.preferred_models:
            try:
                payload = {
                    "model": model,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                f"You are a Senior Engineering Hiring Manager and Technical Mentor. "
                                f"Candidate is at '{experience_level}' level aiming for '{role_title}'. "
                                f"Always calibrate project scope and interview questions strictly to this experience tier. "
                                f"Never suggest trivial toys like MNIST or Titanic, but never prescribe overwhelming staff-level math. "
                                f"Output strictly valid JSON."
                            )
                        },
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.2,
                    "max_tokens": 850
                }
                res = requests.post(
                    f"{self.openrouter_base_url}/chat/completions",
                    headers=self._get_openrouter_headers(),
                    json=payload,
                    timeout=12
                )
                if res.status_code == 200:
                    raw_text = res.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                    if raw_text:
                        clean_text = raw_text.strip().strip("```json").strip("```").strip()
                        parsed = json.loads(clean_text)
                        if "interview_focus_questions" in parsed and parsed.get("practice_project_options"):
                            advice = {
                                "success": True,
                                "skill_name": skill_name,
                                "experience_level": experience_level,
                                "role_title": role_title,
                                "remediation_hours": budget,
                                "interview_focus_questions": parsed.get("interview_focus_questions", []),
                                "hands_on_project_exercise": parsed.get("hands_on_project_exercise", f"Calibrated {skill_name} implementation project"),
                                "practice_project_options": parsed.get("practice_project_options", []),
                                "recommended_deliverables": parsed.get("recommended_deliverables", []),
                                "advisor_mode": "ai_llm",
                                "model_used": model
                            }
                            return self._enrich_with_track_recommendation(
                                advice=advice,
                                experience_level=experience_level,
                                skill_status=skill_status,
                                remediation_hours=budget,
                                days_remaining=days_remaining,
                                feasibility_status=feasibility_status,
                                importance=importance,
                                role_title=role_title
                            )
            except Exception as e:
                logger.info(f"OpenRouter advisor skipped for {model}: {e}")
                continue

        # Level-Calibrated Domain Specialized Fallback Catalog
        fallback_advice = self._get_domain_specialized_advice(
            skill_name=skill_name,
            category=category,
            remediation_hours=budget,
            experience_level=experience_level,
            role_title=role_title
        )
        return self._enrich_with_track_recommendation(
            advice=fallback_advice,
            experience_level=experience_level,
            skill_status=skill_status,
            remediation_hours=budget,
            days_remaining=days_remaining,
            feasibility_status=feasibility_status,
            importance=importance,
            role_title=role_title
        )

    def _enrich_with_track_recommendation(
        self,
        advice: Dict[str, Any],
        experience_level: str = "Entry Level",
        skill_status: str = "Unverified",
        remediation_hours: float = 8.0,
        days_remaining: int = 14,
        feasibility_status: str = "moderate",
        importance: str = "required",
        role_title: str = "Software Developer"
    ) -> Dict[str, Any]:
        """
        Intelligently selects the single recommended track among the 3 options
        based on available study time, user experience tier, and skill verification state.
        """
        options = advice.get("practice_project_options", [])
        if not options or len(options) < 3:
            return advice

        is_entry = any(t in experience_level.lower() for t in ["entry", "junior", "student", "intern", "transition", "beginner"])
        is_senior = any(t in experience_level.lower() for t in ["senior", "lead", "principal", "staff", "architect"])
        is_tight = (feasibility_status.lower() in ["tight", "critical", "danger"] or days_remaining <= 7)
        is_self_reported = any(t in skill_status.lower() for t in ["self-reported", "self_reported", "claimed"])

        rec_index = 1
        rec_rationale = ""

        # Rule 1: High Time Pressure or Critical Deadline -> Foundation (Track 1)
        if is_tight:
            rec_index = 0
            rec_rationale = (
                f"Recommended for your timeline: With {days_remaining} days remaining, "
                f"Track 1 (~{options[0].get('time_estimate_hours', 6)}h) gives you a focused scope to build verified proof "
                f"before your deadline without an incomplete project."
            )

        # Rule 2: Senior Candidate with Comfortable Timeline -> Stretch (Track 3)
        elif is_senior:
            if feasibility_status.lower() in ["comfortable", "green"] and days_remaining >= 14:
                rec_index = 2
                rec_rationale = (
                    f"Recommended for your background: Given your experience and timeline ({days_remaining} days), "
                    f"Track 3 (~{options[2].get('time_estimate_hours', 12)}h) demonstrates the architecture, testing, "
                    f"and performance expected of experienced engineers."
                )
            else:
                rec_index = 1
                rec_rationale = (
                    f"Recommended benchmark: Track 2 (~{options[1].get('time_estimate_hours', 8)}h) "
                    f"delivers the core production architecture and test coverage expected for {role_title}."
                )

        # Rule 3: Entry-Level with Self-Reported Skill -> Core (Track 2)
        elif is_entry and is_self_reported:
            rec_index = 1
            rec_rationale = (
                f"Recommended for your profile: Since you already have foundational familiarity with {advice.get('skill_name')}, "
                f"Track 2 (~{options[1].get('time_estimate_hours', 8)}h) goes directly into real-world features and validation "
                f"to demonstrate job-readiness for {role_title}."
            )

        # Rule 4: Entry-Level Starting Fresh (Unverified) -> Foundation (Track 1)
        elif is_entry and not is_self_reported and days_remaining <= 14:
            rec_index = 0
            rec_rationale = (
                f"Recommended starting point: As a new skill, "
                f"Track 1 (~{options[0].get('time_estimate_hours', 6)}h) focuses on practical fundamentals, "
                f"helping you build demonstrable evidence with confidence."
            )

        # Rule 5: Standard Sweet Spot -> Core (Track 2)
        else:
            rec_index = 1
            rec_rationale = (
                f"Recommended for your timeline: Aligned with your ~{int(remediation_hours)}h budget and target role. "
                f"Track 2 delivers practical, well-tested project deliverables for {role_title}."
            )

        for i, opt in enumerate(options):
            if i == rec_index:
                opt["is_recommended"] = True
                opt["recommendation_rationale"] = rec_rationale
            else:
                opt["is_recommended"] = False
                opt.pop("recommendation_rationale", None)

        advice["recommended_track_index"] = rec_index
        advice["recommendation_rationale"] = rec_rationale
        return advice

    def _get_domain_specialized_advice(
        self,
        skill_name: str,
        category: str,
        remediation_hours: float,
        experience_level: str = "Entry Level",
        role_title: str = "Software Developer"
    ) -> Dict[str, Any]:
        """
        Level-Calibrated Domain Guidance.
        Provides 3 curated progressive project tracks matching the learner's experience level:
          - Track 1: Foundation Bridge (Scoped to effort budget, bridges existing background, accessible)
          - Track 2: Core Competency (Core benchmark expected for the target role)
          - Track 3: High-Signal Stretch (Ambitious standout project without overwhelming complexity)
        """
        skill_lower = skill_name.lower()
        is_entry = any(t in experience_level.lower() for t in ["entry", "junior", "student", "intern", "transition", "beginner"])
        is_senior = any(t in experience_level.lower() for t in ["senior", "lead", "principal", "staff", "architect"])

        budget = max(3.0, float(remediation_hours or 8.0))
        h_foundation = max(2, int(round(budget * 0.75)))
        h_core = max(3, int(round(budget * 1.0)))
        h_stretch = max(4, int(round(budget * 1.25)))

        # =========================================================================
        # 1. PyTorch / Deep Learning Ecosystem
        # =========================================================================
        if any(term in skill_lower for term in ["pytorch", "torch", "deep learning", "neural network"]):
            if is_entry:
                # ENTRY LEVEL CALIBRATION (Student / Junior Transitioner)
                return {
                    "success": True,
                    "skill_name": skill_name,
                    "experience_level": experience_level,
                    "role_title": role_title,
                    "remediation_hours": budget,
                    "advisor_mode": "domain_expert_engine",
                    "interview_focus_questions": [
                        "What is the fundamental difference between a PyTorch Tensor and a NumPy ndarray, and how does autograd track operations with requires_grad=True?",
                        "Why is calling model.eval() and torch.no_grad() critical during model inference, and what happens to Dropout and BatchNorm layers if omitted?",
                        "How do you handle class imbalance during dataset loading, and why is accuracy or training loss alone a misleading indicator of performance?",
                        "How do PyTorch DataLoader parameters (batch_size, num_workers, pin_memory) affect training throughput and GPU/CPU data starvation?"
                    ],
                    "hands_on_project_exercise": f"Build a clean PyTorch transfer learning classifier with custom Dataset/DataLoader, validation metrics, and FastAPI inference serving.",
                    "practice_project_options": [
                        {
                            "title": "PyTorch Transfer Learning & Clean REST API Serving",
                            "track": f"Foundation (~{h_foundation}h)",
                            "level": "Foundation",
                            "time_estimate_hours": h_foundation,
                            "difficulty_tier": "foundation",
                            "description": "Fine-tune a pre-trained backbone (e.g. ResNet-18 or DistilBERT) on a domain dataset. Implement a structured PyTorch Dataset and DataLoader with stratified train/validation splits, evaluation metrics (Accuracy, Macro-F1), and serve predictions via a lightweight FastAPI endpoint.",
                            "rationale": f"Fits your ~{budget}h timeline. Connects foundational neural inference with clean REST API patterns, building practical confidence.",
                            "key_tech": ["PyTorch (torch, torchvision)", "FastAPI", "scikit-learn (metrics)", "pytest", "Docker"],
                            "target_deliverables": [
                                "dataset.py with custom PyTorch Dataset and stratified train/val splits",
                                "train_and_evaluate.py logging loss curves and validation F1 score",
                                "api.py serving single and batch prediction requests with Pydantic validation"
                            ]
                        },
                        {
                            "title": "Data Pipeline, Augmentations & Validation Guardrails",
                            "track": f"Core (~{h_core}h)",
                            "level": "Core Benchmark",
                            "time_estimate_hours": h_core,
                            "difficulty_tier": "core",
                            "description": "Construct an end-to-end training pipeline focusing on real-world data engineering gotchas: out-of-memory avoidance with mini-batching, custom data augmentations, class imbalance handling with WeightedRandomSampler, and early stopping checkpoints on validation loss plateaus.",
                            "rationale": f"Demonstrates practical model training, validation pipelines, and data handling within your ~{budget}h target.",
                            "key_tech": ["PyTorch (DataLoader, WeightedRandomSampler)", "Albumentations / torchvision", "TensorBoard / Matplotlib", "pytest"],
                            "target_deliverables": [
                                "pipeline/dataloader.py with augmentations and stratified sampling",
                                "checkpointing.py saving best model weights on validation loss plateaus",
                                "test_pipeline.py asserting tensor dimensions and absence of data leakage"
                            ]
                        },
                        {
                            "title": "TorchScript Serialization & Containerized Microservice",
                            "track": f"Stretch (~{h_stretch}h)",
                            "level": "Stretch Challenge",
                            "time_estimate_hours": h_stretch,
                            "difficulty_tier": "stretch",
                            "description": "Take a trained PyTorch model, export and compile it into a serialized TorchScript artifact via torch.jit.trace, package it in a hardened Docker container, and benchmark p95 inference latency against raw Python execution under simulated load.",
                            "rationale": f"A standout project (~{h_stretch}h) demonstrating model serialization, Docker deployment, and latency benchmarking.",
                            "key_tech": ["PyTorch (torch.jit)", "FastAPI", "Docker", "Apache Bench / Locust", "pytest"],
                            "target_deliverables": [
                                "export_jit.py generating serialized .pt TorchScript bundle",
                                "Dockerfile with multi-stage build and non-root user execution",
                                "benchmark_report.md documenting latency improvements of JIT vs eager mode"
                            ]
                        }
                    ],
                    "recommended_deliverables": [
                        "GitHub repository featuring PyTorch pipeline, automated tests, and Dockerfile.",
                        "Clean README with loss convergence plots, evaluation metrics, and API documentation."
                    ]
                }
            else:
                # MID / SENIOR LEVEL CALIBRATION
                return {
                    "success": True,
                    "skill_name": skill_name,
                    "experience_level": experience_level,
                    "role_title": role_title,
                    "remediation_hours": remediation_hours,
                    "advisor_mode": "domain_expert_engine",
                    "interview_focus_questions": [
                        "How do you profile, identify, and resolve CUDA Out-of-Memory (OOM) errors during large batch training in PyTorch?",
                        "What are the latency, memory, and deployment trade-offs between eager execution, TorchScript JIT tracing, and torch.compile() in production?",
                        "How do you implement gradient accumulation and mixed-precision (torch.cuda.amp) while preventing numerical gradient underflow?",
                        "How do PyTorch DistributedDataParallel (DDP) and Fully Sharded Data Parallel (FSDP) synchronize gradients across multi-GPU nodes?"
                    ],
                    "hands_on_project_exercise": "Deploy an asynchronous PyTorch model inference microservice with dynamic INT8 quantization, TorchScript tracing, and latency benchmarks proving <30ms p95 response time.",
                    "practice_project_options": [
                        {
                            "title": "Production PyTorch Model Serving & INT8 Dynamic Quantization Engine",
                            "track": "Production Systems & Inference",
                            "level": "Production Grade",
                            "time_estimate_hours": 16,
                            "difficulty_tier": "core",
                            "description": "Deploy an asynchronous inference microservice hosting a TorchScript-compiled model with dynamic INT8 quantization. Includes Docker multi-stage build, Prometheus latency tracking, and Locust load benchmarks proving <30ms p95 latency under concurrent traffic.",
                            "rationale": "Separates junior notebook experimenters from production ML engineers. Hiring managers evaluate whether you can package, quantize, and serve models under real-world concurrent API traffic with strict SLAs.",
                            "key_tech": ["PyTorch (torch.jit, torch.quantization)", "FastAPI", "Docker", "Locust", "pytest"],
                            "target_deliverables": [
                                "Dockerfile with multi-stage layers and non-root security",
                                "benchmark_latency.py script proving p95 <30ms under 100 concurrent users",
                                "test_inference.py with automated unit and regression tests"
                            ]
                        },
                        {
                            "title": "Custom Autograd Multi-Head Attention & PyTorch Lightning Pipeline",
                            "track": "Core Neural Architecture & Deep Autograd",
                            "level": "Core Architecture",
                            "time_estimate_hours": 20,
                            "difficulty_tier": "stretch",
                            "description": "Implement custom neural layers from scratch subclassing torch.nn.Module, writing analytical forward and backward mathematical passes. Train on structured datasets with PyTorch Lightning, gradient accumulation, mixed-precision (fp16 AMP), and W&B experiment tracking.",
                            "rationale": "Demonstrates true mastery over PyTorch tensors, autograd computation graphs, and memory management rather than relying solely on pre-baked HuggingFace abstractions.",
                            "key_tech": ["PyTorch (torch.nn, torch.autograd)", "PyTorch Lightning", "torch.cuda.amp", "W&B", "pytest"],
                            "target_deliverables": [
                                "custom_modules/ package with unit-tested analytical gradients",
                                "train_pipeline.py with automated checkpointing and early stopping",
                                "Loss convergence charts and tensor architecture diagrams in README"
                            ]
                        },
                        {
                            "title": "Siamese Contrastive Representation Network & Vector Search System",
                            "track": "Applied Enterprise Integration & RAG",
                            "level": "Advanced Enterprise",
                            "time_estimate_hours": 24,
                            "difficulty_tier": "stretch",
                            "description": "Train a Siamese dual-encoder neural network with Triplet Loss to transform unstructured domain documents into dense 768-dimensional embeddings. Index generated vectors in a pgvector/FAISS store for sub-millisecond semantic retrieval.",
                            "rationale": "Bridges PyTorch deep learning with modern enterprise RAG and search architectures, providing undeniable proof of end-to-end vector pipeline engineering.",
                            "key_tech": ["PyTorch", "pgvector / FAISS", "PostgreSQL", "torchvision / torcheval", "Docker"],
                            "target_deliverables": [
                                "Trained PyTorch embedding pipeline with checkpoint export",
                                "Vector database indexer with recall@k benchmarking",
                                "Interactive similarity CLI/API demo retrieving similar document embeddings"
                            ]
                        }
                    ],
                    "recommended_deliverables": [
                        "GitHub repository featuring PyTorch implementation, automated CI tests, and Dockerfile.",
                        "Comprehensive README with latency benchmarks, architecture diagrams, and trade-off analysis."
                    ]
                }

        # =========================================================================
        # 2. PostgreSQL / Database Systems
        # =========================================================================
        if any(term in skill_lower for term in ["postgres", "postgresql", "psql", "sql", "database"]):
            if is_entry:
                return {
                    "success": True,
                    "skill_name": skill_name,
                    "experience_level": experience_level,
                    "role_title": role_title,
                    "remediation_hours": budget,
                    "advisor_mode": "domain_expert_engine",
                    "interview_focus_questions": [
                        "What is the difference between an INNER JOIN, LEFT JOIN, and FULL OUTER JOIN, and when should you use composite primary vs foreign keys?",
                        "How do B-Tree indexes accelerate SELECT queries, and why does having too many indexes degrade INSERT and UPDATE performance?",
                        "What is the N+1 query problem in backend ORMs, and how do you resolve it using SQL joins or select_related / prefetch_related?",
                        "What are ACID transactions in PostgreSQL, and how does BEGIN / COMMIT / ROLLBACK ensure database consistency during unexpected errors?"
                    ],
                    "hands_on_project_exercise": "Design a normalized PostgreSQL schema (3NF) with foreign key constraints, composite indexes, and benchmarked analytical queries.",
                    "practice_project_options": [
                        {
                            "title": "Normalized Relational Schema & Indexed REST Service",
                            "track": f"Foundation (~{h_foundation}h)",
                            "level": "Foundation",
                            "time_estimate_hours": h_foundation,
                            "difficulty_tier": "foundation",
                            "description": "Design and implement a clean 3NF relational schema with foreign key constraints, cascading rules, and check constraints. Write clean SQL migration scripts and wrap in an API service with parameterized queries preventing SQL injection.",
                            "rationale": f"Fits your ~{budget}h timeline. Demonstrates relational schema design and secure SQL queries with clear, practical code.",
                            "key_tech": ["PostgreSQL", "SQL (DDL/DML)", "Python / Node.js", "psycopg / pg", "Docker"],
                            "target_deliverables": [
                                "schema.sql with normalized tables and explicit primary/foreign keys",
                                "seed_data.sql with realistic test records",
                                "test_queries.py validating data integrity and constraint enforcement"
                            ]
                        },
                        {
                            "title": "Analytical Reporting Queries & EXPLAIN Query Tuning",
                            "track": f"Core (~{h_core}h)",
                            "level": "Core Benchmark",
                            "time_estimate_hours": h_core,
                            "difficulty_tier": "core",
                            "description": "Author complex reporting queries featuring window functions (ROW_NUMBER, RANK), aggregations with GROUP BY / HAVING, and subqueries. Use EXPLAIN ANALYZE to identify sequential scans and add targeted composite B-Tree indexes.",
                            "rationale": f"Demonstrates performant SQL queries, window functions, and query plan optimization within your ~{budget}h target.",
                            "key_tech": ["PostgreSQL", "EXPLAIN ANALYZE", "Window Functions", "Docker Compose"],
                            "target_deliverables": [
                                "reporting_queries.sql with window functions and analytical aggregations",
                                "explain_analysis.md comparing execution plans before and after indexing",
                                "Benchmark script proving sub-20ms query latency on 50,000 rows"
                            ]
                        },
                        {
                            "title": "PostgreSQL Full-Text Search with tsvector & GIN Indexes",
                            "track": f"Stretch (~{h_stretch}h)",
                            "level": "Stretch Challenge",
                            "time_estimate_hours": h_stretch,
                            "difficulty_tier": "stretch",
                            "description": "Build a fast multi-attribute search feature inside PostgreSQL utilizing generated tsvector columns and GIN indexes, supporting fuzzy word ranking and highlighted search snippets.",
                            "rationale": f"A standout project (~{h_stretch}h) showing advanced PostgreSQL indexing and full-text search capabilities.",
                            "key_tech": ["PostgreSQL (tsvector, GIN, to_tsquery)", "SQL", "FastAPI / Express", "pytest"],
                            "target_deliverables": [
                                "search_schema.sql with tsvector column and GIN index",
                                "api_search.py serving ranked text search results",
                                "test_search.py verifying ranking and performance"
                            ]
                        }
                    ],
                    "recommended_deliverables": [
                        "GitHub repository with clean PostgreSQL DDL scripts, migrations, and test harness.",
                        "README detailing schema ERD diagram and query optimization rationale."
                    ]
                }
            else:
                # Senior PostgreSQL
                return {
                    "success": True,
                    "skill_name": skill_name,
                    "experience_level": experience_level,
                    "role_title": role_title,
                    "remediation_hours": remediation_hours,
                    "advisor_mode": "domain_expert_engine",
                    "interview_focus_questions": [
                        "How do PostgreSQL MVCC and table bloat affect transaction isolation levels and VACUUM scheduling?",
                        "How do you diagnose and eliminate sequential scans on multi-million row tables using EXPLAIN (ANALYZE, BUFFERS)?",
                        "What are the specific trade-offs between B-Tree, GIN, and BRIN indexes for time-series and full-text workloads?",
                        "How do you implement row-level locks (SELECT FOR UPDATE SKIP LOCKED) to build a race-condition-free transactional queue?"
                    ],
                    "hands_on_project_exercise": "Architect a high-throughput PostgreSQL database schema featuring declarative partitioning, PgBouncer connection pooling, and sub-10ms GIN full-text search.",
                    "practice_project_options": [
                        {
                            "title": "High-Throughput Connection Pooling & Analytics Partitioning Service",
                            "track": "Database Architecture & Scaling",
                            "level": "Production Grade",
                            "time_estimate_hours": 18,
                            "difficulty_tier": "core",
                            "description": "Design a high-volume PostgreSQL database architecture featuring PgBouncer connection pooling, declarative table partitioning by time, and optimized composite/GIN indexes. Includes EXPLAIN ANALYZE performance tuning benchmarks.",
                            "rationale": "Demonstrates database scalability beyond basic CRUD operations, showing deep understanding of lock contention, query planning, and high-concurrency throughput.",
                            "key_tech": ["PostgreSQL", "PgBouncer", "pg_stat_statements", "Docker Compose", "Locust"],
                            "target_deliverables": [
                                "init_db.sql with declarative partitioning schemas and GIN indexes",
                                "pgbouncer.ini and Docker Compose connection pooling topology",
                                "benchmarks/explain_analyze_report.md comparing partition performance"
                            ]
                        },
                        {
                            "title": "Transactional Outbox & Event-Driven Audit Engine with ACID Guarantees",
                            "track": "Enterprise Reliability & Distributed Patterns",
                            "level": "Core Architecture",
                            "time_estimate_hours": 22,
                            "difficulty_tier": "stretch",
                            "description": "Implement a reliable Transactional Outbox pattern in PostgreSQL with strict Serializable/Repeatable Read isolation levels, preventing double-writes and race conditions under distributed worker environments.",
                            "rationale": "Directly proves senior-level understanding of ACID guarantees, concurrency locks (SELECT FOR UPDATE SKIP LOCKED), and distributed system reliability.",
                            "key_tech": ["PostgreSQL", "Python / Node", "psycopg / pg", "Docker", "pytest"],
                            "target_deliverables": [
                                "outbox_worker.py demonstrating lock-free concurrent message consumption",
                                "test_concurrency.py asserting zero duplicate events under 50 simultaneous threads",
                                "Database migration scripts establishing audit triggers"
                            ]
                        },
                        {
                            "title": "Full-Text Search & Fuzzy Trigram Matcher with pg_trgm and tsvector",
                            "track": "Search & Query Engineering",
                            "level": "Advanced Enterprise",
                            "time_estimate_hours": 16,
                            "difficulty_tier": "stretch",
                            "description": "Build a production-grade multi-attribute search engine within PostgreSQL utilizing GIN indexes on tsvector generated columns and pg_trgm similarity matching with sub-10ms response times over 500k rows.",
                            "rationale": "Proves that you can squeeze Elasticsearch-grade search performance directly from PostgreSQL without introducing external infrastructure complexity.",
                            "key_tech": ["PostgreSQL (pg_trgm, tsvector)", "SQL / PL/pgSQL", "FastAPI / Express", "Locust"],
                            "target_deliverables": [
                                "schema_search.sql featuring tsvector columns and expression indexes",
                                "API search service with weighted term ranking (setweight)",
                                "Performance benchmark proving <10ms query latency on large datasets"
                            ]
                        }
                    ],
                    "recommended_deliverables": [
                        "GitHub repository featuring PostgreSQL schemas, migration scripts, and benchmark harness.",
                        "EXPLAIN ANALYZE benchmark documentation with query optimization walk-through."
                    ]
                }

        # =========================================================================
        # 3. Docker / Containerization / DevOps
        # =========================================================================
        if any(term in skill_lower for term in ["docker", "container", "devops", "kubernetes", "k8s"]):
            if is_entry:
                return {
                    "success": True,
                    "skill_name": skill_name,
                    "experience_level": experience_level,
                    "role_title": role_title,
                    "remediation_hours": budget,
                    "advisor_mode": "domain_expert_engine",
                    "interview_focus_questions": [
                        "What is the difference between a Docker Image and a Docker Container, and how does container isolation differ from a Virtual Machine?",
                        "What is the purpose of a .dockerignore file, and how does Docker layer caching speed up incremental builds?",
                        "How do you pass environment variables and database credentials securely into a Docker container without hardcoding them in the image?",
                        "How do Docker networks allow a web API container to communicate with a PostgreSQL container by service name?"
                    ],
                    "hands_on_project_exercise": "Construct a clean multi-container local development environment with Docker Compose connecting a web service, database, and cache.",
                    "practice_project_options": [
                        {
                            "title": "Multi-Service Local Dev Environment with Docker Compose",
                            "track": f"Foundation (~{h_foundation}h)",
                            "level": "Foundation",
                            "time_estimate_hours": h_foundation,
                            "difficulty_tier": "foundation",
                            "description": "Set up a clean Docker Compose file coordinating a web backend service (FastAPI/Express), PostgreSQL database with persistent volume mounts, and Redis cache. Configure inter-container networking and non-root execution.",
                            "rationale": f"Fits your ~{budget}h timeline. Proves container orchestration and multi-service setup needed for real-world engineering teams.",
                            "key_tech": ["Docker", "Docker Compose", "PostgreSQL", "Redis", "bash"],
                            "target_deliverables": [
                                "docker-compose.yml with named volumes and internal network",
                                ".env.example with documented configuration parameters",
                                "setup.sh script automating one-command initialization and health check"
                            ]
                        },
                        {
                            "title": "Production Multi-Stage Dockerfile with Image Size Optimization",
                            "track": f"Core (~{h_core}h)",
                            "level": "Core Benchmark",
                            "time_estimate_hours": h_core,
                            "difficulty_tier": "core",
                            "description": "Write a multi-stage Dockerfile that compiles dependencies in a builder stage and copies only the runtime artifacts into a slim Alpine/distroless image. Shrink image footprint to <100MB and run as an unprivileged user.",
                            "rationale": f"Demonstrates production-grade Docker packaging, layer optimization, and security practices within ~{budget} hours.",
                            "key_tech": ["Docker", "Alpine Linux", "Multi-stage Builds", "Security Scanning"],
                            "target_deliverables": [
                                "Dockerfile with separate builder and runner stages",
                                ".dockerignore excluding development dependencies and caches",
                                "image_size_comparison.md documenting size reduction before and after multi-stage"
                            ]
                        },
                        {
                            "title": "GitHub Actions CI Pipeline with Automated Container Builds & Tests",
                            "track": f"Stretch (~{h_stretch}h)",
                            "level": "Stretch Challenge",
                            "time_estimate_hours": h_stretch,
                            "difficulty_tier": "stretch",
                            "description": "Create a GitHub Actions CI workflow that builds your Docker image on every pull request, runs automated test suites inside the container, and performs automated container linting with Hadolint.",
                            "rationale": f"A standout project (~{h_stretch}h) showing end-to-end CI/CD automation and containerized test workflows.",
                            "key_tech": ["GitHub Actions", "Docker", "Hadolint", "Automated CI Testing"],
                            "target_deliverables": [
                                ".github/workflows/ci.yml with build and test workflow",
                                "Dockerfile passing all Hadolint rule checks",
                                "Green CI badge on GitHub repository README"
                            ]
                        }
                    ],
                    "recommended_deliverables": [
                        "GitHub repository featuring Dockerfile, docker-compose.yml, and automated CI.",
                        "README explaining container architecture, environment variables, and startup instructions."
                    ]
                }
            else:
                return {
                    "success": True,
                    "skill_name": skill_name,
                    "experience_level": experience_level,
                    "role_title": role_title,
                    "remediation_hours": remediation_hours,
                    "advisor_mode": "domain_expert_engine",
                    "interview_focus_questions": [
                        "How do Linux namespaces, cgroups, and overlayfs combine to provide process isolation in Docker?",
                        "How do you design multi-stage builds to minimize layer caching invalidation and shrink production images to under 50MB?",
                        "What security hazards exist when running containers as root, and how do you configure rootless user namespaces and read-only filesystems?",
                        "How do SIGTERM and graceful shutdown propagation work across Docker PID 1 process supervisors?"
                    ],
                    "hands_on_project_exercise": "Construct a hardened, multi-stage production Docker environment with unprivileged users, automated Trivy security vulnerability scans, and health check orchestration.",
                    "practice_project_options": [
                        {
                            "title": "Hardened Multi-Stage Production Container with Vulnerability CI Scanning",
                            "track": "DevOps & Container Security",
                            "level": "Production Grade",
                            "time_estimate_hours": 16,
                            "difficulty_tier": "core",
                            "description": "Create a distroless/alpine multi-stage Docker build running as an unprivileged non-root user, optimized to under 80MB. Integrated into GitHub Actions CI with Trivy security vulnerability scans and Hadolint linting.",
                            "rationale": "Security and image size are the top two requirements tech leads evaluate. Proves you write secure, enterprise-grade Dockerfiles, not casual 1GB single-stage images.",
                            "key_tech": ["Docker", "GitHub Actions CI", "Trivy", "Hadolint", "Alpine / Distroless"],
                            "target_deliverables": [
                                "Dockerfile with multi-stage layers and non-root USER directive",
                                ".github/workflows/docker_security.yml with automated Trivy CVE scans",
                                "Image size and security audit report in README"
                            ]
                        },
                        {
                            "title": "Resilient Multi-Service Compose Mesh with Healthchecks & Graceful Shutdown",
                            "track": "Local Development & Mesh Orchestration",
                            "level": "Core Architecture",
                            "time_estimate_hours": 20,
                            "difficulty_tier": "stretch",
                            "description": "Construct a multi-container local microservice environment in Docker Compose orchestrating an API gateway, backend service, PostgreSQL, and Redis cache with interdependent healthchecks (depends_on condition: service_healthy) and graceful SIGTERM handling.",
                            "rationale": "Shows mastery of container networking, health check dependencies, and clean teardown orchestration needed for collaborative dev environments.",
                            "key_tech": ["Docker Compose", "Redis", "PostgreSQL", "bash healthchecks", "Makefile"],
                            "target_deliverables": [
                                "docker-compose.yml with healthcheck definitions and network isolation",
                                "Graceful shutdown integration test script verifying clean exit codes",
                                "Makefile automating developer one-command setup"
                            ]
                        },
                        {
                            "title": "Production Container Observability with Cgroup Limits & Prometheus",
                            "track": "Observability & Resource Management",
                            "level": "Advanced Enterprise",
                            "time_estimate_hours": 24,
                            "difficulty_tier": "stretch",
                            "description": "Containerized application enforcing strict memory/CPU cgroup limits with automated OOM-kill recovery testing. Exports live container metrics into Prometheus and Grafana dashboards.",
                            "rationale": "Proves ability to operate, tune, and debug containers under real-world resource constraints and production observability standards.",
                            "key_tech": ["Docker", "cgroups", "Prometheus", "Grafana", "stress-ng"],
                            "target_deliverables": [
                                "docker-compose.monitoring.yml with Prometheus & cAdvisor",
                                "stress_test.sh proving container stability under CPU/memory spikes",
                                "Dashboard screenshot and resource tuning guide in README"
                            ]
                        }
                    ],
                    "recommended_deliverables": [
                        "GitHub repository with Dockerfile, docker-compose.yml, and automated CI security scanning.",
                        "Architectural README documenting image layering and container lifecycle management."
                    ]
                }

        # =========================================================================
        # 4. Universal Level-Calibrated Fallback for Any Skill
        # =========================================================================
        if is_entry:
            return {
                "success": True,
                "skill_name": skill_name,
                "experience_level": experience_level,
                "role_title": role_title,
                "remediation_hours": budget,
                "advisor_mode": "domain_expert_engine",
                "interview_focus_questions": [
                    f"What core problem does {skill_name} solve in software development, and what are its key building blocks?",
                    f"How do you organize code, configuration, and dependencies when starting a project with {skill_name}?",
                    f"What are the most common beginner pitfalls or bugs when using {skill_name}, and how do you prevent them?",
                    f"How do you write automated tests to verify that your {skill_name} implementation functions correctly?"
                ],
                "hands_on_project_exercise": f"Build a practical {skill_name} application with clean code structure, input validation, and automated unit tests.",
                "practice_project_options": [
                    {
                        "title": f"Practical {skill_name} Implementation with Modular Architecture",
                        "track": f"Foundation (~{h_foundation}h)",
                        "level": "Foundation",
                        "time_estimate_hours": h_foundation,
                        "difficulty_tier": "foundation",
                        "description": f"Build a focused, working application implementing the core features of {skill_name}. Emphasizes clean code separation, environment-based configuration, and proper error handling.",
                        "rationale": f"Fits your ~{budget}h timeline. Focuses on practical code structure that proves competency.",
                        "key_tech": [skill_name, "Modular Code", "Input Validation", "pytest / jest"],
                        "target_deliverables": [
                            f"Core {skill_name} implementation files with modular architecture",
                            "Configuration file and environment variable setup (.env.example)",
                            "Automated unit tests covering positive and negative test cases"
                        ]
                    },
                    {
                        "title": f"Robust {skill_name} Service with Automated Testing & Error Boundaries",
                        "track": f"Core (~{h_core}h)",
                        "level": "Core Benchmark",
                        "time_estimate_hours": h_core,
                        "difficulty_tier": "core",
                        "description": f"Develop an end-to-end service utilizing {skill_name} with comprehensive automated test coverage, structured logging, and graceful failure recovery.",
                        "rationale": f"Demonstrates maintainable, well-tested code and error handling within your ~{budget}h target.",
                        "key_tech": [skill_name, "Unit Testing", "Integration Testing", "Structured Logging"],
                        "target_deliverables": [
                            f"Tested {skill_name} service achieving >75% test coverage",
                            "Structured logging and error handling integration",
                            "test_suite.py validating edge cases and failure modes"
                        ]
                    },
                    {
                        "title": f"Containerized {skill_name} Service with REST API & Documentation",
                        "track": f"Stretch (~{h_stretch}h)",
                        "level": "Stretch Challenge",
                        "time_estimate_hours": h_stretch,
                        "difficulty_tier": "stretch",
                        "description": f"Package your {skill_name} project in a Docker container and expose its capabilities via documented API endpoints with interactive Swagger / OpenAPI docs.",
                        "rationale": f"A standout project (~{h_stretch}h) demonstrating container packaging, API design, and documentation.",
                        "key_tech": [skill_name, "Docker", "REST API", "OpenAPI / Swagger"],
                        "target_deliverables": [
                            "Dockerfile enabling one-command build and run",
                            "API documentation with sample request/response payloads",
                            "README detailing architecture, design decisions, and setup"
                        ]
                    }
                ],
                "recommended_deliverables": [
                    f"GitHub repository featuring clean {skill_name} code, unit tests, and README.",
                    "Documented trade-offs and design decisions demonstrating engineering thoughtfulness."
                ]
            }
        else:
            return {
                "success": True,
                "skill_name": skill_name,
                "experience_level": experience_level,
                "role_title": role_title,
                "remediation_hours": remediation_hours,
                "advisor_mode": "domain_expert_engine",
                "interview_focus_questions": [
                    f"How do you architect, benchmark, and scale {skill_name} under high concurrency in production?",
                    f"What are the critical architectural bottlenecks and failure modes when using {skill_name}?",
                    f"How do you structure comprehensive automated unit and integration tests for {skill_name}?",
                    f"What trade-offs guide your decision to adopt {skill_name} versus industry alternatives?"
                ],
                "hands_on_project_exercise": f"Build a production-grade {skill_name} system featuring clean modular architecture, automated test coverage, and documented performance benchmarks.",
                "practice_project_options": [
                    {
                        "title": f"Production-Grade {skill_name} Micro-Service with Resilient Architecture",
                        "track": "Production Systems & Reliability",
                        "level": "Production Grade",
                        "time_estimate_hours": 16,
                        "difficulty_tier": "core",
                        "description": f"Design and implement a standalone production service utilizing {skill_name}. Includes robust error boundaries, structured logging, configuration management, and full unit test coverage.",
                        "rationale": f"Hiring managers evaluate whether you understand real-world edge cases. Demonstrates clean code organization, testability, and production readiness for {skill_name}.",
                        "key_tech": [skill_name, "Docker", "Unit Tests", "CI/CD", "Structured Logging"],
                        "target_deliverables": [
                            f"Core {skill_name} service implementation with clean modular separation",
                            "Automated test suite achieving >80% branch coverage",
                            "Dockerfile and CI/CD workflow configuration"
                        ]
                    },
                    {
                        "title": f"High-Throughput {skill_name} Performance & Latency Benchmark Suite",
                        "track": "Performance & Architecture",
                        "level": "Core Architecture",
                        "time_estimate_hours": 20,
                        "difficulty_tier": "stretch",
                        "description": f"Construct an end-to-end benchmark harness measuring execution latency, throughput, and memory utilization for {skill_name}. Includes stress tests and comparative trade-off analysis.",
                        "rationale": f"Proves you can evaluate, tune, and optimize {skill_name} under load, elevating your credibility from basic practitioner to senior engineer.",
                        "key_tech": [skill_name, "Benchmark Harness", "Profiling Tools", "Docker"],
                        "target_deliverables": [
                            "benchmark.py or test runner measuring p50, p95, and p99 latency",
                            "Documentation detailing optimization decisions and profiling results",
                            "Automated regression test preventing performance regressions"
                        ]
                    },
                    {
                        "title": f"Enterprise Integration Pipeline Featuring {skill_name} & Cloud Storage",
                        "track": "Enterprise Integration & Cloud",
                        "level": "Advanced Enterprise",
                        "time_estimate_hours": 24,
                        "difficulty_tier": "stretch",
                        "description": f"Develop an end-to-end data processing or API pipeline integrating {skill_name} with persistent storage, asynchronous messaging, and audit logging.",
                        "rationale": f"Demonstrates ability to integrate {skill_name} seamlessly into broader enterprise software architectures and distributed cloud environments.",
                        "key_tech": [skill_name, "PostgreSQL / Redis", "Docker Compose", "API Gateway"],
                        "target_deliverables": [
                            f"End-to-end pipeline code connecting {skill_name} with persistent stores",
                            "Integration test suite validating data consistency and failure recovery",
                            "System architecture diagram and operational runbook in README"
                        ]
                    }
                ],
                "recommended_deliverables": [
                    f"GitHub repository featuring {skill_name} implementation, automated tests, and Docker setup.",
                    "Comprehensive README with architecture diagrams and performance benchmarks."
                ]
            }

evidence_inspector = EvidenceInspectorService()
