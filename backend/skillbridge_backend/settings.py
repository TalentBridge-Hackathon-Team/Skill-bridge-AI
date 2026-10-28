"""
Django settings for SkillBridge AI backend.
Adheres to Product Blueprint:
- Modular feature-based apps (Profiles, Job Analysis, Skill Matching, Assessments, Roadmap)
- CORS enabled for React frontend
- Environment-driven configuration for AWS and OpenRouter secrets
"""

import os
import sys
from pathlib import Path
from urllib.parse import urlparse, parse_qsl

BASE_DIR = Path(__file__).resolve().parent.parent

try:
    from dotenv import load_dotenv
    # Load from project root .env first, fallback to backend/.env if present
    load_dotenv(BASE_DIR.parent / '.env')
    load_dotenv(BASE_DIR / '.env')
except ImportError:
    pass

SECRET_KEY = os.getenv('SECRET_KEY')
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable is not set. Aborting startup.")

DEBUG = os.getenv('DEBUG', 'False').lower() in ('true', '1', 'yes')

raw_allowed = os.getenv('ALLOWED_HOSTS', '*')
if not raw_allowed or raw_allowed.strip() == '*':
    ALLOWED_HOSTS = ['*']
else:
    ALLOWED_HOSTS = [h.strip() for h in raw_allowed.split(',') if h.strip()]

# Automatically support Render external domains
render_host = os.getenv('RENDER_EXTERNAL_HOSTNAME')
if render_host and render_host not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(render_host)
if '.onrender.com' not in ALLOWED_HOSTS and '*' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('.onrender.com')

APPEND_SLASH = False



INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',

    'apps.profiles',
    'apps.job_analysis',
    'apps.skill_matching',
    'apps.assessments',
    'apps.roadmap',
    'apps.authentication',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'skillbridge_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'skillbridge_backend.wsgi.application'

_db_url = os.getenv("DATABASE_URL")
if not _db_url:
    raise RuntimeError("DATABASE_URL environment variable is not set. Aborting startup.")

tmpPostgres = urlparse(_db_url)
_db_options = dict(parse_qsl(tmpPostgres.query))
_db_options.setdefault('connect_timeout', 10)

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': tmpPostgres.path.replace('/', ''),
        'USER': tmpPostgres.username,
        'PASSWORD': tmpPostgres.password,
        'HOST': tmpPostgres.hostname,
        'PORT': tmpPostgres.port or 5432,
        'OPTIONS': _db_options,
        'CONN_MAX_AGE': 600,
        'CONN_HEALTH_CHECKS': True,
    }
}

NEON_REALTIME_SQL_API_URL = os.getenv('Realtime_SQL_API_endpoint_URL', '')

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'EXCEPTION_HANDLER': 'skillbridge_backend.exceptions.custom_exception_handler',
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ]
}

from datetime import timedelta

SIMPLE_JWT = {
    # Access token valid for 60 minutes — short-lived for security
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    # Refresh token valid for 7 days — user stays logged in without re-entering password
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    # Issue a new refresh token on every refresh call (sliding window)
    'ROTATE_REFRESH_TOKENS': True,
    # Blacklist old refresh tokens after rotation (requires simplejwt blacklist app)
    'BLACKLIST_AFTER_ROTATION': True,
    # Token type claim name in the JWT payload
    'AUTH_HEADER_TYPES': ('Bearer',),
    # Include user_id in token so views can look up the user without a DB call
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

CORS_ALLOW_ALL_ORIGINS = DEBUG  # open only in local dev; production uses the explicit list below
CORS_ALLOWED_ORIGINS = [o.strip() for o in os.getenv('CORS_ALLOWED_ORIGINS', '').split(',') if o.strip()]
raw_csrf = os.getenv('CSRF_TRUSTED_ORIGINS', os.getenv('CORS_ALLOWED_ORIGINS', ''))
CSRF_TRUSTED_ORIGINS = [o.strip() for o in raw_csrf.split(',') if o.strip()]
if 'https://*.onrender.com' not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS.append('https://*.onrender.com')
if render_host:
    render_origin = f"https://{render_host}"
    if render_origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(render_origin)
CORS_ALLOW_CREDENTIALS = True

# Production reverse-proxy & SSL headers
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    if os.getenv('SECURE_SSL_REDIRECT', 'False').lower() in ('true', '1', 'yes'):
        SECURE_SSL_REDIRECT = True
    if os.getenv('ENABLE_HSTS', 'False').lower() in ('true', '1', 'yes'):
        SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '31536000'))
        SECURE_HSTS_INCLUDE_SUBDOMAINS = True
        SECURE_HSTS_PRELOAD = True

AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID', 'test')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY', 'test')
_raw_endpoint = os.getenv('AWS_ENDPOINT_URL', '').strip()
AWS_ENDPOINT_URL = _raw_endpoint if _raw_endpoint else ('http://localhost:4566' if DEBUG else None)
AWS_S3_BUCKET_NAME = os.getenv('AWS_S3_BUCKET_NAME', 'skillbridge-resumes')
AWS_SQS_RESUME_QUEUE_URL = os.getenv('AWS_SQS_RESUME_QUEUE_URL', '') or (
    'http://localhost:4566/000000000000/skillbridge-resume-processing' if DEBUG else ''
)

# OpenRouter LLM & Embeddings Configuration
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY', '')
OPENROUTER_BASE_URL = os.getenv('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')
OPENROUTER_TEXT_MODEL = os.getenv('OPENROUTER_TEXT_MODEL', 'cohere/north-mini-code:free')
OPENROUTER_EMBED_MODEL = os.getenv('OPENROUTER_EMBED_MODEL', 'nvidia/nemotron-3-embed-1b:free')
OPENROUTER_INSPECTION_MODEL = os.getenv('OPENROUTER_INSPECTION_MODEL', 'poolside/laguna-s-2.1:free')
OPENROUTER_INSPECTION_FALLBACK_MODELS = os.getenv(
    'OPENROUTER_INSPECTION_FALLBACK_MODELS',
    'cohere/north-mini-code:free,recursive/flint-v1.0:free,nvidia/nemotron-3.5-lightning:free'
)
OPENROUTER_SITE_URL = os.getenv('OPENROUTER_SITE_URL', 'http://localhost:8000')
OPENROUTER_SITE_NAME = os.getenv('OPENROUTER_SITE_NAME', 'skillbridge')

# GitHub API Integration for Member 3 Evidence Inspection
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN', '')

# Google Gemini API Integration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-3-flash-preview')




