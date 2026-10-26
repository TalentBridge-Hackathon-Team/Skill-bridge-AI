"""
Google Gemini API Integration Service
Provides fast, direct integration with Google Gemini 3.1 Flash Lite API:
- Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
- Supports system_instruction, multi-turn conversation contents, and generationConfig.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class GeminiService:
    """Service for direct Google Gemini API generation."""

    def __init__(self):
        self.api_key = getattr(
            settings, "GEMINI_API_KEY", os.getenv("GEMINI_API_KEY", "")
        )
        self.model = getattr(
            settings, "GEMINI_MODEL", os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
        )
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"

    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    def generate_text(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 2500,
        conversation_messages: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """
        Invokes Gemini API with model cascading.
        """
        if not self.is_configured():
            return {
                "success": False,
                "error": "Gemini API key not configured",
                "text": ""
            }

        # Build contents array
        contents = []
        if conversation_messages:
            for msg in conversation_messages:
                role = "user" if msg.get("role") == "user" or msg.get("sender") == "learner" else "model"
                text = msg.get("content") or msg.get("text", "")
                if text and text.strip():
                    contents.append({
                        "role": role,
                        "parts": [{"text": text.strip()}]
                    })
            # Ensure latest user prompt is appended
            if prompt and (not contents or contents[-1].get("parts", [{}])[0].get("text") != prompt):
                contents.append({
                    "role": "user",
                    "parts": [{"text": prompt}]
                })
        else:
            contents.append({
                "role": "user",
                "parts": [{"text": prompt}]
            })

        # Ensure alternating user/model roles if required by API
        normalized_contents = []
        for c in contents:
            if not normalized_contents or normalized_contents[-1]["role"] != c["role"]:
                normalized_contents.append(c)
            else:
                # Merge consecutive parts of same role
                normalized_contents[-1]["parts"].extend(c["parts"])

        candidate_models = [
            self.model or "gemini-3-flash-preview",
            "gemini-3-flash-preview",
            "gemini-3.5-flash",
            "gemini-3.1-flash-lite",
            "gemini-flash-lite-latest"
        ]
        seen = set()
        models_to_try = [m for m in candidate_models if m and not (m in seen or seen.add(m))]

        last_error = "All Gemini models failed"

        for cand_model in models_to_try:
            url = f"{self.base_url}/{cand_model}:generateContent?key={self.api_key}"
            payload: Dict[str, Any] = {
                "contents": normalized_contents,
                "generationConfig": {
                    "temperature": temperature,
                    "maxOutputTokens": max_tokens
                }
            }
            if system_prompt:
                payload["system_instruction"] = {
                    "parts": [{"text": system_prompt}]
                }

            try:
                response = requests.post(
                    url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=20
                )
                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and "text" in parts[0]:
                            text_out = parts[0]["text"].strip()
                            if text_out:
                                return {
                                    "success": True,
                                    "text": text_out,
                                    "model": cand_model
                                }
                else:
                    last_error = f"HTTP {response.status_code}: {response.text[:150]}"
                    logger.warning(f"Gemini model {cand_model} returned {response.status_code}: {response.text[:150]}")
            except Exception as e:
                last_error = str(e)
                logger.warning(f"Error calling Gemini model {cand_model}: {e}")

        return {
            "success": False,
            "error": last_error,
            "text": ""
        }


gemini_service = GeminiService()
