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
        assert service.text_model == "google/gemma-4-26b-a4b-it:free"
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
