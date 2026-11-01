/**
 * SkillBridge AI - Dynamic Global Search Engine
 * 
 * Provides flexible, tokenized, and context-aware multi-category search.
 * Dynamically indexes:
 *  1. Navigation & System Sections (with comprehensive aliases & synonyms)
 *  2. Real User Target Roles & Goals (Mode A & Mode B) from active backend/session
 *  3. Real Analyzed Skill Gaps & Requirements (with priority & effort badges)
 *  4. Core Engineering Competency Presets (with domain categorizations)
 *  5. Verified Projects & Portfolio Evidence
 */

import { skillGapService, cleanRoleTitle } from './skillGapService';
import type { TargetRoleOption } from '../types';

export interface GlobalSearchItem {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  category: 'page' | 'role' | 'skill_gap' | 'skill' | 'evidence';
  targetTab: string;
  actionPayload?: string;
  badge?: {
    label: string;
    variant: 'blue' | 'purple' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'slate';
  };
  keywords?: string[];
  score?: number;
}

// ---------------------------------------------------------------------------
// 1. Static Navigation Pages with Synonyms, Aliases & Search Keywords
// ---------------------------------------------------------------------------
export const SYSTEM_PAGES: GlobalSearchItem[] = [
  {
    id: 'p_overview',
    title: 'Overview & Metrics',
    subtitle: 'System Dashboard',
    description: 'ATS resume score, JD match rate, recent assessment scores, and weekly progress',
    category: 'page',
    targetTab: 'dashboard',
    badge: { label: 'Dashboard', variant: 'blue' },
    keywords: [
      'overview', 'dashboard', 'home', 'main', 'ats', 'score', 'metrics', 'stats',
      'analytics', 'status', 'kpi', 'progress', 'summary', 'weekly progress', 'strength'
    ],
  },
  {
    id: 'p_profile',
    title: 'Profile & Evidence',
    subtitle: 'Career Profile & Resume',
    description: 'Upload resume / CV, manage GitHub links, verified skills, and project portfolio',
    category: 'page',
    targetTab: 'profile',
    badge: { label: 'Profile', variant: 'blue' },
    keywords: [
      'profile', 'resume', 'cv', 'upload', 'pdf', 'docx', 'evidence', 'github', 'links',
      'skills', 'experience', 'education', 'portfolio', 'account', 'projects', 'user', 's3'
    ],
  },
  {
    id: 'p_analysis',
    title: 'Job & Goal Analysis',
    subtitle: 'JD Matcher & Career Goals',
    description: 'Extract skills from job postings (Mode A) or configure career transition goals (Mode B)',
    category: 'page',
    targetTab: 'analysis',
    badge: { label: 'Analysis', variant: 'blue' },
    keywords: [
      'analysis', 'job', 'jd', 'matcher', 'description', 'posting', 'job description',
      'goal', 'mode a', 'mode b', 'career', 'extract', 'requirements', 'deadline',
      'target role', 'opportunity', 'study hours', 'capacity', 'paste', 'linkedin'
    ],
  },
  {
    id: 'p_gaps',
    title: 'Skill Gap Report',
    subtitle: 'Evidence Matrix & Feasibility',
    description: 'Transparent requirement-to-profile match matrix, gap severity, and deadline feasibility',
    category: 'page',
    targetTab: 'gaps',
    badge: { label: 'Gap Report', variant: 'blue' },
    keywords: [
      'skill gap', 'gaps', 'matrix', 'evidence matrix', 'feasibility', 'match report',
      'missing skills', 'priorities', 'comparison', 'sprint scope', 'deferred',
      'remediation', 'match score', 'effort hours', 'target horizon'
    ],
  },
  {
    id: 'p_assessment',
    title: 'Practical Tasks & Assessments',
    subtitle: 'Hands-on Engineering Workstation',
    description: 'Hands-on coding deliverables, deterministic 10-point rubrics, and Socratic AI mentor guidance',
    category: 'page',
    targetTab: 'assessment',
    badge: { label: 'Workstation', variant: 'blue' },
    keywords: [
      'assessment', 'tasks', 'practical', 'coding', 'challenge', 'rubric', 'socratic',
      'mentor', 'test', 'quiz', 'evaluation', 'workstation', 'starter code', 'submission',
      'deliverable', 'verify', 'interactive', '10-point'
    ],
  },
  {
    id: 'p_roadmap',
    title: 'Learner Roadmap & Pacing',
    subtitle: 'Milestones & Timeline Planner',
    description: 'Sequenced daily milestones, study capacity pacing, and curated technical documentation',
    category: 'page',
    targetTab: 'roadmap',
    badge: { label: 'Roadmap', variant: 'blue' },
    keywords: [
      'roadmap', 'milestones', 'timeline', 'schedule', 'pacing', 'daily hours', 'calendar',
      'curriculum', 'study plan', 'deadline', 'feasibility', 'recalculate', 'documentation',
      'action plan', 'hours per day'
    ],
  },
];

// ---------------------------------------------------------------------------
// 2. Comprehensive Catalog of Engineering Competencies & Challenges
// ---------------------------------------------------------------------------
export const CORE_SKILLS_CATALOG: GlobalSearchItem[] = [
  {
    id: 's_python',
    title: 'Python',
    subtitle: 'Backend Language',
    description: 'Data structures, OOP, list comprehensions, decorators, and asynchronous programming',
    category: 'skill',
    targetTab: 'assessment',
    actionPayload: 'Python',
    badge: { label: 'Skill Challenge', variant: 'emerald' },
    keywords: ['python', 'py', 'backend', 'oop', 'scripts', 'asyncio', 'generators'],
  },
  {
    id: 's_django',
    title: 'Django REST Framework (DRF)',
    subtitle: 'Web API Framework',
    description: 'API design, serializers, viewsets, authentication middleware, and permission classes',
    category: 'skill',
    targetTab: 'assessment',
    actionPayload: 'Django REST Framework',
    badge: { label: 'Skill Challenge', variant: 'emerald' },
    keywords: ['django', 'drf', 'rest', 'api', 'serializers', 'viewsets', 'endpoints', 'backend'],
  },
  {
    id: 's_fastapi',
    title: 'FastAPI',
    subtitle: 'Async Python Framework',
    description: 'High-performance ASGI endpoints, Pydantic schemas, dependency injection, and OpenAPI',
    category: 'skill',
    targetTab: 'assessment',
    actionPayload: 'FastAPI',
    badge: { label: 'Skill Challenge', variant: 'emerald' },
    keywords: ['fastapi', 'pydantic', 'async', 'asgi', 'swagger', 'openapi', 'microservices'],
  },
  {
    id: 's_postgres',
    title: 'PostgreSQL & Database Optimization',
    subtitle: 'Relational Database',
    description: 'Schema modeling, B-Tree indexes, EXPLAIN ANALYZE query planning, and ACID transactions',
    category: 'skill',
    targetTab: 'assessment',
    actionPayload: 'PostgreSQL',
    badge: { label: 'Skill Challenge', variant: 'emerald' },
    keywords: ['postgresql', 'postgres', 'sql', 'database', 'rdbms', 'indexing', 'btree', 'acid', 'queries'],
  },
  {
    id: 's_docker',
    title: 'Docker & Containerization',
    subtitle: 'DevOps & Infrastructure',
    description: 'Multi-stage Dockerfiles, image minimization, container security, and environment portability',
    category: 'skill',
    targetTab: 'assessment',
    actionPayload: 'Docker',
    badge: { label: 'Skill Challenge', variant: 'emerald' },
    keywords: ['docker', 'container', 'dockerfile', 'devops', 'images', 'non-root', 'multi-stage'],
  },
  {
    id: 's_kubernetes',
    title: 'Kubernetes (K8s)',
    subtitle: 'Container Orchestration',
    description: 'Pod deployments, services, ingress routing, ConfigMaps, and cluster autoscaling',
    category: 'skill',
    targetTab: 'assessment',
    actionPayload: 'Kubernetes',
    badge: { label: 'Skill Challenge', variant: 'emerald' },
    keywords: ['kubernetes', 'k8s', 'pods', 'orchestration', 'cloud', 'ingress', 'helm', 'clusters'],
  },
  {
    id: 's_typescript',
    title: 'TypeScript',
    subtitle: 'Full Stack Language',
    description: 'Static type systems, generics, utility types, unions, and type-safe API contracts',
    category: 'skill',
    targetTab: 'assessment',
    actionPayload: 'TypeScript',
    badge: { label: 'Skill Challenge', variant: 'emerald' },
    keywords: ['typescript', 'ts', 'types', 'javascript', 'frontend', 'generics', 'strict'],
  },
  {
    id: 's_react',
    title: 'React & Component Architecture',
    subtitle: 'Frontend UI Framework',
    description: 'Modern functional components, hooks, Context API, state management, and performance tuning',
    category: 'skill',
    targetTab: 'assessment',
    actionPayload: 'React',
    badge: { label: 'Skill Challenge', variant: 'emerald' },
    keywords: ['react', 'jsx', 'tsx', 'ui', 'frontend', 'hooks', 'state', 'virtual dom'],
  },
  {
    id: 's_nextjs',
    title: 'Next.js & Server Components',
    subtitle: 'Full Stack React Framework',
    description: 'App Router, Server-Side Rendering (SSR), Static Generation (SSG), and edge API routes',
    category: 'skill',
    targetTab: 'assessment',
    actionPayload: 'Next.js',
    badge: { label: 'Skill Challenge', variant: 'emerald' },
    keywords: ['nextjs', 'next', 'react', 'ssr', 'ssg', 'fullstack', 'routing', 'app router'],
  },
  {
    id: 's_testing',
    title: 'API Testing & Quality Assurance',
    subtitle: 'Testing & Verification',
    description: 'Pytest & Vitest automation, endpoint regression testing, fixtures, and mock assertions',
    category: 'skill',
    targetTab: 'assessment',
    actionPayload: 'API Testing',
    badge: { label: 'Skill Challenge', variant: 'emerald' },
    keywords: ['testing', 'api testing', 'pytest', 'vitest', 'unit tests', 'integration tests', 'mocks', 'qa'],
  },
  {
    id: 's_auth',
    title: 'Authentication & Security',
    subtitle: 'Application Security',
    description: 'JWT token rotation, blacklisting, OAuth2, RBAC access controls, and OWASP defenses',
    category: 'skill',
    targetTab: 'assessment',
    actionPayload: 'Authentication & Security',
    badge: { label: 'Skill Challenge', variant: 'emerald' },
    keywords: ['auth', 'authentication', 'security', 'jwt', 'oauth', 'token', 'rbac', 'csrf', 'owasp'],
  },
  {
    id: 's_graphql',
    title: 'GraphQL API Design',
    subtitle: 'API Architecture',
    description: 'Schemas, query resolvers, mutations, DataLoader n+1 prevention, and Apollo integration',
    category: 'skill',
    targetTab: 'assessment',
    actionPayload: 'GraphQL',
    badge: { label: 'Skill Challenge', variant: 'emerald' },
    keywords: ['graphql', 'api', 'schema', 'resolvers', 'mutations', 'apollo', 'queries'],
  },
  {
    id: 's_aws',
    title: 'AWS Core Cloud Architecture',
    subtitle: 'Cloud Platforms',
    description: 'S3 object storage, SQS messaging queues, Lambda serverless, and IAM security policies',
    category: 'skill',
    targetTab: 'assessment',
    actionPayload: 'AWS Core Services',
    badge: { label: 'Skill Challenge', variant: 'emerald' },
    keywords: ['aws', 'cloud', 's3', 'sqs', 'lambda', 'iam', 'ec2', 'amazon', 'serverless'],
  },
  {
    id: 's_terraform',
    title: 'Terraform & Infrastructure as Code',
    subtitle: 'Cloud Automation',
    description: 'Declarative cloud provisioning, HCL configurations, modules, and remote state management',
    category: 'skill',
    targetTab: 'assessment',
    actionPayload: 'Terraform',
    badge: { label: 'Skill Challenge', variant: 'emerald' },
    keywords: ['terraform', 'iac', 'infrastructure', 'hcl', 'devops', 'cloud', 'provisioning'],
  },
  {
    id: 's_pytorch',
    title: 'PyTorch & Deep Learning',
    subtitle: 'AI & Machine Learning',
    description: 'Tensor operations, autograd backpropagation, custom nn.Module models, and training loops',
    category: 'skill',
    targetTab: 'assessment',
    actionPayload: 'PyTorch',
    badge: { label: 'Skill Challenge', variant: 'emerald' },
    keywords: ['pytorch', 'torch', 'ai', 'ml', 'deep learning', 'neural networks', 'tensors', 'cuda', 'models'],
  },
  {
    id: 's_vector',
    title: 'Vector Databases & RAG Pipelines',
    subtitle: 'AI Architecture',
    description: 'Embeddings storage, pgvector HNSW indexing, cosine similarity, and LLM context retrieval',
    category: 'skill',
    targetTab: 'assessment',
    actionPayload: 'Vector Databases',
    badge: { label: 'Skill Challenge', variant: 'emerald' },
    keywords: ['vector', 'pgvector', 'rag', 'embeddings', 'similarity', 'hnsw', 'ai', 'llm', 'retrieval'],
  },
  {
    id: 's_redis',
    title: 'Redis & Distributed Caching',
    subtitle: 'In-Memory Datastore',
    description: 'Cache-aside strategies, TTL expiration, session stores, rate limiting, and pub/sub queues',
    category: 'skill',
    targetTab: 'assessment',
    actionPayload: 'Redis',
    badge: { label: 'Skill Challenge', variant: 'emerald' },
    keywords: ['redis', 'caching', 'in-memory', 'pubsub', 'rate limiting', 'sessions', 'ttl', 'performance'],
  },
  {
    id: 's_git',
    title: 'Git Workflows & CI/CD Pipelines',
    subtitle: 'Engineering Collaboration',
    description: 'Feature branching, rebase workflows, GitHub Actions CI automation, and release tags',
    category: 'skill',
    targetTab: 'assessment',
    actionPayload: 'Git',
    badge: { label: 'Skill Challenge', variant: 'emerald' },
    keywords: ['git', 'github', 'ci/cd', 'actions', 'version control', 'pull request', 'workflows'],
  },
];

// ---------------------------------------------------------------------------
// 3. Dynamic User Index Builder: Loads Live Roles, Analyzed Gaps & Evidence
// ---------------------------------------------------------------------------
export async function buildDynamicUserIndex(userId?: string): Promise<GlobalSearchItem[]> {
  const dynamicItems: GlobalSearchItem[] = [];

  try {
    // 1. Fetch real target roles & career goals from the live service
    const roles: TargetRoleOption[] = await skillGapService.getTargetRoles(userId);

    for (const r of roles) {
      const cleanTitle = cleanRoleTitle(r.role_title);
      const isJobSpecific = r.mode === 'job_specific';
      const badgeVariant = isJobSpecific ? 'purple' : 'cyan';
      const badgeText = isJobSpecific ? 'Target Job' : 'Career Goal';

      dynamicItems.push({
        id: `dyn_role_${r.id}`,
        title: cleanTitle,
        subtitle: `${badgeText} • ${r.department || (isJobSpecific ? 'Extracted from JD' : 'Goal Milestone')}`,
        description: `Target role with ${r.days_remaining ? `${r.days_remaining}d target deadline` : 'active learning plan'}`,
        category: 'role',
        targetTab: 'gaps',
        actionPayload: r.id,
        badge: { label: badgeText, variant: badgeVariant },
        keywords: [
          cleanTitle.toLowerCase(),
          'role',
          'target role',
          isJobSpecific ? 'job specific' : 'goal based',
          isJobSpecific ? 'mode a' : 'mode b',
          (r.department || '').toLowerCase(),
        ],
      });
    }

    // 2. Fetch live analyzed skill gaps from local session / active analysis
    if (typeof window !== 'undefined' && window.localStorage) {
      const selectedRoleId = skillGapService.getSelectedRoleId() || window.localStorage.getItem('skillbridge_selected_role');
      if (selectedRoleId) {
        const cachedAnalysisRaw = window.localStorage.getItem(`skillbridge_cached_analysis_${selectedRoleId}`);
        if (cachedAnalysisRaw) {
          try {
            const cached = JSON.parse(cachedAnalysisRaw);
            const results = cached?.results || [];

            for (const item of results) {
              if (!item?.skill_name) continue;

              const priority = item.priority || 'Medium';
              const variant =
                item.status === 'Demonstrated'
                  ? 'emerald'
                  : priority === 'High'
                  ? 'rose'
                  : 'amber';

              dynamicItems.push({
                id: `dyn_gap_${item.requirement_id || item.skill_name}`,
                title: item.skill_name,
                subtitle: `${item.status || 'Skill Gap'} • ~${item.effort_hours_estimate || 8}h effort`,
                description: `Analyzed competency for your target role (${item.importance || 'required'})`,
                category: 'skill_gap',
                targetTab: 'assessment',
                actionPayload: item.skill_name,
                badge: {
                  label: item.status === 'Demonstrated' ? 'Demonstrated' : `${priority} Priority Gap`,
                  variant,
                },
                keywords: [
                  item.skill_name.toLowerCase(),
                  'skill gap',
                  priority.toLowerCase(),
                  (item.status || '').toLowerCase(),
                  (item.category || '').toLowerCase(),
                ],
              });
            }
          } catch {}
        }
      }
    }
  } catch (err) {
    // Graceful fallback to static index if network or service encounters issues
    console.debug('Search engine: dynamic user index building encountered a minor issue:', err);
  }

  return dynamicItems;
}

// ---------------------------------------------------------------------------
// 4. Flexible Multi-Token Relevance & Fuzzy Matching Algorithm
// ---------------------------------------------------------------------------
export function searchGlobal(
  query: string,
  searchPool: GlobalSearchItem[]
): GlobalSearchItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  // Split query into distinct tokens (e.g., "junior backend" -> ["junior", "backend"])
  const tokens = trimmed.split(/\s+/).filter(Boolean);

  const scoredResults: Array<{ item: GlobalSearchItem; score: number }> = [];

  for (const item of searchPool) {
    const titleLow = item.title.toLowerCase();
    const descLow = item.description.toLowerCase();
    const subtitleLow = (item.subtitle || '').toLowerCase();
    const categoryLow = item.category.toLowerCase();
    const keywords = (item.keywords || []).map(k => k.toLowerCase());

    let score = 0;

    // --- High Signal: Full Query Matching ---
    if (titleLow === trimmed) {
      score += 120; // Exact full title match
    } else if (titleLow.startsWith(trimmed)) {
      score += 85; // Title starts with query
    } else if (titleLow.includes(trimmed)) {
      score += 55; // Substring in title
    }

    if (keywords.some(k => k === trimmed)) {
      score += 75; // Exact keyword match (e.g., "ats", "cv", "resume", "mentor")
    } else if (keywords.some(k => k.includes(trimmed) || trimmed.includes(k))) {
      score += 40; // Keyword substring match
    }

    if (descLow.includes(trimmed) || subtitleLow.includes(trimmed)) {
      score += 25; // Full query in description or subtitle
    }

    // --- Multi-Token Matching (handles out-of-order words like "python backend") ---
    let matchedTokenCount = 0;

    for (const token of tokens) {
      let tokenMatched = false;

      if (titleLow.includes(token)) {
        score += 20;
        tokenMatched = true;
      }
      if (keywords.some(k => k.includes(token))) {
        score += 15;
        tokenMatched = true;
      }
      if (subtitleLow.includes(token)) {
        score += 10;
        tokenMatched = true;
      }
      if (descLow.includes(token)) {
        score += 8;
        tokenMatched = true;
      }
      if (categoryLow.includes(token)) {
        score += 5;
        tokenMatched = true;
      }

      if (tokenMatched) {
        matchedTokenCount++;
      }
    }

    // Boost if all search tokens are found somewhere in the item
    if (tokens.length > 1 && matchedTokenCount === tokens.length) {
      score += 45;
    }

    // Contextual boost for live user-generated items (roles & evaluated skill gaps)
    if (item.category === 'role' || item.category === 'skill_gap') {
      score += 10;
    }

    // Only include items where at least one meaningful match occurred
    if (score > 0) {
      scoredResults.push({ item: { ...item, score }, score });
    }
  }

  // Sort by highest score first, then alphabetically
  scoredResults.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.item.title.localeCompare(b.item.title);
  });

  // Deduplicate items by title to avoid redundant entries
  const seenTitles = new Set<string>();
  const uniqueResults: GlobalSearchItem[] = [];

  for (const { item } of scoredResults) {
    const key = `${item.category}:${item.title.toLowerCase().trim()}`;
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      uniqueResults.push(item);
    }
  }

  // Return top 8 most relevant matches for a crisp, responsive UI
  return uniqueResults.slice(0, 8);
}
