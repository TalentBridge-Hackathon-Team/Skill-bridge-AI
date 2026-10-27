/**
 * Test fixtures for isolated Vitest unit/integration tests
 */
import type { TargetRoleOption, UserProfile } from '../types';

export const MOCK_TARGET_ROLES: TargetRoleOption[] = [
  {
    id: 'role_junior_backend',
    role_title: 'Junior Backend Developer',
    level: 'Entry-Level / Junior (0-2 yrs)',
    department: 'Core Platform Engineering',
    mode: 'job_specific',
    days_remaining: 14,
    study_hours_per_week: 14,
    summary: 'Focuses on building robust RESTful APIs in Python with Django, schema design in PostgreSQL, automated testing, and secure authentication.',
    job_text: `We are seeking a motivated Junior Backend Developer to join our Platform team.
Key responsibilities:
- Design, build, and maintain robust RESTful APIs in Python using Django REST Framework.
- Write and optimize database queries and migrations using PostgreSQL.
- Write automated unit, integration, and end-to-end API tests.
- Implement token-based authentication (JWT) and secure endpoint authorization.
- Containerize application services using Docker for local and staging environments.
Requirements:
- Strong proficiency in Python and familiarity with web frameworks.
- Hands-on experience with relational databases (PostgreSQL preferred).
- Demonstrated discipline with automated API testing and Git collaboration.
- Nice-to-have: Familiarity with containerization (Docker) and message queues.`,
    requirements: [
      {
        id: 'req_jbe_1',
        requirement_id: 'req_jbe_1',
        skill_name: 'Python',
        category: 'language',
        importance: 'required',
        source_excerpt: 'Strong proficiency in Python and familiarity with web frameworks',
        user_confirmed: true
      },
      {
        id: 'req_jbe_2',
        requirement_id: 'req_jbe_2',
        skill_name: 'Django REST Framework',
        category: 'framework',
        importance: 'required',
        source_excerpt: 'Design, build, and maintain robust RESTful APIs in Python using Django REST Framework',
        user_confirmed: true
      },
      {
        id: 'req_jbe_3',
        requirement_id: 'req_jbe_3',
        skill_name: 'PostgreSQL',
        category: 'database',
        importance: 'required',
        source_excerpt: 'Write and optimize database queries and migrations using PostgreSQL',
        user_confirmed: true
      },
      {
        id: 'req_jbe_4',
        requirement_id: 'req_jbe_4',
        skill_name: 'API Testing',
        category: 'testing',
        importance: 'required',
        source_excerpt: 'Demonstrated discipline with automated API testing (unit, integration, regression)',
        user_confirmed: true
      },
      {
        id: 'req_jbe_5',
        requirement_id: 'req_jbe_5',
        skill_name: 'Authentication & Security',
        category: 'security',
        importance: 'required',
        source_excerpt: 'Implement token-based authentication (JWT) and secure endpoint authorization',
        user_confirmed: true
      },
      {
        id: 'req_jbe_6',
        requirement_id: 'req_jbe_6',
        skill_name: 'Docker',
        category: 'devops',
        importance: 'preferred',
        source_excerpt: 'Nice-to-have: Familiarity with containerization (Docker) and service orchestration',
        user_confirmed: true
      }
    ]
  },
  {
    id: 'role_full_stack',
    role_title: 'Full Stack Developer',
    level: 'Mid-Level (2-4 yrs)',
    department: 'Product Growth',
    mode: 'job_specific',
    days_remaining: 21,
    study_hours_per_week: 10,
    summary: 'Full-stack engineering role combining modern React frontends with Node/PostgreSQL backends, GraphQL, and automated CI/CD pipelines.',
    job_text: `Looking for a Full Stack Developer experienced with modern web architectures.
Key requirements:
- Strong command of TypeScript across frontend and backend.
- Production experience with React 18/19 and Tailwind CSS.
- Backend service development with Node.js / Express or Python.
- Relational schema modeling with PostgreSQL.
- Experience with GraphQL APIs and CI/CD GitHub Actions.`,
    requirements: [
      {
        id: 'req_fs_1',
        requirement_id: 'req_fs_1',
        skill_name: 'TypeScript',
        category: 'language',
        importance: 'required',
        source_excerpt: 'Strong command of TypeScript across frontend and backend',
        user_confirmed: true
      },
      {
        id: 'req_fs_2',
        requirement_id: 'req_fs_2',
        skill_name: 'React',
        category: 'frontend',
        importance: 'required',
        source_excerpt: 'Production experience with React and modern component state architectures',
        user_confirmed: true
      },
      {
        id: 'req_fs_3',
        requirement_id: 'req_fs_3',
        skill_name: 'PostgreSQL',
        category: 'database',
        importance: 'required',
        source_excerpt: 'Relational schema modeling and indexing with PostgreSQL',
        user_confirmed: true
      },
      {
        id: 'req_fs_4',
        requirement_id: 'req_fs_4',
        skill_name: 'GraphQL',
        category: 'api',
        importance: 'preferred',
        source_excerpt: 'Experience building and querying GraphQL endpoints',
        user_confirmed: true
      },
      {
        id: 'req_fs_5',
        requirement_id: 'req_fs_5',
        skill_name: 'API Testing',
        category: 'testing',
        importance: 'required',
        source_excerpt: 'Automated testing discipline with Vitest or Jest',
        user_confirmed: true
      },
      {
        id: 'req_fs_6',
        requirement_id: 'req_fs_6',
        skill_name: 'Docker',
        category: 'devops',
        importance: 'preferred',
        source_excerpt: 'Containerized deployment workflows with Docker',
        user_confirmed: true
      }
    ]
  },
  {
    id: 'role_cloud_devops',
    role_title: 'Cloud & DevOps Engineer',
    level: 'Associate / Junior',
    department: 'Infrastructure & Site Reliability',
    mode: 'job_specific',
    days_remaining: 30,
    study_hours_per_week: 12,
    summary: 'Focuses on AWS cloud architecture, Infrastructure-as-Code with Terraform, Docker containers, and CI/CD automation.',
    job_text: `Seeking a Cloud & DevOps Engineer to automate cloud infrastructure and observability.
Key requirements:
- Linux systems administration and Bash scripting proficiency.
- Hands-on AWS cloud service management (EC2, S3, RDS, IAM).
- Infrastructure as Code using Terraform.
- Containerization and orchestration with Docker and Kubernetes.`,
    requirements: [
      {
        id: 'req_cde_1',
        requirement_id: 'req_cde_1',
        skill_name: 'Linux & Bash',
        category: 'systems',
        importance: 'required',
        source_excerpt: 'Linux systems administration and Bash scripting proficiency',
        user_confirmed: true
      },
      {
        id: 'req_cde_2',
        requirement_id: 'req_cde_2',
        skill_name: 'Docker',
        category: 'devops',
        importance: 'required',
        source_excerpt: 'Containerization and multi-container orchestration with Docker',
        user_confirmed: true
      },
      {
        id: 'req_cde_3',
        requirement_id: 'req_cde_3',
        skill_name: 'AWS Core Services',
        category: 'cloud',
        importance: 'required',
        source_excerpt: 'Hands-on AWS cloud service management (EC2, S3, RDS, IAM)',
        user_confirmed: true
      },
      {
        id: 'req_cde_4',
        requirement_id: 'req_cde_4',
        skill_name: 'Terraform',
        category: 'infrastructure',
        importance: 'required',
        source_excerpt: 'Infrastructure as Code provisioning using Terraform',
        user_confirmed: true
      },
      {
        id: 'req_cde_5',
        requirement_id: 'req_cde_5',
        skill_name: 'API Testing',
        category: 'testing',
        importance: 'preferred',
        source_excerpt: 'Automated integration smoke tests against live deployments',
        user_confirmed: true
      }
    ]
  },
  {
    id: 'role_empty_edge_case',
    role_title: 'Unspecified Role (Edge Case)',
    level: 'Draft',
    department: 'Exploratory',
    mode: 'job_specific',
    days_remaining: 10,
    study_hours_per_week: 5,
    summary: 'A role definition without requirements to verify graceful UI handling of empty requirement sets.',
    job_text: 'Draft posting with no requirements extracted yet.',
    requirements: []
  }
];

export const MOCK_USER_PROFILE: UserProfile = {
  user_id: 'demo_user',
  name: 'Alex Morgan',
  target_role: 'Junior Backend Developer',
  education: 'B.Sc. in Computer Science',
  experience_level: 'Entry Level',
  skills: 'Python, Django REST Framework, PostgreSQL, Git, Linux, Docker, GraphQL',
  resume_file: 'https://skillbridge-resumes.s3.amazonaws.com/resumes/demo_user/alex_morgan_cv.pdf',
  evidence: [
    {
      id: 'evi_001',
      evidence_id: 'evi_001',
      skill_name: 'Django REST Framework',
      evidence_type: 'project',
      title: 'E-Commerce Order Management API',
      reference: 'https://github.com/alex-morgan/order-api-django',
      description: 'Production-ready REST API featuring Django REST Framework, JWT authentication, PostgreSQL, and Pytest coverage.',
      review_status: 'verified',
      status: 'verified',
      created_at: '2026-02-15T10:00:00Z'
    },
    {
      id: 'evi_002',
      evidence_id: 'evi_002',
      skill_name: 'Python',
      evidence_type: 'project',
      title: 'Algorithmic Problem Solving & Data Structures',
      reference: 'https://github.com/alex-morgan/python-algorithms',
      description: '50+ thoroughly tested Python algorithmic implementations with Big-O complexity documentation.',
      review_status: 'verified',
      status: 'verified',
      created_at: '2026-01-20T14:30:00Z'
    },
    {
      id: 'evi_003',
      evidence_id: 'evi_003',
      skill_name: 'PostgreSQL',
      evidence_type: 'self_reported',
      title: 'Database Design & Optimization Course Certificate',
      reference: 'https://coursera.org/verify/pg-db-design-992',
      description: 'Completed 6-week coursework in PostgreSQL indexing, normalization, and ACID transactions; no standalone live GitHub repository linked.',
      review_status: 'unverified',
      status: 'unverified',
      created_at: '2026-03-01T09:15:00Z'
    },
    {
      id: 'evi_004',
      evidence_id: 'evi_004',
      skill_name: 'Docker',
      evidence_type: 'project',
      title: 'Containerized Microservices Starter',
      reference: 'https://github.com/alex-morgan/docker-microservices',
      description: 'Multi-stage Dockerfiles and docker-compose configurations orchestrating Django backend with Postgres and Redis.',
      review_status: 'verified',
      status: 'verified',
      created_at: '2026-02-28T16:45:00Z'
    },
    {
      id: 'evi_005',
      evidence_id: 'evi_005',
      skill_name: 'Authentication & Security',
      evidence_type: 'project',
      title: 'JWT Token Authentication Module',
      reference: 'https://github.com/alex-morgan/auth-service',
      description: 'Draft authentication middleware; automated test assertions failed token expiry and revocation edge cases.',
      review_status: 'needs_improvement',
      status: 'needs_improvement',
      created_at: '2026-03-10T11:20:00Z'
    },
    {
      id: 'evi_006',
      evidence_id: 'evi_006',
      skill_name: 'GraphQL',
      evidence_type: 'project',
      title: 'Apollo GraphQL API Exploration',
      reference: 'https://github.com/alex-morgan/graphql-demo',
      description: 'Full GraphQL server with query resolving, pagination, and data-loader batching. Unmapped to Junior Backend Developer role, highlighting transferable capabilities.',
      review_status: 'verified',
      status: 'verified',
      created_at: '2026-02-10T08:00:00Z'
    },
    {
      id: 'evi_007',
      evidence_id: 'evi_007',
      skill_name: 'Linux & Bash',
      evidence_type: 'project',
      title: 'Automated Linux Server Provisioning Scripts',
      reference: 'https://github.com/alex-morgan/linux-scripts',
      description: 'Shell scripts for setting up Ubuntu server environments with SSH security and firewall rules.',
      review_status: 'verified',
      status: 'verified',
      created_at: '2026-01-05T12:00:00Z'
    }
  ]
};

export const MOCK_COMPLETED_ASSESSMENTS: Array<{ target_skill: string; score: number }> = [
  {
    target_skill: 'API Testing',
    score: 6
  }
];
