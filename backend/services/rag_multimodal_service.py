"""
RAG & Multimodal AI Service Scaffold
Integrated with OpenRouter models:
1. Resume/CV text parsing and embedding generation using OPENROUTER_EMBED_MODEL (nvidia/nemotron-3-embed-1b:free).
2. Multimodal job posting screenshot extraction scaffold.
"""

import logging
from typing import List
from .openrouter_service import openrouter_service

logger = logging.getLogger(__name__)


class RAGMultimodalService:
    """Service for RAG embeddings and vision extraction."""

    def __init__(self):
        self.openrouter = openrouter_service

    def extract_text_from_job_image(self, image_file) -> str:
        """
        Multimodal extraction: Processes image/screenshot bytes using Google Gemini Vision.
        """
        if not image_file:
            return ""
        logger.info(f"Multimodal image extraction requested for {getattr(image_file, 'name', 'screenshot')}")
        try:
            from .gemini_service import gemini_service
            image_bytes = image_file.read() if hasattr(image_file, 'read') else bytes(image_file)
            if hasattr(image_file, 'seek'):
                image_file.seek(0)
            mime_type = getattr(image_file, 'content_type', 'image/png')
            text = gemini_service.extract_job_text_from_image(image_bytes=image_bytes, mime_type=mime_type)
            if text:
                return text
        except Exception as e:
            logger.warning(f"Vision extraction failed in RAGMultimodalService: {e}")
        return ""

    def generate_resume_embeddings(self, resume_text: str) -> List[float]:
        """
        RAG / Embeddings: Vectorizes resume text using OpenRouter embed model.
        """
        logger.info(f"Generating embeddings for {len(resume_text)} characters using OpenRouter.")
        return self.openrouter.generate_embeddings(resume_text)

    def search_similar_skills(self, query_text: str, profile_id: str = None, limit: int = 5):
        """
        Vector Search Scaffold:
        Performs semantic similarity search over SkillEvidence records using
        pgvector Cosine Distance (<=>) in Neon PostgreSQL.
        """
        from django.db import connection
        from apps.profiles.models import SkillEvidence

        query_vector = self.generate_resume_embeddings(query_text)
        qs = SkillEvidence.objects.filter(embedding__isnull=False)

        if profile_id:
            qs = qs.filter(profile_id=profile_id)

        from pgvector.django import CosineDistance
        return qs.annotate(distance=CosineDistance('embedding', query_vector)).order_by('distance')[:limit]
