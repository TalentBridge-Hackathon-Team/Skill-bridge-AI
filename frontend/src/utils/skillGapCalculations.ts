/**
 * SkillBridge AI - Member 3: Deterministic Skill Gap & Evidence Matching Utilities
 * 
 * Implements transparent, deterministic matching algorithms, feasibility assessments,
 * match score calculations, and evidence-traceability mapping.
 * Strictly adheres to Blueprint 2.0 (Sections 7 & 8) and backend matching engine contracts.
 */

import type {
  Requirement,
  UserProfile,
  SkillEvidence,
  SkillStatus,
  PriorityLevel,
  FeasibilityAssessment,
  FeasibilityBand
} from '../types';

export interface EffortBreakdown {
  base_hours: number;
  complexity_multiplier: number;
  category: string;
  adjacent_skill_discount: number;
  adjacent_skill_name?: string | null;
  assessment_scaling_factor: number;
  assessment_score?: number | null;
  final_hours: number;
  explanation: string;
}

/**
 * Extended traceable match result used by the Member 3 UI
 * Preserves canonical MatchReport fields while providing rich evidence traceability
 */
export interface TraceableMatchResult {
  requirement_id: string;
  skill_name: string;
  category: string;
  importance: 'required' | 'preferred';
  status: SkillStatus;
  priority: PriorityLevel;
  reason: string;
  recommended_action: string;
  effort_hours_estimate: number;
  effort_breakdown?: EffortBreakdown;
  source_excerpt?: string;
  /** Linked evidence items supporting this skill */
  supporting_evidence: SkillEvidence[];
  /** Why this evidence was or was not considered sufficient */
  evidence_rationale: string;
  /** Distinction: whether learner claims knowledge but lacks evidence vs has no claim/evidence */
  gap_type: 'demonstrated' | 'missing_evidence' | 'needs_reinforcement' | 'missing_skill';
  /** Whether this requirement is deferred to Phase 2 under an urgent sprint */
  is_deferred?: boolean;
  /** Whether this requirement is actively included in the current sprint */
  in_sprint_scope?: boolean;
}

export interface SkillGapSummary {
  total_assessed: number;
  demonstrated_count: number;
  self_reported_count: number;
  needs_improvement_count: number;
  unverified_count: number;
  required_count: number;
  preferred_count: number;
  /** Overall readiness score (0-100) based on weighted requirements */
  match_score: number;
  /** Plain English explanation of the match score calculation */
  calculation_explanation: string;
  /** Total estimated hours needed to remediate all gaps */
  total_remediation_hours: number;
}

export interface EvidenceSkillMap {
  evidence: SkillEvidence;
  supported_skills: string[];
  is_mapped_to_role: boolean;
}

/**
 * Normalize skill strings for robust matching (e.g. "Django REST Framework" vs "django-rest-framework")
 */
export function normalizeSkill(skill: string): string {
  if (!skill) return '';
  return skill
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[-_./]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two skill names match or have strong substring overlap
 */
export function isSkillMatch(skillA: string, skillB: string): boolean {
  const a = normalizeSkill(skillA);
  const b = normalizeSkill(skillB);
  if (!a || !b) return false;
  if (a === b) return true;

  const aComp = a.replace(/\s+/g, '');
  const bComp = b.replace(/\s+/g, '');
  if (aComp === bComp) return true;

  // Handle common aliases
  const aliases: Record<string, string[]> = {
    'postgres': ['postgresql', 'psql'],
    'postgresql': ['postgres', 'psql'],
    'django rest framework': ['drf', 'django rest', 'django api'],
    'drf': ['django rest framework'],
    'js': ['javascript'],
    'ts': ['typescript'],
    'react': ['reactjs', 'react.js'],
    'node': ['nodejs', 'node.js'],
    'aws': ['amazon web services', 'aws cloud']
  };

  if (
    aliases[a]?.includes(b) || aliases[b]?.includes(a) ||
    aliases[aComp]?.includes(b) || aliases[bComp]?.includes(a) ||
    aliases[a]?.includes(bComp) || aliases[b]?.includes(aComp) ||
    aliases[aComp]?.includes(bComp) || aliases[bComp]?.includes(aComp)
  ) {
    return true;
  }

  // Exact substring match for multi-word or compound skills
  return (a.length > 3 && b.includes(a)) || (b.length > 3 && a.includes(b));
}

/**
 * Broad domain family clusters for generic adjacent skill transferability
 */
export const DOMAIN_FAMILIES: Record<string, string[]> = {
  languages: [
    'python', 'javascript', 'typescript', 'ruby', 'php', 'java', 'c++', 'cpp',
    'c#', 'csharp', 'go', 'golang', 'rust', 'swift', 'kotlin', 'scala', 'dart',
    'perl', 'r', 'elixir', 'clojure', 'haskell', 'lua', 'shell', 'bash'
  ],
  relational_db: [
    'postgresql', 'postgres', 'mysql', 'sqlite', 'mariadb', 'oracle', 'mssql',
    'sql server', 'cockroachdb', 'timescaledb', 'aurora', 'rds', 'pl/sql', 'sql'
  ],
  nosql_db: [
    'mongodb', 'couchdb', 'dynamodb', 'cosmosdb', 'firestore', 'cassandra',
    'scylladb', 'neo4j', 'arangodb', 'hbase'
  ],
  in_memory_cache: [
    'redis', 'memcached', 'hazelcast', 'aerospike', 'dragonfly', 'keydb'
  ],
  search_engines: [
    'elasticsearch', 'opensearch', 'solr', 'meilisearch', 'typesense', 'algolia'
  ],
  vector_db: [
    'pinecone', 'weaviate', 'qdrant', 'milvus', 'chroma', 'pgvector', 'faiss'
  ],
  web_frameworks: [
    'django', 'fastapi', 'flask', 'express', 'nest', 'nestjs', 'spring',
    'spring boot', 'rails', 'ruby on rails', 'laravel', 'gin', 'echo', 'fiber',
    'asp.net', 'fastify', 'koa', 'tornado'
  ],
  frontend_frameworks: [
    'react', 'reactjs', 'vue', 'vuejs', 'angular', 'svelte', 'solid', 'solidjs',
    'next', 'nextjs', 'nuxt', 'nuxtjs', 'remix', 'astro', 'gatsby'
  ],
  containers_orchestration: [
    'docker', 'podman', 'containerd', 'kubernetes', 'k8s', 'nomad', 'swarm',
    'docker compose', 'ecs', 'eks', 'gke', 'openshift', 'helm'
  ],
  cloud_providers: [
    'aws', 'amazon web services', 'gcp', 'google cloud', 'azure', 'microsoft azure',
    'digitalocean', 'linode', 'oracle cloud'
  ],
  iac_automation: [
    'terraform', 'pulumi', 'ansible', 'puppet', 'chef', 'cloudformation',
    'bicep', 'cdktf', 'terragrunt'
  ],
  message_streaming: [
    'kafka', 'rabbitmq', 'sqs', 'sns', 'pubsub', 'nats', 'eventbridge',
    'kinesis', 'pulsar', 'celery', 'activemq'
  ],
  testing_frameworks: [
    'pytest', 'unittest', 'jest', 'vitest', 'mocha', 'chai', 'cypress',
    'playwright', 'selenium', 'junit', 'rspec', 'supertest'
  ],
  api_technologies: [
    'rest', 'restful', 'rest api', 'graphql', 'grpc', 'trpc', 'soap',
    'websocket', 'openapi', 'swagger', 'json api'
  ],
  version_control: [
    'git', 'github', 'gitlab', 'bitbucket', 'mercurial', 'svn'
  ],
  ci_cd: [
    'github actions', 'gitlab ci', 'jenkins', 'circleci', 'travis', 'argocd',
    'flux', 'tekton', 'drone'
  ],
  observability: [
    'prometheus', 'grafana', 'datadog', 'new relic', 'splunk', 'jaeger',
    'opentelemetry', 'sentry', 'elk', 'loki'
  ],
  css_styling: [
    'tailwind', 'tailwindcss', 'bootstrap', 'material ui', 'mui', 'chakra',
    'styled components', 'scss', 'sass', 'css', 'css3'
  ],
  ai_ml: [
    'pytorch', 'tensorflow', 'keras', 'scikit learn', 'pandas', 'numpy',
    'huggingface', 'transformers', 'langchain', 'llamaindex', 'rag', 'llm'
  ]
};

/**
 * Generic complexity multiplier (0.5x to 1.8x) based on requirement category,
 * taxonomy keywords, or morphological token stems. Works universally for ANY current or future tool.
 */
export function getSkillComplexity(category: string, skillName: string): { multiplier: number; label: string } {
  const catLower = (category || '').toLowerCase().trim();
  const skillNorm = normalizeSkill(skillName);

  // 1. Broad Primary Category Mapping (Works for any tool assigned these categories)
  if (['tools', 'tool', 'utility', 'utilities', 'cli', 'documentation', 'version_control', 'vcs', 'markup', 'build'].includes(catLower)) {
    return { multiplier: 0.5, label: 'utility / tool' };
  } else if (['testing', 'test', 'tests', 'qa', 'quality_assurance', 'api', 'apis', 'library', 'libraries', 'package', 'sdk'].includes(catLower)) {
    return { multiplier: 0.8, label: 'testing / api' };
  } else if (['language', 'languages', 'framework', 'frameworks', 'database', 'databases', 'frontend', 'backend', 'mobile', 'web', 'fullstack'].includes(catLower)) {
    return { multiplier: 1.0, label: 'core engineering' };
  } else if (['cloud', 'devops', 'infrastructure', 'infra', 'security', 'networking', 'sysadmin', 'operations', 'sre', 'platform'].includes(catLower)) {
    return { multiplier: 1.4, label: 'cloud & infrastructure' };
  } else if (['architecture', 'distributed_systems', 'distributed', 'data_engineering', 'big_data', 'ai', 'machine_learning', 'ml', 'deep_learning', 'blockchain', 'systems_programming', 'embedded'].includes(catLower)) {
    return { multiplier: 1.8, label: 'distributed systems / AI' };
  }

  // 2. Generic Keyword & Morphological Token Stems (Works for any unknown/custom tool)
  const lowComplexity = [
    'git', 'github', 'gitlab', 'bash', 'shell', 'markdown', 'json', 'yaml', 'toml', 'csv',
    'postman', 'jira', 'npm', 'pip', 'yarn', 'pnpm', 'cli', 'linter', 'prettier', 'eslint',
    'black', 'webpack', 'vite', 'babel', 'makefile', 'regex'
  ];
  const testingApiTokens = [
    'test', 'testing', 'spec', 'mock', 'assert', 'fixture', 'cypress', 'playwright',
    'selenium', 'jest', 'pytest', 'vitest', 'api', 'rest', 'graphql', 'grpc', 'swagger', 'openapi'
  ];
  const cloudTokens = [
    'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'k8s', 'ci/cd', 'ci cd', 'pipeline',
    'monitoring', 'prometheus', 'grafana', 'telemetry', 'terraform', 'ansible', 'pulumi',
    'infra', 'cloud', 'linux', 'nginx', 'container', 'helm', 'devops', 'sre'
  ];
  const highComplexity = [
    'distributed', 'microservices', 'concurrency', 'multithreading', 'kernel', 'compiler',
    'consensus', 'paxos', 'raft', 'crypto', 'security', 'encryption', 'deep learning',
    'neural', 'transformer', 'llm', 'rag', 'agent', 'architecture', 'system design'
  ];

  if (lowComplexity.some(tok => skillNorm.includes(tok))) {
    return { multiplier: 0.5, label: 'utility / tool' };
  } else if (highComplexity.some(tok => skillNorm.includes(tok))) {
    return { multiplier: 1.8, label: 'distributed systems / advanced' };
  } else if (cloudTokens.some(tok => skillNorm.includes(tok))) {
    return { multiplier: 1.4, label: 'cloud & infrastructure' };
  } else if (testingApiTokens.some(tok => skillNorm.includes(tok))) {
    return { multiplier: 0.8, label: 'testing / api' };
  }

  // Balanced default for any general or newly invented technical tool/skill
  return { multiplier: 1.0, label: 'general technical skill' };
}

/**
 * Multi-tier generic adjacent skill transferability evaluation.
 * Works for ANY current or future tool via:
 * Tier 1: Canonical domain family clusters (40% discount)
 * Tier 2: Morphological paradigm stems (e.g. *db, *sql, *framework, *test, *cloud, *mq) (35% discount)
 * Tier 3: Category-level domain alignment (30% discount)
 */
export function findAdjacentTransferableSkill(
  targetSkill: string,
  verifiedSkills: string[],
  targetCategory?: string,
  verifiedSkillCategories?: Record<string, string>
): { adjacentSkill: string; discount: number; rationale?: string } | null {
  if (!targetSkill || !verifiedSkills || verifiedSkills.length === 0) return null;
  const targetNorm = normalizeSkill(targetSkill);

  // Helper for precise family membership check (avoids false-positive single-letter matches like 'r')
  const isFamilyMatch = (member: string, target: string): boolean => {
    if (member === target) return true;
    if (member.length >= 3 && target.length >= 3) {
      const targetWords = target.split(' ');
      return targetWords.includes(member) || (member.length >= 4 && target.includes(member));
    }
    return false;
  };

  // Tier 1: Canonical Domain Families (40% discount)
  for (const [familyKey, members] of Object.entries(DOMAIN_FAMILIES)) {
    const isTargetInFamily = members.some(m => isFamilyMatch(m, targetNorm));
    if (isTargetInFamily) {
      for (const vSkill of verifiedSkills) {
        const vNorm = normalizeSkill(vSkill);
        if (vNorm !== targetNorm && members.some(m => isFamilyMatch(m, vNorm))) {
          return { adjacentSkill: vSkill, discount: 0.40, rationale: `Domain family '${familyKey.replace('_', ' ')}'` };
        }
      }
    }
  }

  // Tier 2: Morphological Paradigm Stems (Works for novel/unknown tools, 35% discount)
  const stemParadigms: Record<string, string[]> = {
    'database': ['db', 'sql', 'store', 'base', 'table', 'schema', 'nosql'],
    'web/api framework': ['framework', 'router', 'mvc', 'orm', 'api', 'rest', 'server', 'http'],
    'cloud/infrastructure': ['cloud', 'infra', 'container', 'cluster', 'deploy', 'pipeline', 'ops'],
    'messaging/streaming': ['queue', 'mq', 'stream', 'bus', 'broker', 'event', 'pubsub'],
    'testing/qa': ['test', 'spec', 'mock', 'assert', 'bench', 'qa', 'coverage'],
    'ai/machine learning': ['ai', 'ml', 'neural', 'vision', 'nlp', 'llm', 'model', 'embed', 'rag', 'agent']
  };

  for (const [paradigmName, stems] of Object.entries(stemParadigms)) {
    const targetMatchesStem = stems.some(stem => targetNorm.includes(stem));
    if (targetMatchesStem) {
      for (const vSkill of verifiedSkills) {
        const vNorm = normalizeSkill(vSkill);
        if (vNorm !== targetNorm && stems.some(stem => vNorm.includes(stem))) {
          return { adjacentSkill: vSkill, discount: 0.35, rationale: `Shared ${paradigmName} paradigm` };
        }
      }
    }
  }

  // Tier 3: Category-Level Domain Alignment (30% discount)
  if (targetCategory && verifiedSkillCategories) {
    const catNorm = targetCategory.toLowerCase().trim();
    for (const vSkill of verifiedSkills) {
      const vCat = (verifiedSkillCategories[vSkill] || '').toLowerCase().trim();
      if (vCat && vCat === catNorm && normalizeSkill(vSkill) !== targetNorm) {
        return { adjacentSkill: vSkill, discount: 0.30, rationale: `Shared category '${targetCategory}'` };
      }
    }
  }

  return null;
}

/**
 * Universal continuous linear scaling for assessment scores.
 * Accepts any scoring system:
 * - 0 to 10 scale (e.g. 7.5 / 10)
 * - 0 to 100 percentage scale (e.g. 75 / 100)
 * - 0.0 to 1.0 ratio scale (e.g. 0.75)
 */
export function calculateAssessmentScaling(score?: number | null): number {
  if (score === undefined || score === null) return 1.0;
  let normScore = Number(score);
  if (normScore > 10.0) {
    normScore = Math.min(10.0, Math.max(0.0, Math.round((normScore / 10.0) * 10) / 10)); // e.g., 75 -> 7.5
  } else if (normScore > 0.0 && normScore <= 1.0) {
    normScore = Math.min(10.0, Math.max(0.0, Math.round((normScore * 10.0) * 10) / 10)); // e.g., 0.75 -> 7.5
  } else {
    normScore = Math.min(10.0, Math.max(0.0, normScore));
  }
  if (normScore >= 8.0) return 0.0;
  return Math.max(0.2, Math.round(((10.0 - normScore) / 10.0) * 100) / 100);
}

/**
 * Parse user skills array or comma-separated string safely
 */
export function parseUserSkills(skillsInput?: string[] | string | null): string[] {
  if (!skillsInput) return [];
  if (Array.isArray(skillsInput)) {
    return skillsInput.map(s => String(s).trim()).filter(Boolean);
  }
  if (typeof skillsInput === 'string') {
    return skillsInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Deterministic matching engine (Member 3 Core)
 * 
 * Rules:
 * 1. Assessment match: score >= 8 -> 'Demonstrated', score < 8 -> 'Needs improvement'
 * 2. Verified evidence (project / assessment with review_status === 'verified') -> 'Demonstrated'
 * 3. Evidence with review_status === 'needs_improvement' -> 'Needs improvement'
 * 4. Self-reported in profile skills OR unverified evidence item -> 'Self-reported'
 * 5. No profile match or evidence -> 'Unverified'
 */
export function matchRequirementsToProfile(
  requirements: Requirement[],
  profile: Partial<UserProfile> | null,
  completedAssessments?: Array<{ target_skill: string; score: number }>
): TraceableMatchResult[] {
  if (!requirements || requirements.length === 0) {
    return [];
  }

  const userSkills = parseUserSkills(profile?.skills);
  const evidenceList: SkillEvidence[] = profile?.evidence || [];
  const assessments = completedAssessments || [];

  // Verified skills list to calculate generic adjacent transferability
  const verifiedSkillsList: string[] = [
    ...evidenceList
      .filter(e => (e.review_status === 'verified' || e.status === 'verified') && e.evidence_type !== 'self_reported' && e.skill_name)
      .map(e => e.skill_name),
    ...assessments.filter(a => a.score >= 8 && a.target_skill).map(a => a.target_skill)
  ];
  const verifiedSkillCategories: Record<string, string> = {};
  evidenceList.forEach(e => {
    if ((e.review_status === 'verified' || e.status === 'verified') && e.skill_name) {
      verifiedSkillCategories[e.skill_name] = (e as any).category || '';
    }
  });

  return requirements.map((req, index) => {
    const skillName = req.skill_name || 'Unnamed Requirement';
    const importance = req.importance || 'required';
    const category = req.category || 'general';
    const requirementId = req.requirement_id || req.id || `req_${index + 1}`;

    // 1. Check for linked evidence items matching this requirement
    const matchedEvidence = evidenceList.filter(ev => isSkillMatch(ev.skill_name, skillName));

    // Check for verified evidence
    const verifiedEvidence = matchedEvidence.filter(
      ev => (ev.review_status === 'verified' || ev.status === 'verified') && ev.evidence_type !== 'self_reported'
    );

    // Check for needs_improvement evidence
    const needsImprovementEvidence = matchedEvidence.filter(
      ev => ev.review_status === 'needs_improvement' || ev.status === 'needs_improvement'
    );

    // 2. Check for assessment scores
    const assessmentMatch = assessments.find(a => isSkillMatch(a.target_skill, skillName));

    // 3. Check for self-reported claim
    const hasSelfReportedClaim = userSkills.some(s => isSkillMatch(s, skillName));

    let status: SkillStatus = 'Unverified';
    let priority: PriorityLevel = 'Medium';
    let reason = '';
    let action = '';
    let baseHours = 6.0;
    let evidenceRationale = '';
    let gapType: TraceableMatchResult['gap_type'] = 'missing_skill';

    if (assessmentMatch && assessmentMatch.score >= 8) {
      status = 'Demonstrated';
      priority = 'Low';
      baseHours = 0.0;
      gapType = 'demonstrated';
      reason = `Verified by controlled practical assessment score of ${assessmentMatch.score}/10.`;
      evidenceRationale = `Standardized rubric test passed with score ${assessmentMatch.score}/10.`;
      action = 'Ready to showcase in technical interviews and project portfolio.';
    } else if (verifiedEvidence.length > 0) {
      status = 'Demonstrated';
      priority = 'Low';
      baseHours = 0.0;
      gapType = 'demonstrated';
      const titles = verifiedEvidence.map(e => `"${e.title}"`).join(', ');
      reason = `Verified project evidence found: ${titles}.`;
      evidenceRationale = `Linked repository/artifact verified with active code, schema, and tests.`;
      action = 'Ready to showcase in technical interview questions and portfolio.';
    } else if (assessmentMatch) {
      status = 'Needs improvement';
      priority = importance === 'required' ? 'High' : 'Medium';
      baseHours = 5.0;
      gapType = 'needs_reinforcement';
      reason = `Assessment score of ${assessmentMatch.score}/10 indicates criteria need reinforcement.`;
      evidenceRationale = `Assessment submission did not satisfy full test assertions (${assessmentMatch.score}/10).`;
      action = 'Review rubric evaluation feedback and resubmit revised test suite.';
    } else if (needsImprovementEvidence.length > 0) {
      status = 'Needs improvement';
      priority = importance === 'required' ? 'High' : 'Medium';
      baseHours = 4.0;
      gapType = 'needs_reinforcement';
      const titles = needsImprovementEvidence.map(e => `"${e.title}"`).join(', ');
      reason = `Existing evidence (${titles}) requires code revision or improved test coverage.`;
      evidenceRationale = `Evidence reviewed but flagged for missing test cases or incomplete implementation.`;
      action = 'Refactor existing repository and update evidence documentation.';
    } else if (hasSelfReportedClaim || matchedEvidence.length > 0) {
      status = 'Self-reported';
      priority = importance === 'required' ? 'High' : 'Medium';
      baseHours = 8.0;
      gapType = 'missing_evidence';
      if (matchedEvidence.length > 0) {
        reason = `Evidence linked (${matchedEvidence.map(e => `"${e.title}"`).join(', ')}), but pending verification.`;
        evidenceRationale = `Artifact submitted as self-reported claim; requires repository verification or assessment.`;
      } else {
        reason = `Listed in profile skills, but no verified project repository or assessment linked.`;
        evidenceRationale = `Claimed in learner profile, but zero code evidence, schema, or test artifacts attached.`;
      }
      action = 'Link a project repository featuring implementation code and unit tests.';
    } else {
      status = 'Unverified';
      priority = importance === 'required' ? 'High' : 'Medium';
      baseHours = 6.0;
      gapType = 'missing_skill';
      reason = `Role capability without supporting project evidence or recorded assessment.`;
      evidenceRationale = `No evidence records or self-reported claims found in learner profile.`;
      action = 'Complete the practical assessment or build a targeted portfolio project.';
    }

    // Dynamic Multi-Factor Effort Computation
    let effort = 0.0;
    let effortBreakdown: EffortBreakdown;

    if (status === 'Demonstrated') {
      effort = 0.0;
      effortBreakdown = {
        base_hours: 0.0,
        complexity_multiplier: 1.0,
        category,
        adjacent_skill_discount: 0.0,
        adjacent_skill_name: null,
        assessment_scaling_factor: 0.0,
        assessment_score: assessmentMatch?.score ?? null,
        final_hours: 0.0,
        explanation: 'Requirement is demonstrated by verified evidence or assessment. 0 remediation hours needed.'
      };
    } else {
      const { multiplier: complexityMult, label: catLabel } = getSkillComplexity(category, skillName);
      const adjacentMatch = findAdjacentTransferableSkill(skillName, verifiedSkillsList, category, verifiedSkillCategories);
      const adjacentDiscount = adjacentMatch ? adjacentMatch.discount : 0.0;
      const adjacentSkillName = adjacentMatch ? adjacentMatch.adjacentSkill : null;

      const assessmentScale = assessmentMatch ? calculateAssessmentScaling(assessmentMatch.score) : 1.0;

      const rawEffort = baseHours * complexityMult * (1.0 - adjacentDiscount) * assessmentScale;
      effort = Math.max(1.0, Math.min(24.0, Math.round(rawEffort * 10) / 10));

      // Formulate simple, professional explanation without exposing mathematical internal formulas
      let explanation = `Estimated ~${effort} hours of focused preparation to bridge this requirement and build demonstrable evidence.`;
      if (adjacentDiscount > 0 && adjacentSkillName) {
        explanation = `Estimated ~${effort} hours of focused preparation, factoring in transferable experience from ${adjacentSkillName}.`;
      } else if (assessmentMatch && assessmentScale < 1.0) {
        explanation = `Estimated ~${effort} hours of preparation tailored to criteria identified in your recent assessment (${assessmentMatch.score}/10).`;
      }

      effortBreakdown = {
        base_hours: baseHours,
        complexity_multiplier: complexityMult,
        category: catLabel,
        adjacent_skill_discount: adjacentDiscount,
        adjacent_skill_name: adjacentSkillName,
        assessment_scaling_factor: assessmentScale,
        assessment_score: assessmentMatch?.score ?? null,
        final_hours: effort,
        explanation
      };
    }

    return {
      requirement_id: requirementId,
      skill_name: skillName,
      category,
      importance,
      status,
      priority,
      reason,
      recommended_action: action,
      effort_hours_estimate: effort,
      effort_breakdown: effortBreakdown,
      source_excerpt: req.source_excerpt || undefined,
      supporting_evidence: matchedEvidence,
      evidence_rationale: evidenceRationale,
      gap_type: gapType
    };
  });
}

/**
 * Calculate transparent match score and overview metrics
 * Formula:
 * - Importance weights: 'required' = 2.0, 'preferred' = 1.0
 * - Status attainment factors:
 *     Demonstrated = 100% (1.0)
 *     Self-reported = 50% (0.5) [Claimed/partial evidence]
 *     Needs improvement = 25% (0.25) [Partially complete]
 *     Unverified = 0% (0.0)
 * Score = sum(status_factor * importance_weight) / sum(importance_weight) * 100
 */
export function calculateSkillGapSummary(matchResults: TraceableMatchResult[]): SkillGapSummary {
  if (!matchResults || matchResults.length === 0) {
    return {
      total_assessed: 0,
      demonstrated_count: 0,
      self_reported_count: 0,
      needs_improvement_count: 0,
      unverified_count: 0,
      required_count: 0,
      preferred_count: 0,
      match_score: 0,
      calculation_explanation: 'No requirements defined for this role.',
      total_remediation_hours: 0
    };
  }

  let demonstratedCount = 0;
  let selfReportedCount = 0;
  let needsImprovementCount = 0;
  let unverifiedCount = 0;
  let requiredCount = 0;
  let preferredCount = 0;
  let weightedPointsEarned = 0;
  let totalPossiblePoints = 0;
  let totalRemediationHours = 0;

  for (const item of matchResults) {
    const isRequired = item.importance === 'required';
    const weight = isRequired ? 2.0 : 1.0;
    totalPossiblePoints += weight;

    if (isRequired) requiredCount++;
    else preferredCount++;

    totalRemediationHours += item.effort_hours_estimate;

    switch (item.status) {
      case 'Demonstrated':
        demonstratedCount++;
        weightedPointsEarned += 1.0 * weight;
        break;
      case 'Self-reported':
        selfReportedCount++;
        weightedPointsEarned += 0.5 * weight;
        break;
      case 'Needs improvement':
        needsImprovementCount++;
        weightedPointsEarned += 0.25 * weight;
        break;
      case 'Unverified':
      default:
        unverifiedCount++;
        weightedPointsEarned += 0.0 * weight;
        break;
    }
  }

  const rawScore = totalPossiblePoints > 0 ? (weightedPointsEarned / totalPossiblePoints) * 100 : 0;
  const matchScore = Math.round(rawScore);

  const calculationExplanation =
    `Calculated from ${matchResults.length} requirements: ` +
    `Demonstrated = 100%, Self-reported = 50%, Needs improvement = 25%, Unverified = 0%. ` +
    `Required skills are weighted 2× relative to preferred skills. ` +
    `Note: This is a diagnostic readiness heuristic, not an employment guarantee.`;

  return {
    total_assessed: matchResults.length,
    demonstrated_count: demonstratedCount,
    self_reported_count: selfReportedCount,
    needs_improvement_count: needsImprovementCount,
    unverified_count: unverifiedCount,
    required_count: requiredCount,
    preferred_count: preferredCount,
    match_score: matchScore,
    calculation_explanation: calculationExplanation,
    total_remediation_hours: totalRemediationHours
  };
}

/**
 * Calculate deadline feasibility matching backend SkillMatchingEngine
 */
export function calculateFeasibility(
  daysRemaining: number | null | undefined,
  studyHoursPerDay: number | null | undefined,
  matchResults: TraceableMatchResult[],
  applicationPrepHours: number = 4.0
): FeasibilityAssessment {
  const unmetItems = matchResults.filter(r => r.status !== 'Demonstrated');
  const allEstimates = unmetItems.map(r => r.effort_hours_estimate);
  const fullPlanEffort = Math.round((allEstimates.reduce((a, b) => a + b, 0) + applicationPrepHours) * 10) / 10;

  if (!daysRemaining || daysRemaining <= 0 || !studyHoursPerDay || studyHoursPerDay <= 0) {
    return {
      available_hours: 0,
      estimated_plan_effort_hours: fullPlanEffort,
      full_plan_effort_hours: fullPlanEffort,
      days_remaining: daysRemaining || 0,
      study_hours_per_day: studyHoursPerDay || 0,
      feasibility_band: 'Insufficient information',
      interpretation: 'Missing deadline date or daily study capacity prevents a meaningful feasibility comparison.',
      assumptions: ['Please define your target deadline and daily study commitment.'],
      suggested_scope: 'Define target deadline and study hours to calculate feasibility.',
      is_scoped_down: false,
      deferred_count: 0,
      deferred_hours: 0,
      sprint_skills: unmetItems.map(r => r.skill_name),
      deferred_skills: []
    };
  }

  const availableHours = Math.round(daysRemaining * studyHoursPerDay * 10) / 10;

  let sprintItems = [...unmetItems];
  let deferredItems: TraceableMatchResult[] = [];

  // Intelligent Sprint Scoping under tight deadlines (<= 7 days) or constrained capacity (<= 14 days)
  if (daysRemaining <= 7 || (daysRemaining <= 14 && availableHours < fullPlanEffort)) {
    const highPriorityItems = unmetItems.filter(
      r => r.priority === 'High' || r.importance === 'required'
    );
    const secondaryItems = unmetItems.filter(r => !highPriorityItems.includes(r));

    if (secondaryItems.length > 0 && highPriorityItems.length > 0) {
      sprintItems = highPriorityItems;
      deferredItems = secondaryItems;
    } else if (unmetItems.length > 1 && availableHours < fullPlanEffort) {
      // All items are high priority: keep top critical gaps that fit nearest to available sprint capacity
      const sorted = [...unmetItems].sort((a, b) => {
        const statusOrder: Record<string, number> = { 'Needs improvement': 1, 'Self-reported': 2, 'Unverified': 3 };
        const orderA = statusOrder[a.status] || 4;
        const orderB = statusOrder[b.status] || 4;
        if (orderA !== orderB) return orderA - orderB;
        return a.effort_hours_estimate - b.effort_hours_estimate;
      });
      const keepCount = Math.max(1, Math.min(sorted.length - 1, 2));
      sprintItems = sorted.slice(0, keepCount);
      deferredItems = sorted.slice(keepCount);
    }
  }

  const isScopedDown = deferredItems.length > 0;
  const sprintEstimates = sprintItems.map(r => r.effort_hours_estimate);
  const sprintPlanEffort = Math.round((sprintEstimates.reduce((a, b) => a + b, 0) + applicationPrepHours) * 10) / 10;
  const deferredHours = Math.round(Math.max(0, fullPlanEffort - sprintPlanEffort) * 10) / 10;

  const ratio = availableHours > 0 ? sprintPlanEffort / availableHours : 999.0;

  let band: FeasibilityBand = 'Likely feasible';
  let interpretation = '';
  let suggestedScope = '';

  if (ratio <= 0.85) {
    band = 'Likely feasible';
    interpretation = isScopedDown
      ? `Estimated sprint effort (${sprintPlanEffort} hrs) is comfortably below your available study capacity (${availableHours} hrs).`
      : `Estimated prioritized effort (${sprintPlanEffort} hrs) is comfortably below your available study capacity (${availableHours} hrs).`;
    suggestedScope = isScopedDown
      ? `Focus on your ${sprintItems.length} sprint deliverables. Steady daily progress will leave ~${Math.round((availableHours - sprintPlanEffort) * 10) / 10} hrs buffer.`
      : 'Focus on high-priority gaps and maintaining a consistent study cadence.';
  } else if (ratio <= 1.15) {
    band = 'Tight / uncertain';
    interpretation = isScopedDown
      ? `Estimated sprint effort (${sprintPlanEffort} hrs) closely matches available capacity (${availableHours} hrs).`
      : `Estimated effort (${sprintPlanEffort} hrs) is close to available time (${availableHours} hrs). Buffer is minimal if blockers arise.`;
    suggestedScope = isScopedDown
      ? `Sprint is tightly calibrated (${sprintItems.length} core gaps). Maintain daily consistency to deliver on time.`
      : 'Focus on the top 2 highest-value requirements first; defer secondary preferred skills.';
  } else {
    band = 'Not feasible as scoped';
    interpretation = `Estimated effort (${sprintPlanEffort} hrs) exceeds available time (${availableHours} hrs) before the target deadline.`;
    suggestedScope = 'Consider increasing daily study hours or extending target deadline to cover required deliverables.';
  }

  if (isScopedDown) {
    suggestedScope = `Urgent ${daysRemaining}-day deadline detected. Scope prioritized to ${sprintItems.length} core gap${sprintItems.length > 1 ? 's' : ''} (${sprintPlanEffort}h sprint effort vs ${fullPlanEffort}h full curriculum). Deferred ${deferredItems.length} topic${deferredItems.length > 1 ? 's' : ''} saving ~${deferredHours}h.`;
  }

  return {
    available_hours: availableHours,
    estimated_plan_effort_hours: sprintPlanEffort,
    full_plan_effort_hours: fullPlanEffort,
    days_remaining: daysRemaining,
    study_hours_per_day: studyHoursPerDay,
    feasibility_band: band,
    interpretation,
    is_scoped_down: isScopedDown,
    deferred_count: deferredItems.length,
    deferred_hours: deferredHours,
    sprint_skills: sprintItems.map(r => r.skill_name),
    deferred_skills: deferredItems.map(r => r.skill_name),
    assumptions: [
      `${daysRemaining} days remaining before application closing date`,
      `Assumes ${studyHoursPerDay} hours/day sustained study capacity (${Math.round(studyHoursPerDay * 7)} hrs/week)`,
      `Includes ${applicationPrepHours} hours for CV tailoring and portfolio review`
    ],
    suggested_scope: suggestedScope
  };
}

/**
 * Map evidence records to role requirements to uncover 1-to-many, many-to-1,
 * and unmapped transferable evidence items.
 */
export function buildEvidenceMapping(
  evidenceList: SkillEvidence[],
  requirements: Requirement[]
): {
  mapped_evidence: EvidenceSkillMap[];
  unmapped_evidence: SkillEvidence[];
} {
  const mappedList: EvidenceSkillMap[] = [];
  const unmappedList: SkillEvidence[] = [];

  for (const ev of evidenceList) {
    const supportedSkills: string[] = [];

    for (const req of requirements) {
      if (isSkillMatch(ev.skill_name, req.skill_name)) {
        supportedSkills.push(req.skill_name);
      }
    }

    if (supportedSkills.length > 0) {
      mappedList.push({
        evidence: ev,
        supported_skills: supportedSkills,
        is_mapped_to_role: true
      });
    } else {
      unmappedList.push(ev);
    }
  }

  return {
    mapped_evidence: mappedList,
    unmapped_evidence: unmappedList
  };
}
