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
        raw_model = getattr(
            settings, "GEMINI_MODEL", os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
        )
        self.model = raw_model.strip('"\'') if raw_model else "gemini-3-flash-preview"
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
            "gemini-3.5-flash-lite",
            "gemini-3.1-flash-lite",
            "gemini-flash-lite-latest",
            "gemini-3.6-flash",
            "gemini-3.5-flash",
            self.model or "gemini-3.5-flash-lite",
            "gemma-4-26b-a4b-it",
            "gemini-3-flash-preview",
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
                payload["systemInstruction"] = {
                    "parts": [{"text": system_prompt}]
                }

            try:
                response = requests.post(
                    url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=25
                )
                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and "text" in parts[0]:
                            import re
                            text_out = parts[0]["text"].strip()
                            # 1. Strip think/thought tags
                            text_out = re.sub(r'<(?:think|thought)>.*?</(?:think|thought)>', '', text_out, flags=re.DOTALL).strip()
                            # 2. Strip thinking process prefixes
                            text_out = re.sub(r'(?i)(?:thinking process|thought process|chain of thought):.*?\n\n', '', text_out, flags=re.DOTALL).strip()
                            # 3. Strip planning monologue headers if emitted by reasoning-capable models
                            lines = text_out.split('\n')
                            meta_starters = (
                                "plan:", "planning:", "thought:", "the user is asking", "the user wants", "the user said",
                                "in this response", "we need to", "we must", "let's outline", "outline:", "let's plan"
                            )
                            if lines and any(lines[0].strip().lower().startswith(p) for p in meta_starters):
                                first_real_idx = 0
                                in_meta = True
                                for idx, line in enumerate(lines):
                                    l = line.strip().lower()
                                    if not l:
                                        continue
                                    if in_meta:
                                        if any(l.startswith(p) for p in meta_starters) or (l.startswith(('1.', '2.', '3.', '4.', '5.', '-', '*')) and idx < 6):
                                            continue
                                        else:
                                            in_meta = False
                                            first_real_idx = idx
                                            break
                                if not in_meta and first_real_idx > 0:
                                    text_out = '\n'.join(lines[first_real_idx:]).strip()

                            if text_out:
                                return {
                                    "success": True,
                                    "text": text_out,
                                    "model": f"google/{cand_model}"
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

    def extract_job_text_from_image(self, image_bytes: bytes, mime_type: str = "image/png") -> str:
        """
        Multimodal vision extraction: uses Google Gemini to transcribe and extract text from a job posting screenshot.
        """
        if not self.is_configured() or not image_bytes:
            return ""

        import base64
        b64_data = base64.b64encode(image_bytes).decode("utf-8")

        prompt = (
            "You are an expert OCR and technical recruitment assistant. "
            "Transcribe all text from this job posting screenshot completely and accurately. "
            "Be sure to capture: job title, company name, overview, responsibilities, required skills, "
            "programming languages, frameworks, databases, cloud tools, qualifications, and any requirements."
        )

        candidate_models = [
            "gemini-3.5-flash-lite",
            "gemini-3.1-flash-lite",
            "gemini-flash-lite-latest",
            "gemini-3.6-flash",
            "gemini-3.5-flash",
            self.model or "gemini-3.5-flash-lite",
            "gemini-3-flash-preview",
        ]
        seen = set()
        models_to_try = [m for m in candidate_models if m and not (m in seen or seen.add(m))]

        for cand_model in models_to_try:
            url = f"{self.base_url}/{cand_model}:generateContent?key={self.api_key}"
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {
                                "inlineData": {
                                    "mimeType": mime_type,
                                    "data": b64_data
                                }
                            },
                            {
                                "text": prompt
                            }
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 2048
                }
            }

            try:
                response = requests.post(
                    url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=30
                )
                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and "text" in parts[0]:
                            text_out = parts[0]["text"].strip()
                            if text_out:
                                logger.info(f"Successfully extracted {len(text_out)} chars from job screenshot via {cand_model}")
                                return text_out
                else:
                    logger.warning(f"Gemini vision {cand_model} returned {response.status_code}: {response.text[:150]}")
            except Exception as e:
                logger.warning(f"Error calling Gemini vision {cand_model}: {e}")

        return ""


gemini_service = GeminiService()
