"""
SkillBridge AI — Predefined Skill Profiles
Used by Mode B (Goal-Based) to map career goals to structured skill requirements.

Supported profiles (expand freely — goal mapper auto-discovers them):
  prof_junior_backend       Junior Backend Developer
  prof_frontend_developer   Frontend / UI Developer
  prof_fullstack_developer  Full-Stack Developer
  prof_data_analyst         Data Analyst
  prof_ml_engineer          Machine Learning / AI Engineer
  prof_devops_engineer      DevOps / Cloud Engineer
  prof_mobile_developer     Mobile Developer (iOS / Android / Cross-Platform)
  prof_cybersecurity        Cybersecurity Analyst / Penetration Tester
"""

from typing import Any, Dict, List

SKILL_PROFILES: Dict[str, Dict[str, Any]] = {

    # ── 1. Junior Backend Developer ──────────────────────────────────────────
    "prof_junior_backend": {
        "profile_id": "prof_junior_backend",
        "role_title": "Junior Backend Developer",
        "description": (
            "Entry-level backend engineering role targeting Python/Django REST "
            "API development, relational database management, and basic DevOps."
        ),
        "keywords": [
            "backend", "back-end", "back end", "python", "django",
            "rest api", "api developer", "junior developer", "junior engineer",
            "backend internship", "server side", "server-side",
            "junior backend", "backend developer", "api engineer",
        ],
        "requirements": [
            {"skill_name": "Python", "category": "language", "importance": "required",
             "source_excerpt": "Core language for all backend services, scripting, and tooling."},
            {"skill_name": "Django REST Framework", "category": "framework", "importance": "required",
             "source_excerpt": "Standard framework for building RESTful APIs in Python."},
            {"skill_name": "PostgreSQL", "category": "database", "importance": "required",
             "source_excerpt": "Relational database management including schema design and indexing."},
            {"skill_name": "SQL", "category": "database", "importance": "required",
             "source_excerpt": "Writing queries including JOINs, aggregations, and sub-queries."},
            {"skill_name": "RESTful API Design", "category": "concepts", "importance": "required",
             "source_excerpt": "HTTP verbs, status codes, resource naming, and error handling."},
            {"skill_name": "API Testing", "category": "testing", "importance": "required",
             "source_excerpt": "Unit and integration tests for REST endpoints using pytest."},
            {"skill_name": "Git", "category": "tools", "importance": "required",
             "source_excerpt": "Version control with Git and collaborative PR workflows."},
            {"skill_name": "Docker", "category": "devops", "importance": "preferred",
             "source_excerpt": "Containerising applications for consistent environments."},
        ],
    },

    # ── 2. Frontend Developer ────────────────────────────────────────────────
    "prof_frontend_developer": {
        "profile_id": "prof_frontend_developer",
        "role_title": "Frontend Developer",
        "description": (
            "UI-focused developer role targeting React/TypeScript SPA development, "
            "responsive design, accessibility, and frontend testing."
        ),
        "keywords": [
            "frontend", "front-end", "front end", "react", "vue", "angular",
            "ui developer", "ux developer", "javascript developer", "typescript",
            "web developer", "frontend engineer", "ui engineer", "react developer",
            "next.js", "css", "html", "tailwind", "component library",
        ],
        "requirements": [
            {"skill_name": "React", "category": "framework", "importance": "required",
             "source_excerpt": "Building component-based SPAs with React hooks and context."},
            {"skill_name": "TypeScript", "category": "language", "importance": "required",
             "source_excerpt": "Strongly-typed JavaScript for maintainable frontend codebases."},
            {"skill_name": "JavaScript", "category": "language", "importance": "required",
             "source_excerpt": "Core scripting language for all web interactivity."},
            {"skill_name": "HTML/CSS", "category": "language", "importance": "required",
             "source_excerpt": "Semantic HTML and responsive CSS layouts."},
            {"skill_name": "Tailwind CSS", "category": "framework", "importance": "preferred",
             "source_excerpt": "Utility-first CSS framework for rapid UI development."},
            {"skill_name": "REST API Integration", "category": "concepts", "importance": "required",
             "source_excerpt": "Consuming REST APIs with fetch/axios and handling async state."},
            {"skill_name": "Jest", "category": "testing", "importance": "required",
             "source_excerpt": "Unit and component testing with Jest and Testing Library."},
            {"skill_name": "Git", "category": "tools", "importance": "required",
             "source_excerpt": "Version control and collaborative PR workflows."},
            {"skill_name": "Figma", "category": "tools", "importance": "preferred",
             "source_excerpt": "Reading and implementing designs from Figma prototypes."},
        ],
    },

    # ── 3. Full-Stack Developer ──────────────────────────────────────────────
    "prof_fullstack_developer": {
        "profile_id": "prof_fullstack_developer",
        "role_title": "Full-Stack Developer",
        "description": (
            "End-to-end developer comfortable with both frontend (React/TypeScript) "
            "and backend (Node.js or Python) development, databases, and deployment."
        ),
        "keywords": [
            "full stack", "fullstack", "full-stack", "mern", "mean", "mevn",
            "frontend and backend", "end to end", "end-to-end",
            "full stack developer", "full stack engineer", "full stack internship",
        ],
        "requirements": [
            {"skill_name": "React", "category": "framework", "importance": "required",
             "source_excerpt": "Frontend SPA development with React."},
            {"skill_name": "TypeScript", "category": "language", "importance": "required",
             "source_excerpt": "Type-safe JavaScript across the full stack."},
            {"skill_name": "Node.js", "category": "framework", "importance": "required",
             "source_excerpt": "Server-side JavaScript runtime for APIs."},
            {"skill_name": "Express.js", "category": "framework", "importance": "required",
             "source_excerpt": "Minimal Node.js web framework for REST APIs."},
            {"skill_name": "PostgreSQL", "category": "database", "importance": "required",
             "source_excerpt": "Relational database for persistent data storage."},
            {"skill_name": "MongoDB", "category": "database", "importance": "preferred",
             "source_excerpt": "NoSQL document database for flexible schemas."},
            {"skill_name": "RESTful API Design", "category": "concepts", "importance": "required",
             "source_excerpt": "Designing and consuming RESTful endpoints."},
            {"skill_name": "Git", "category": "tools", "importance": "required",
             "source_excerpt": "Version control for collaborative development."},
            {"skill_name": "Docker", "category": "devops", "importance": "preferred",
             "source_excerpt": "Containerising the full application stack."},
        ],
    },

    # ── 4. Data Analyst ──────────────────────────────────────────────────────
    "prof_data_analyst": {
        "profile_id": "prof_data_analyst",
        "role_title": "Data Analyst",
        "description": (
            "Analytics role focused on SQL querying, Python/Pandas data wrangling, "
            "BI dashboarding, and communicating insights to stakeholders."
        ),
        "keywords": [
            "data analyst", "data analysis", "business analyst", "bi analyst",
            "analytics", "reporting", "data insights", "power bi", "tableau",
            "excel", "spreadsheet", "data visuali", "sql analyst",
            "junior analyst", "data analyst intern",
        ],
        "requirements": [
            {"skill_name": "SQL", "category": "database", "importance": "required",
             "source_excerpt": "Writing complex queries for data extraction and reporting."},
            {"skill_name": "Python", "category": "language", "importance": "required",
             "source_excerpt": "Data manipulation and analysis with Python."},
            {"skill_name": "Pandas", "category": "framework", "importance": "required",
             "source_excerpt": "Data wrangling, cleaning, and transformation."},
            {"skill_name": "Data Visualization", "category": "concepts", "importance": "required",
             "source_excerpt": "Creating charts, dashboards, and visual reports."},
            {"skill_name": "Power BI", "category": "tools", "importance": "preferred",
             "source_excerpt": "Building interactive dashboards in Power BI."},
            {"skill_name": "Tableau", "category": "tools", "importance": "preferred",
             "source_excerpt": "Data visualization and dashboard creation in Tableau."},
            {"skill_name": "PostgreSQL", "category": "database", "importance": "required",
             "source_excerpt": "Querying and analyzing data stored in PostgreSQL."},
            {"skill_name": "Data Analysis", "category": "concepts", "importance": "required",
             "source_excerpt": "Exploratory data analysis and statistical reasoning."},
            {"skill_name": "Excel / Google Sheets", "category": "tools", "importance": "required",
             "source_excerpt": "Spreadsheet-based analysis and reporting."},
        ],
    },

    # ── 5. Machine Learning / AI Engineer ────────────────────────────────────
    "prof_ml_engineer": {
        "profile_id": "prof_ml_engineer",
        "role_title": "Machine Learning Engineer",
        "description": (
            "AI/ML focused engineering role covering model training, evaluation, "
            "deployment, LLM integration, and MLOps practices."
        ),
        "keywords": [
            "machine learning", "ml engineer", "ai engineer", "deep learning",
            "data scientist", "nlp", "computer vision", "llm", "generative ai",
            "pytorch", "tensorflow", "scikit", "model training", "mlops",
            "ai developer", "artificial intelligence", "neural network",
            "langchain", "rag", "vector", "embedding",
        ],
        "requirements": [
            {"skill_name": "Python", "category": "language", "importance": "required",
             "source_excerpt": "Primary language for ML model development and pipelines."},
            {"skill_name": "Machine Learning", "category": "concepts", "importance": "required",
             "source_excerpt": "Supervised/unsupervised learning, model evaluation and tuning."},
            {"skill_name": "PyTorch", "category": "framework", "importance": "required",
             "source_excerpt": "Deep learning model development and training."},
            {"skill_name": "Scikit-learn", "category": "framework", "importance": "required",
             "source_excerpt": "Classical ML algorithms and pipelines."},
            {"skill_name": "Pandas", "category": "framework", "importance": "required",
             "source_excerpt": "Data manipulation and feature engineering."},
            {"skill_name": "NumPy", "category": "framework", "importance": "required",
             "source_excerpt": "Numerical computing for ML operations."},
            {"skill_name": "LLM / GenAI", "category": "concepts", "importance": "preferred",
             "source_excerpt": "Working with large language models and generative AI APIs."},
            {"skill_name": "SQL", "category": "database", "importance": "required",
             "source_excerpt": "Querying datasets for analysis and feature extraction."},
            {"skill_name": "Docker", "category": "devops", "importance": "preferred",
             "source_excerpt": "Containerising ML services for reproducible deployments."},
            {"skill_name": "Git", "category": "tools", "importance": "required",
             "source_excerpt": "Version control for experiments and model code."},
        ],
    },

    # ── 6. DevOps / Cloud Engineer ───────────────────────────────────────────
    "prof_devops_engineer": {
        "profile_id": "prof_devops_engineer",
        "role_title": "DevOps / Cloud Engineer",
        "description": (
            "Infrastructure and automation role covering CI/CD pipelines, "
            "containerisation, cloud platforms (AWS/Azure/GCP), and IaC."
        ),
        "keywords": [
            "devops", "cloud engineer", "site reliability", "sre", "infrastructure",
            "platform engineer", "cicd", "ci/cd", "kubernetes", "terraform",
            "aws engineer", "azure engineer", "cloud architect", "devsecops",
            "linux administrator", "systems engineer", "cloud internship",
        ],
        "requirements": [
            {"skill_name": "Docker", "category": "devops", "importance": "required",
             "source_excerpt": "Containerisation and image management."},
            {"skill_name": "Kubernetes", "category": "devops", "importance": "required",
             "source_excerpt": "Container orchestration and cluster management."},
            {"skill_name": "CI/CD", "category": "devops", "importance": "required",
             "source_excerpt": "Building automated build, test, and deploy pipelines."},
            {"skill_name": "AWS", "category": "devops", "importance": "required",
             "source_excerpt": "Cloud infrastructure on AWS (EC2, S3, Lambda, etc.)."},
            {"skill_name": "Terraform", "category": "devops", "importance": "required",
             "source_excerpt": "Infrastructure as Code with Terraform."},
            {"skill_name": "Linux", "category": "tools", "importance": "required",
             "source_excerpt": "Linux server administration and scripting."},
            {"skill_name": "Bash/Shell", "category": "tools", "importance": "required",
             "source_excerpt": "Shell scripting for automation tasks."},
            {"skill_name": "Git", "category": "tools", "importance": "required",
             "source_excerpt": "Version control and GitOps workflows."},
            {"skill_name": "Nginx", "category": "devops", "importance": "preferred",
             "source_excerpt": "Web server configuration and reverse proxying."},
        ],
    },

    # ── 7. Mobile Developer ──────────────────────────────────────────────────
    "prof_mobile_developer": {
        "profile_id": "prof_mobile_developer",
        "role_title": "Mobile Developer",
        "description": (
            "Mobile app developer comfortable with cross-platform (React Native / Flutter) "
            "or native (iOS Swift / Android Kotlin) development."
        ),
        "keywords": [
            "mobile developer", "mobile engineer", "ios developer", "android developer",
            "react native", "flutter", "swift developer", "kotlin developer",
            "mobile app", "app developer", "cross platform", "cross-platform",
            "swiftui", "jetpack compose", "mobile internship",
        ],
        "requirements": [
            {"skill_name": "React Native", "category": "framework", "importance": "required",
             "source_excerpt": "Cross-platform mobile app development with React Native."},
            {"skill_name": "JavaScript", "category": "language", "importance": "required",
             "source_excerpt": "Core language for React Native development."},
            {"skill_name": "TypeScript", "category": "language", "importance": "preferred",
             "source_excerpt": "Type-safe JavaScript for mobile codebases."},
            {"skill_name": "iOS / Xcode", "category": "tools", "importance": "preferred",
             "source_excerpt": "iOS app building and submission via Xcode."},
            {"skill_name": "Android SDK", "category": "framework", "importance": "preferred",
             "source_excerpt": "Android app development with the Android SDK."},
            {"skill_name": "REST API Integration", "category": "concepts", "importance": "required",
             "source_excerpt": "Consuming REST APIs from mobile applications."},
            {"skill_name": "Git", "category": "tools", "importance": "required",
             "source_excerpt": "Version control and collaborative workflows."},
            {"skill_name": "Firebase", "category": "database", "importance": "preferred",
             "source_excerpt": "Real-time data, auth, and notifications via Firebase."},
        ],
    },

    # ── 8. Cybersecurity Analyst ─────────────────────────────────────────────
    "prof_cybersecurity": {
        "profile_id": "prof_cybersecurity",
        "role_title": "Cybersecurity Analyst",
        "description": (
            "Security-focused role covering vulnerability assessment, penetration testing, "
            "SIEM operations, and security incident response."
        ),
        "keywords": [
            "cybersecurity", "cyber security", "security analyst", "penetration test",
            "pen test", "ethical hack", "soc analyst", "information security",
            "infosec", "siem", "vulnerability", "security engineer",
            "network security", "cloud security", "security intern",
        ],
        "requirements": [
            {"skill_name": "Penetration Testing", "category": "testing", "importance": "required",
             "source_excerpt": "Identifying and exploiting vulnerabilities in systems."},
            {"skill_name": "Security Auditing", "category": "concepts", "importance": "required",
             "source_excerpt": "Assessing security posture and reporting vulnerabilities."},
            {"skill_name": "SIEM", "category": "tools", "importance": "required",
             "source_excerpt": "Using SIEM platforms for log analysis and threat detection."},
            {"skill_name": "Firewall / Network Security", "category": "concepts", "importance": "required",
             "source_excerpt": "Configuring firewalls and securing network perimeters."},
            {"skill_name": "Python", "category": "language", "importance": "preferred",
             "source_excerpt": "Scripting for security automation and tool development."},
            {"skill_name": "Linux", "category": "tools", "importance": "required",
             "source_excerpt": "Linux system administration for security operations."},
            {"skill_name": "Cryptography", "category": "concepts", "importance": "required",
             "source_excerpt": "Understanding encryption algorithms and key management."},
            {"skill_name": "Bash/Shell", "category": "tools", "importance": "preferred",
             "source_excerpt": "Shell scripting for automation and incident response."},
            {"skill_name": "Git", "category": "tools", "importance": "preferred",
             "source_excerpt": "Version control for security scripts and documentation."},
        ],
    },
}


def get_profile(profile_id: str) -> Dict[str, Any]:
    """Returns a skill profile by its ID. Raises KeyError if not found."""
    return SKILL_PROFILES[profile_id]


def list_profiles() -> List[Dict[str, Any]]:
    """Returns summary metadata for all profiles (without full requirements list)."""
    return [
        {
            "profile_id": p["profile_id"],
            "role_title": p["role_title"],
            "description": p["description"],
        }
        for p in SKILL_PROFILES.values()
    ]
