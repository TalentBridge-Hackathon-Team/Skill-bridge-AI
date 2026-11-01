"""
Tests for OpenRouter LLM and Embeddings Service Integration
"""

import json
import pytest
from unittest.mock import patch, MagicMock
from services.openrouter_service import OpenRouterService, openrouter_service
from services.rag_multimodal_service import RAGMultimodalService


@pytest.mark.django_db
class TestOpenRouterService:
    def test_openrouter_configuration(self):
        """Verify models and endpoints match requested configuration."""
        service = OpenRouterService()
        assert "google/gemma-4-26b-a4b-it:free" in service.text_model or "google/gemma" in service.text_model
        assert service.embed_model == "nvidia/nemotron-3-embed-1b:free"
        assert "openrouter.ai" in service.base_url

    def test_extract_job_requirements_fallback(self):
        """Verify deterministic requirement extraction works reliably."""
        service = OpenRouterService()
        job_text = "Looking for a backend engineer proficient in Python and Django REST Framework with PostgreSQL."
        result = service.extract_job_requirements(job_text)

        assert "role_title" in result
        assert "requirements" in result
        skills = [r["skill_name"] for r in result["requirements"]]
        assert "Python" in skills
        assert "Django REST Framework" in skills
        assert "PostgreSQL" in skills

    def test_extract_job_requirements_llm_success(self):
        """Verify LLM output parsing when OpenRouter returns valid JSON."""
        service = OpenRouterService()
        mock_response = {
            "role_title": "Senior Python Engineer",
            "summary": "Extracted via OpenRouter Gemma",
            "requirements": [
                {"skill_name": "Python", "category": "language", "importance": "required", "source_excerpt": "Python 3"},
                {"skill_name": "Docker", "category": "devops", "importance": "preferred", "source_excerpt": "Docker containers"}
            ]
        }

        with patch.object(service, "generate_text", return_value={"success": True, "text": json.dumps(mock_response)}):
            result = service.extract_job_requirements("Sample job")
            assert result["role_title"] == "Senior Python Engineer"
            assert len(result["requirements"]) == 2

    def test_generate_embeddings_fallback(self):
        """Verify embeddings generation returns valid vector length."""
        service = OpenRouterService()
        with patch.object(service, "_get_headers", return_value={}):
            embeddings = service.generate_embeddings("Python backend resume")
            assert isinstance(embeddings, list)
            assert len(embeddings) > 0

    def test_rag_multimodal_service_embeddings(self):
        """Verify RAGMultimodalService delegates embeddings to OpenRouter."""
        rag = RAGMultimodalService()
        vector = rag.generate_resume_embeddings("Test resume text")
        assert isinstance(vector, list)
        assert len(vector) > 0

    def test_is_valid_role_title_rejects_generic_headers(self):
        """Verify generic headers like 'Role Overview' and 'About the Role' are rejected."""
        from services.openrouter_service import is_valid_role_title
        assert is_valid_role_title("Role Overview") is False
        assert is_valid_role_title("Job Overview") is False
        assert is_valid_role_title("About the Role") is False
        assert is_valid_role_title("Job Description") is False
        assert is_valid_role_title("Overview") is False
        assert is_valid_role_title("Summary") is False
        assert is_valid_role_title("Role Overview: ") is False
        assert is_valid_role_title("Responsibilities") is False
        assert is_valid_role_title("Software Engineer") is False
        assert is_valid_role_title("Platform Engineer") is True
        assert is_valid_role_title("Senior Cloud Architect") is True
        assert is_valid_role_title("Data Analyst") is True

    def test_extract_role_title_ignores_role_overview(self):
        """Verify _extract_role_title bypasses 'Role Overview' and extracts real target role."""
        from services.openrouter_service import _extract_role_title
        jd_text = (
            "Role Overview\n"
            "We are looking for a Platform Engineer to join our infrastructure team.\n"
            "You will be responsible for Kubernetes, Terraform, and CI/CD automation."
        )
        extracted = _extract_role_title(jd_text)
        assert extracted == "Platform Engineer"

    def test_extract_role_title_from_prefixed_header(self):
        """Verify 'Role Overview: Senior Platform Engineer' extracts 'Senior Platform Engineer'."""
        from services.openrouter_service import _extract_role_title
        jd_text = (
            "Role Overview: Senior Platform Engineer\n"
            "Responsibilities: Maintain cloud infrastructure on AWS and Kubernetes."
        )
        extracted = _extract_role_title(jd_text)
        assert "Platform Engineer" in extracted

    def test_extract_job_requirements_rejects_role_overview_from_llm(self):
        """Verify LLM returning 'Role Overview' is intercepted and corrected to the real title."""
        service = OpenRouterService()
        mock_response = {
            "role_title": "Role Overview",
            "summary": "Extracted via OpenRouter",
            "requirements": [
                {"skill_name": "Kubernetes", "category": "cloud", "importance": "required", "source_excerpt": "K8s"},
                {"skill_name": "Terraform", "category": "devops", "importance": "required", "source_excerpt": "IaC"}
            ]
        }
        jd_text = (
            "Role Overview\n"
            "We are seeking a Platform Engineer to automate cloud infrastructure using Kubernetes and Terraform."
        )
        with patch.object(service, "generate_text", return_value={"success": True, "text": json.dumps(mock_response)}):
            result = service.extract_job_requirements(jd_text)
            assert result["role_title"] != "Role Overview"
            assert result["role_title"] == "Platform Engineer"

