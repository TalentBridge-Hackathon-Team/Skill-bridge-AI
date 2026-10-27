"""
SkillBridge AI - Domain Guard & Security Verification Service
Guards against:
1. Non-tech domains (e.g., healthcare, culinary, legal, trades, agriculture)
   with friendly "currently in development and will be covered in the future" messaging.
2. Suspicious, scam, malicious, and prompt-injection inputs.
3. Gibberish and spam strings.
4. Malicious or non-verifiable URLs.
"""

import re
from typing import Dict, Any, List, Optional


class DomainGuardService:
    """
    Guardrail engine ensuring SkillBridge AI remains focused on technology domains
    and protected against prompt injections, scam claims, and malicious inputs.
    """

    # Non-technical domains dictionary with friendly labels and tech-adjacent suggestions
    NON_TECH_DOMAINS = {
        "healthcare_medical": {
            "label": "Healthcare & Medicine",
            "keywords": [
                "nurse", "nursing", "doctor", "physician", "surgeon", "dentist", "dental",
                "paramedic", "pharmacist", "pharmacy", "medical assistant", "phlebotomist",
                "veterinarian", "veterinary", "physical therapist", "radiologist", "patient care",
                "clinic receptionist", "optometrist"
            ],
            "tech_alternatives": [
                "HealthTech Software Engineer",
                "Clinical Data Analyst",
                "Healthcare Systems Integration Engineer"
            ]
        },
        "culinary_hospitality": {
            "label": "Culinary & Hospitality",
            "keywords": [
                "chef", "cook", "baker", "baking", "pastry", "barista", "bartender",
                "waiter", "waitress", "restaurant manager", "culinary arts", "catering",
                "sommelier", "sous chef", "kitchen staff"
            ],
            "tech_alternatives": [
                "FoodTech Platform Developer",
                "Hospitality POS Systems Engineer",
                "Supply Chain Data Analyst"
            ]
        },
        "legal_law": {
            "label": "Legal & Judicial",
            "keywords": [
                "lawyer", "attorney", "paralegal", "judge", "notary", "legal assistant",
                "litigation", "criminal defense", "prosecutor", "bailiff", "court reporter"
            ],
            "tech_alternatives": [
                "LegalTech Software Developer",
                "Compliance & Information Security Analyst",
                "Legal NLP / AI Systems Specialist"
            ]
        },
        "construction_trades": {
            "label": "Construction & Skilled Trades",
            "keywords": [
                "carpenter", "carpentry", "plumber", "plumbing", "electrician",
                "welder", "welding", "mason", "masonry", "roofing", "hvac technician",
                "heavy machine operator", "bricklayer", "auto mechanic"
            ],
            "tech_alternatives": [
                "Smart Construction / IoT Engineer",
                "CAD / BIM Systems Specialist",
                "Industrial Robotics Programmer"
            ]
        },
        "agriculture_farming": {
            "label": "Agriculture & Farming",
            "keywords": [
                "farmer", "farming", "agronomy", "agronomist", "livestock", "ranching",
                "tractor operator", "harvesting", "crop management", "horticulture"
            ],
            "tech_alternatives": [
                "AgriTech IoT Developer",
                "Agricultural Geospatial Data Analyst",
                "Automated Farming Systems Engineer"
            ]
        },
        "beauty_cosmetology": {
            "label": "Beauty & Personal Care",
            "keywords": [
                "hair stylist", "barber", "cosmetology", "esthetician", "makeup artist",
                "nail technician", "massage therapist", "tattoo artist"
            ],
            "tech_alternatives": [
                "E-Commerce Web Developer (Beauty/Retail)",
                "Computer Vision AR Filter Developer",
                "Digital Marketing Data Analyst"
            ]
        },
        "transportation_logistics": {
            "label": "Transportation & Non-Tech Logistics",
            "keywords": [
                "truck driver", "taxi driver", "bus driver", "delivery driver",
                "forklift driver", "flight attendant", "locomotive engineer", "ship captain"
            ],
            "tech_alternatives": [
                "Autonomous Fleet Systems Engineer",
                "Logistics Route Optimization Developer",
                "Telematics Embedded Systems Engineer"
            ]
        }
    }

    # Known technology hybrid keywords (if these exist, it IS a tech role in that industry)
    TECH_INDICATORS = [
        "software", "engineer", "developer", "programmer", "coding", "data", "analyst",
        "cloud", "devops", "ai", "machine learning", "ml", "web", "frontend", "backend",
        "fullstack", "full stack", "qa", "tester", "api", "system", "database", "cybersecurity",
        "security analyst", "network engineer", "mobile app", "ios", "android", "iot",
        "robotics", "devsecops", "site reliability", "sre", "architect", "tech", "technology"
    ]

    # Suspicious prompt injection and adversarial patterns
    PROMPT_INJECTION_PATTERNS = [
        r"(?:disregard|ignore|bypass|forget)\s+(?:all\s+)?(?:previous|prior|system|above|earlier)\s+(?:instructions|rules|prompts|guidelines|constraints)",
        r"(?:you\s+are\s+now|act\s+as|roleplay\s+as|pretend\s+to\s+be)\s+(?:dan|unrestricted|unfiltered|jailbroken|an\s+evil|developer\s+mode)",
        r"(?:reveal|print|display|output|show|repeat)\s+(?:your\s+)?(?:system\s+prompt|initial\s+instructions|system\s+instructions|hidden\s+prompt)",
        r"(?:system\s+override|system\s+prompt\s+leak)",
        r"(?:developer\s+mode\s+enabled|jailbreak\s+active)",
        r"(?:mark\s+(?:all\s+)?(?:as\s+)?(?:100%|verified|demonstrated)|assign\s+(?:me\s+)?10\/10|give\s+me\s+(?:a\s+)?10\/10|ignore\s+rubric)",
        r"(?:<\|im_start\|>|<\|endoftext\|>|\[INST\]|\[SYSTEM\]|<<SYS>>)",
        r"(?:api_key|secret_key|database_url|aws_secret_access_key)\s*[:=]",
        r"drop\s+table",
        r"union\s+select",
        r"<script[\s\S]*?>[\s\S]*?<\/script>",
        r"javascript\s*:",
        r"data\s*:\s*text\/html"
    ]

    # Suspicious scam / hyperbole patterns
    SCAM_PATTERNS = [
        r"built\s+(?:all\s+of\s+)?(?:google|facebook|amazon|microsoft|apple|meta|netflix)\s+(?:alone|by\s+myself)",
        r"master(?:ed)?\s+all\s+(?:\d+\s+)?(?:programming\s+)?languages",
        r"know\s+everything\s+with\s+0\s+(?:bugs|errors|defects)",
        r"with\s+zero\s+(?:bugs|defects|errors)",
        r"hacked\s+(?:the\s+)?(?:pentagon|nasa|fbi|cia)",
        r"100%\s+guaranteed\s+mastery\s+no\s+(?:code|repo|proof)\s+needed"
    ]

    @classmethod
    def evaluate_input_safety_and_domain(cls, text: str, role_title: str = "") -> Dict[str, Any]:
        """
        Analyzes user input across domain suitability, prompt injection risks,
        scam claims, and gibberish.
        """
        if not text or not text.strip():
            return {
                "is_safe": True,
                "is_tech_domain": True,
                "status": "valid"
            }

        cleaned = text.strip()
        lower_text = f"{role_title} {cleaned}".lower()

        # 1. Check for prompt injection / security bypass attempts
        for pattern in cls.PROMPT_INJECTION_PATTERNS:
            if re.search(pattern, lower_text, re.IGNORECASE):
                return {
                    "is_safe": False,
                    "is_tech_domain": False,
                    "status": "adversarial_input_detected",
                    "error_type": "security_violation",
                    "message": (
                        "Suspicious or adversarial prompt pattern detected. "
                        "Skill Bridge AI relies on verifiable code repositories and automated audit checks. "
                        "System instructions cannot be bypassed or overridden."
                    )
                }

        # 2. Check for scam / extreme hyperbole
        for pattern in cls.SCAM_PATTERNS:
            if re.search(pattern, lower_text, re.IGNORECASE):
                return {
                    "is_safe": False,
                    "is_tech_domain": False,
                    "status": "scam_claim_detected",
                    "error_type": "unverifiable_claim",
                    "message": (
                        "Unverifiable or unrealistic portfolio claim detected. "
                        "Skill Bridge AI requires verifiable public code repositories, commits, or controlled assessments. "
                        "Please provide realistic project evidence."
                    )
                }

        # 3. Check for repetitive spam / gibberish (e.g. "asdfghjk...", "!!!!!!!", "aaaaaa")
        if cls._is_gibberish(cleaned):
            return {
                "is_safe": False,
                "is_tech_domain": False,
                "status": "gibberish_detected",
                "error_type": "invalid_input",
                "message": (
                    "Unrecognized or gibberish text detected. "
                    "Please provide a meaningful technical role title, project description, or skill requirement."
                )
            }

        # 4. Check for Non-Tech Domains
        domain_result = cls.check_domain_suitability(cleaned, role_title)
        if not domain_result["is_tech"]:
            return {
                "is_safe": True,
                "is_tech_domain": False,
                "status": "domain_in_development",
                "error_type": "unsupported_domain",
                "detected_domain": domain_result["detected_domain"],
                "message": domain_result["message"],
                "suggested_tech_roles": domain_result.get("suggested_tech_roles", [])
            }

        return {
            "is_safe": True,
            "is_tech_domain": True,
            "status": "valid"
        }

    @classmethod
    def check_domain_suitability(cls, text: str, role_title: str = "") -> Dict[str, Any]:
        """
        Determines whether the role or skill text is within supported tech domains.
        If a non-tech domain is detected, returns friendly 'still in development' status.
        """
        combined = f"{role_title} {text}".lower()
        # If it explicitly includes tech keywords (e.g. "HealthTech Developer", "Legal Data Analyst"), it IS tech!
        has_tech_keyword = any(re.search(r"\b" + re.escape(tk) + r"\b", combined) for tk in cls.TECH_INDICATORS)

        for domain_key, domain_info in cls.NON_TECH_DOMAINS.items():
            matched_keywords = [kw for kw in domain_info["keywords"] if re.search(r"\b" + re.escape(kw) + r"\b", combined)]
            if matched_keywords:
                # If there's no tech modifier, this is a pure non-tech domain!
                if not has_tech_keyword:
                    label = domain_info["label"]
                    return {
                        "is_tech": False,
                        "detected_domain": label,
                        "domain_key": domain_key,
                        "matched_terms": matched_keywords,
                        "message": (
                            f"Skill Bridge AI currently focuses specifically on technology, software engineering, "
                            f"data, and AI domains. Career tracks in {label} are still in development "
                            f"and will be covered in the future."
                        ),
                        "suggested_tech_roles": domain_info["tech_alternatives"]
                    }

        return {
            "is_tech": True,
            "message": "Technology domain verified."
        }

    @classmethod
    def validate_repository_url(cls, url: str) -> Dict[str, Any]:
        """
        Validates artifact / repository references against scams, phishing, and non-git URLs.
        """
        if not url:
            return {"is_valid": True, "is_github": False}

        u = url.strip()
        # Security: block dangerous protocols
        if u.lower().startswith(("javascript:", "data:", "vbscript:", "file:")):
            return {
                "is_valid": False,
                "reason": "Dangerous or disallowed URL protocol."
            }

        # Check for phishing/malicious executable downloads
        if re.search(r"\.(exe|bat|cmd|vbs|scr|ps1|sh)$", u, re.IGNORECASE):
            return {
                "is_valid": False,
                "reason": "Direct executable link detected. Please provide a source code repository."
            }

        # Verify valid GitHub or Git URL format
        if "github.com" in u.lower():
            pattern = r"(?:https?://)?(?:www\.)?github\.com/([a-zA-Z0-9_\-\.]+)/([a-zA-Z0-9_\-\.]+)"
            if re.search(pattern, u):
                return {"is_valid": True, "is_github": True}
            return {
                "is_valid": False,
                "reason": "Invalid GitHub repository URL format. Example: https://github.com/username/project"
            }

        # Generic web URL (e.g. live demo or certificate)
        if u.startswith(("http://", "https://")):
            return {"is_valid": True, "is_github": False}

        return {
            "is_valid": False,
            "reason": "Invalid URL. Please enter a valid https:// reference or GitHub repository link."
        }

    @staticmethod
    def _is_gibberish(text: str) -> bool:
        """
        Detects unreadable gibberish, keyboard mashing, or non-lexical spam.
        Treats 'y' as vowel-capable to prevent false positives on technical terms
        like 'asynchronous', 'synchronization', 'cryptography', and 'system'.
        """
        words = text.split()
        if not words:
            return False

        # 1. Check excessive repeated characters (e.g. "aaaaaaa", "asdfasdfasdfasdf")
        if re.search(r"(.)\1{5,}", text):
            return True

        # 2. Check for keyboard mash patterns (consonants without vowels)
        # Note: 'y' is excluded from consonants to protect technical words
        mash_count = 0
        for w in words:
            clean_word = re.sub(r"[^a-zA-Z]", "", w.lower())
            if not clean_word:
                continue
            has_consonant_mash = len(clean_word) >= 8 and bool(re.search(r"[bcdfghjklmnpqrstvwxz]{8,}", clean_word))
            has_row_walk = any(walk in clean_word for walk in ["asdfgh", "qwerty", "zxcvbn"])
            if has_consonant_mash or has_row_walk:
                mash_count += 1

        # If it's a short text (<= 4 words), any keyboard mash flags it
        if len(words) <= 4 and mash_count > 0:
            return True
        # For longer texts, only flag if an overwhelming proportion (> 40%) is keyboard mash
        if len(words) > 4 and (mash_count / len(words)) > 0.4:
            return True

        # 3. Check for purely symbol/punctuation spam string
        clean_no_space = "".join(words)
        if len(clean_no_space) >= 6 and re.match(r"^[^a-zA-Z0-9]+$", clean_no_space):
            return True

        return False


domain_guard = DomainGuardService()
