import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'skillbridge_backend.settings')
django.setup()

from apps.job_analysis.models import JobAnalysis, Requirement

USER_ID = "usr_demo_001"

ROLES_TO_SEED = [
    {
        "analysis_id": "job_frontend_react",
        "role_title": "Frontend React Developer",
        "mode": "job_specific",
        "days_remaining": 14,
        "study_hours_per_week": 14.0,
        "job_text": "We are looking for a Frontend Developer proficient in React, TypeScript, TailwindCSS, Next.js, and automated unit/integration testing with Vitest/Jest.",
        "summary": "Extracted 5 core requirements for Frontend React Developer posting.",
        "requirements": [
            ("React", "framework", "required", "Strong experience with React, state hooks, and component lifecycle"),
            ("TypeScript", "language", "required", "TypeScript strict typing across frontend interfaces and APIs"),
            ("TailwindCSS", "framework", "preferred", "Responsive modern UI styling with Tailwind CSS"),
            ("Next.js", "framework", "required", "Server-side rendering and static generation with Next.js"),
            ("API Testing", "testing", "required", "Unit and component testing with Vitest/Jest and Testing Library")
        ]
    },
    {
        "analysis_id": "job_cloud_devops",
        "role_title": "Cloud & DevOps Engineer",
        "mode": "job_specific",
        "days_remaining": 21,
        "study_hours_per_week": 12.0,
        "job_text": "Seeking a Cloud & DevOps Engineer with hands-on experience in AWS cloud infrastructure, Docker containerization, Kubernetes orchestration, Terraform IaC, and CI/CD pipelines.",
        "summary": "Extracted 5 core requirements for Cloud & DevOps Engineer posting.",
        "requirements": [
            ("AWS", "cloud", "required", "Hands-on AWS services management (EC2, S3, RDS, Lambda, IAM)"),
            ("Docker", "devops", "required", "Containerization and multi-container orchestration with Docker"),
            ("Kubernetes", "devops", "preferred", "Container cluster management and deployment with Kubernetes"),
            ("Terraform", "cloud", "preferred", "Infrastructure as Code provisioning using Terraform"),
            ("CI/CD", "devops", "required", "Automated deployment pipelines using GitHub Actions or GitLab CI")
        ]
    },
    {
        "analysis_id": "job_ai_ml_goal",
        "role_title": "AI & Machine Learning Engineer",
        "mode": "goal_based",
        "days_remaining": 45,
        "study_hours_per_week": 15.0,
        "job_text": "Career Goal: Transition to AI & Machine Learning Engineer specializing in Python, PyTorch, FastApi microservices, Vector Databases, RAG Architecture, and LLM orchestration.",
        "summary": "Target competencies for Goal-Based career transition into AI Engineering.",
        "requirements": [
            ("Python", "language", "required", "Advanced Python proficiency for data processing and model pipelines"),
            ("Machine Learning", "architecture", "required", "Supervised and unsupervised ML algorithms, model evaluation metrics"),
            ("PyTorch", "framework", "required", "Deep learning model building, fine-tuning, and inference with PyTorch"),
            ("Vector Databases", "database", "required", "Vector embeddings indexing, semantic search, and pgvector Cosine similarity"),
            ("RAG Architecture", "architecture", "required", "Retrieval-Augmented Generation architectures with LLMs and LangChain/LlamaIndex"),
            ("FastAPI", "framework", "preferred", "High-throughput asynchronous inference API endpoints with FastAPI")
        ]
    },
    {
        "analysis_id": "job_fullstack_goal",
        "role_title": "Full Stack Engineer Transition",
        "mode": "goal_based",
        "days_remaining": 60,
        "study_hours_per_week": 10.0,
        "job_text": "Career Goal: Comprehensive Full Stack web mastery spanning TypeScript, React frontend, Node.js backend, PostgreSQL database, and System Design.",
        "summary": "Target competencies for Goal-Based transition into Full Stack Engineering.",
        "requirements": [
            ("TypeScript", "language", "required", "Full-stack TypeScript end-to-end type safety"),
            ("React", "framework", "required", "Modern React component architecture and responsive design"),
            ("Node.js", "framework", "required", "Backend asynchronous service development with Node.js / Express"),
            ("PostgreSQL", "database", "required", "Relational database schema modeling, queries, and migrations"),
            ("REST APIs", "architecture", "required", "Robust RESTful API design, status codes, and error handling"),
            ("System Design", "architecture", "preferred", "Architectural patterns for scalable web systems")
        ]
    }
]

for role_data in ROLES_TO_SEED:
    analysis, created = JobAnalysis.objects.update_or_create(
        analysis_id=role_data["analysis_id"],
        defaults={
            "user_id": USER_ID,
            "role_title": role_data["role_title"],
            "mode": role_data["mode"],
            "days_remaining": role_data["days_remaining"],
            "study_hours_per_week": role_data["study_hours_per_week"],
            "job_text": role_data["job_text"],
            "summary": role_data["summary"],
            "status": "completed"
        }
    )
    analysis.requirements.all().delete()
    for idx, (skill, cat, imp, excerpt) in enumerate(role_data["requirements"]):
        Requirement.objects.create(
            requirement_id=f"req_{role_data['analysis_id'][:4]}_{idx+1}",
            analysis=analysis,
            skill_name=skill,
            category=cat,
            importance=imp,
            source_excerpt=excerpt,
            user_confirmed=True
        )
    print(f"Seeded {role_data['mode'].upper()} role: {role_data['role_title']} ({role_data['analysis_id']}) with {len(role_data['requirements'])} requirements")

print("Seeding complete!")
