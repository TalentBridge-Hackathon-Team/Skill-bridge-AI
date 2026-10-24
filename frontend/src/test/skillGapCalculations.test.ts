import { describe, it, expect } from 'vitest';
import {
  normalizeSkill,
  isSkillMatch,
  parseUserSkills,
  getSkillComplexity,
  findAdjacentTransferableSkill,
  calculateAssessmentScaling,
  matchRequirementsToProfile,
  calculateSkillGapSummary,
  calculateFeasibility,
  buildEvidenceMapping
} from '../utils/skillGapCalculations';
import type { Requirement, UserProfile, SkillEvidence } from '../types';

describe('Skill Gap Calculations (Member 3 Logic)', () => {
  describe('Skill Normalization & Alias Matching', () => {
    it('normalizes skill names with punctuation and whitespace', () => {
      expect(normalizeSkill(' Django-REST_Framework / 2.0 ')).toBe('django rest framework 2 0');
    });

    it('matches exact and alias skills', () => {
      expect(isSkillMatch('PostgreSQL', 'postgres')).toBe(true);
      expect(isSkillMatch('postgresql', 'psql')).toBe(true);
      expect(isSkillMatch('Django REST Framework', 'DRF')).toBe(true);
      expect(isSkillMatch('React', 'reactjs')).toBe(true);
      expect(isSkillMatch('TypeScript', 'Python')).toBe(false);
    });

    it('parses comma-separated and array skills safely', () => {
      expect(parseUserSkills('Python, Django, PostgreSQL')).toEqual(['Python', 'Django', 'PostgreSQL']);
      expect(parseUserSkills(['Python', 'Git'])).toEqual(['Python', 'Git']);
      expect(parseUserSkills(null)).toEqual([]);
      expect(parseUserSkills(undefined)).toEqual([]);
    });
  });

  describe('Deterministic Matching Engine', () => {
    const mockRequirements: Requirement[] = [
      {
        id: 'req_1',
        requirement_id: 'req_1',
        skill_name: 'Django REST Framework',
        category: 'framework',
        importance: 'required',
        source_excerpt: 'Build robust REST APIs'
      },
      {
        id: 'req_2',
        requirement_id: 'req_2',
        skill_name: 'PostgreSQL',
        category: 'database',
        importance: 'required',
        source_excerpt: 'Write SQL queries'
      },
      {
        id: 'req_3',
        requirement_id: 'req_3',
        skill_name: 'API Testing',
        category: 'testing',
        importance: 'required',
        source_excerpt: 'Automated test suites'
      },
      {
        id: 'req_4',
        requirement_id: 'req_4',
        skill_name: 'Docker',
        category: 'devops',
        importance: 'preferred',
        source_excerpt: 'Containerization'
      }
    ];

    it('identifies Demonstrated status for verified project evidence', () => {
      const profile: Partial<UserProfile> = {
        skills: ['Django REST Framework'],
        evidence: [
          {
            id: 'e1',
            skill_name: 'Django REST Framework',
            title: 'E-commerce API',
            evidence_type: 'project',
            review_status: 'verified'
          }
        ]
      };

      const results = matchRequirementsToProfile(mockRequirements, profile);
      const drfMatch = results.find(r => r.skill_name === 'Django REST Framework');

      expect(drfMatch).toBeDefined();
      expect(drfMatch?.status).toBe('Demonstrated');
      expect(drfMatch?.priority).toBe('Low');
      expect(drfMatch?.effort_hours_estimate).toBe(0);
      expect(drfMatch?.gap_type).toBe('demonstrated');
    });

    it('identifies Self-reported status when skill is claimed without verified project evidence', () => {
      const profile: Partial<UserProfile> = {
        skills: 'Python, PostgreSQL',
        evidence: []
      };

      const results = matchRequirementsToProfile(mockRequirements, profile);
      const pgMatch = results.find(r => r.skill_name === 'PostgreSQL');

      expect(pgMatch).toBeDefined();
      expect(pgMatch?.status).toBe('Self-reported');
      expect(pgMatch?.priority).toBe('High');
      expect(pgMatch?.effort_hours_estimate).toBe(8);
      expect(pgMatch?.gap_type).toBe('missing_evidence');
    });

    it('identifies Needs improvement status from assessment scores below threshold with granular scaling', () => {
      const profile: Partial<UserProfile> = { skills: [] };
      const assessments = [{ target_skill: 'API Testing', score: 6 }];

      const results = matchRequirementsToProfile(mockRequirements, profile, assessments);
      const testMatch = results.find(r => r.skill_name === 'API Testing');

      expect(testMatch).toBeDefined();
      expect(testMatch?.status).toBe('Needs improvement');
      expect(testMatch?.priority).toBe('High');
      // baseHours 5.0 * testing complexity 0.8 * scaling 0.4 = 1.6 hrs
      expect(testMatch?.effort_hours_estimate).toBe(1.6);
      expect(testMatch?.gap_type).toBe('needs_reinforcement');
      expect(testMatch?.effort_breakdown).toBeDefined();
      expect(testMatch?.effort_breakdown?.assessment_scaling_factor).toBe(0.4);
    });

    it('identifies Unverified status and applies category complexity multiplier', () => {
      const profile: Partial<UserProfile> = { skills: [] };

      const results = matchRequirementsToProfile(mockRequirements, profile);
      const dockerMatch = results.find(r => r.skill_name === 'Docker');

      expect(dockerMatch).toBeDefined();
      expect(dockerMatch?.status).toBe('Unverified');
      expect(dockerMatch?.priority).toBe('Medium');
      // baseHours 6.0 * devops complexity 1.4 = 8.4 hrs
      expect(dockerMatch?.effort_hours_estimate).toBe(8.4);
      expect(dockerMatch?.gap_type).toBe('missing_skill');
      expect(dockerMatch?.effort_breakdown?.complexity_multiplier).toBe(1.4);
    });

    it('applies generic adjacent skill transferability discount across tools in same family', () => {
      // User has verified PostgreSQL; role requires MySQL (both in relational_db family)
      const reqs: Requirement[] = [
        {
          id: 'req_mysql',
          requirement_id: 'req_mysql',
          skill_name: 'MySQL',
          category: 'database',
          importance: 'required'
        }
      ];
      const profile: Partial<UserProfile> = {
        evidence: [
          {
            id: 'ev_pg',
            skill_name: 'PostgreSQL',
            title: 'Production SQL Schema',
            review_status: 'verified',
            evidence_type: 'project'
          }
        ]
      };

      const results = matchRequirementsToProfile(reqs, profile);
      const mysqlMatch = results[0];

      expect(mysqlMatch).toBeDefined();
      expect(mysqlMatch.status).toBe('Unverified');
      // Base: 6.0h * 1.0 (database) * (1 - 0.40 discount from PostgreSQL) = 3.6 hrs
      expect(mysqlMatch.effort_hours_estimate).toBe(3.6);
      expect(mysqlMatch.effort_breakdown?.adjacent_skill_discount).toBe(0.4);
      expect(mysqlMatch.effort_breakdown?.adjacent_skill_name).toBe('PostgreSQL');
    });

    it('scales assessment effort continuously (score 7/10 needs fewer hours than score 2/10)', () => {
      const reqs: Requirement[] = [
        { id: 'r1', skill_name: 'Python', category: 'language', importance: 'required' }
      ];

      const highResult = matchRequirementsToProfile(reqs, null, [{ target_skill: 'Python', score: 7 }]);
      const lowResult = matchRequirementsToProfile(reqs, null, [{ target_skill: 'Python', score: 2 }]);

      // Score 7: factor 0.3 -> 5.0 * 1.0 * 0.3 = 1.5h
      expect(highResult[0].effort_hours_estimate).toBe(1.5);
      // Score 2: factor 0.8 -> 5.0 * 1.0 * 0.8 = 4.0h
      expect(lowResult[0].effort_hours_estimate).toBe(4.0);
      expect(highResult[0].effort_hours_estimate).toBeLessThan(lowResult[0].effort_hours_estimate);
    });

    it('handles empty requirements gracefully', () => {
      const results = matchRequirementsToProfile([], null);
      expect(results).toEqual([]);
    });

    it('works generically for ANY unknown or future tool complexity', () => {
      // 1. Novel tool with standard category
      expect(getSkillComplexity('cloud', 'SomeBrandNewCloudProvider').multiplier).toBe(1.4);
      expect(getSkillComplexity('testing', 'FutureFrameworkTester').multiplier).toBe(0.8);
      expect(getSkillComplexity('tools', 'CustomLinterCLI').multiplier).toBe(0.5);
      expect(getSkillComplexity('distributed_systems', 'QuantumConsensusMesh').multiplier).toBe(1.8);

      // 2. Novel tool with missing/generic category classified via token stems
      expect(getSkillComplexity('general', 'MyCustomLinter').multiplier).toBe(0.5); // "linter" token
      expect(getSkillComplexity('general', 'DeepLearningInferenceNode').multiplier).toBe(1.8); // "deep learning"
      expect(getSkillComplexity('general', 'K8sPodTelemetryDeployer').multiplier).toBe(1.4); // "k8s" / "telemetry"

      // 3. Completely unrecognized tool defaults safely to 1.0
      expect(getSkillComplexity('general', 'CompletelyNovelArbitraryToolXYZ').multiplier).toBe(1.0);
    });

    it('works generically for ANY unknown or future tool adjacent transferability', () => {
      // Novel database tool "SurrealDB" matches verified "PostgreSQL" via shared database paradigm
      const match = findAdjacentTransferableSkill('SurrealDB', ['PostgreSQL']);
      expect(match).not.toBeNull();
      expect(match?.discount).toBe(0.35);
      expect(match?.adjacentSkill).toBe('PostgreSQL');
      expect(match?.rationale).toContain('database');

      // Novel message streaming tool "NovelQueueBroker" matches verified "RabbitMQ"
      const mqMatch = findAdjacentTransferableSkill('NovelQueueBroker', ['RabbitMQ']);
      expect(mqMatch).not.toBeNull();
      expect(mqMatch?.discount).toBe(0.35);
      expect(mqMatch?.adjacentSkill).toBe('RabbitMQ');

      // Category-level fallback transferability
      const catMatch = findAdjacentTransferableSkill(
        'ProprietaryWidgetEngine',
        ['ExistingWidgetTool'],
        'frontend',
        { ExistingWidgetTool: 'frontend' }
      );
      expect(catMatch).not.toBeNull();
      expect(catMatch?.discount).toBe(0.30);
    });

    it('works universally for ANY assessment scoring scale (0-10, percentage 0-100, ratio 0.0-1.0)', () => {
      // 0-10 scale
      expect(calculateAssessmentScaling(8.5)).toBe(0.0); // demonstrated
      expect(calculateAssessmentScaling(7.0)).toBe(0.30); // 10 - 7 = 3 / 10 = 0.30
      expect(calculateAssessmentScaling(0.0)).toBe(1.0);

      // 0-100 percentage scale
      expect(calculateAssessmentScaling(85)).toBe(0.0); // 85% -> 8.5 -> demonstrated
      expect(calculateAssessmentScaling(70)).toBe(0.30); // 70% -> 7.0 -> 0.30
      expect(calculateAssessmentScaling(50)).toBe(0.50); // 50% -> 5.0 -> 0.50

      // 0.0-1.0 ratio scale
      expect(calculateAssessmentScaling(0.85)).toBe(0.0); // 0.85 -> 8.5 -> demonstrated
      expect(calculateAssessmentScaling(0.70)).toBe(0.30); // 0.70 -> 7.0 -> 0.30
      expect(calculateAssessmentScaling(0.40)).toBe(0.60); // 0.40 -> 4.0 -> 0.60
    });
  });

  describe('Skill Gap Summary & Match Score', () => {
    it('calculates weighted match score and metric breakdown correctly', () => {
      const mockResults = [
        {
          requirement_id: '1',
          skill_name: 'Skill A',
          category: 'framework',
          importance: 'required' as const,
          status: 'Demonstrated' as const,
          priority: 'Low' as const,
          reason: 'Verified',
          recommended_action: 'None',
          effort_hours_estimate: 0,
          supporting_evidence: [],
          evidence_rationale: '',
          gap_type: 'demonstrated' as const
        },
        {
          requirement_id: '2',
          skill_name: 'Skill B',
          category: 'database',
          importance: 'required' as const,
          status: 'Self-reported' as const,
          priority: 'High' as const,
          reason: 'Claimed',
          recommended_action: 'Link repo',
          effort_hours_estimate: 8,
          supporting_evidence: [],
          evidence_rationale: '',
          gap_type: 'missing_evidence' as const
        },
        {
          requirement_id: '3',
          skill_name: 'Skill C',
          category: 'devops',
          importance: 'preferred' as const,
          status: 'Unverified' as const,
          priority: 'Medium' as const,
          reason: 'Missing',
          recommended_action: 'Assess',
          effort_hours_estimate: 6,
          supporting_evidence: [],
          evidence_rationale: '',
          gap_type: 'missing_skill' as const
        }
      ];

      const summary = calculateSkillGapSummary(mockResults);

      expect(summary.total_assessed).toBe(3);
      expect(summary.demonstrated_count).toBe(1);
      expect(summary.self_reported_count).toBe(1);
      expect(summary.unverified_count).toBe(1);
      expect(summary.required_count).toBe(2);
      expect(summary.preferred_count).toBe(1);
      expect(summary.total_remediation_hours).toBe(14); // 0 + 8 + 6

      // Weights:
      // Req 1 (required): 1.0 * 2.0 = 2.0
      // Req 2 (required): 0.5 * 2.0 = 1.0
      // Req 3 (preferred): 0.0 * 1.0 = 0.0
      // Total earned: 3.0 / Total possible: (2.0 + 2.0 + 1.0 = 5.0) -> 3.0 / 5.0 = 60%
      expect(summary.match_score).toBe(60);
    });

    it('handles empty results without division by zero', () => {
      const summary = calculateSkillGapSummary([]);
      expect(summary.match_score).toBe(0);
      expect(summary.total_assessed).toBe(0);
    });
  });

  describe('Deadline Feasibility Assessment', () => {
    const mockResults = [
      {
        requirement_id: '1',
        skill_name: 'Skill A',
        category: 'framework',
        importance: 'required' as const,
        status: 'Demonstrated' as const,
        priority: 'Low' as const,
        reason: '',
        recommended_action: '',
        effort_hours_estimate: 0,
        supporting_evidence: [],
        evidence_rationale: '',
        gap_type: 'demonstrated' as const
      },
      {
        requirement_id: '2',
        skill_name: 'Skill B',
        category: 'database',
        importance: 'required' as const,
        status: 'Self-reported' as const,
        priority: 'High' as const,
        reason: '',
        recommended_action: '',
        effort_hours_estimate: 8,
        supporting_evidence: [],
        evidence_rationale: '',
        gap_type: 'missing_evidence' as const
      }
    ];

    it('evaluates "Likely feasible" when effort is well below available capacity', () => {
      // 14 days * 2 hrs/day = 28 hrs available
      // Plan effort = 8 hrs + 4 hrs app prep = 12 hrs
      // Ratio = 12 / 28 = 0.43 (<= 0.85)
      const assessment = calculateFeasibility(14, 2.0, mockResults);
      expect(assessment.feasibility_band).toBe('Likely feasible');
      expect(assessment.available_hours).toBe(28);
      expect(assessment.estimated_plan_effort_hours).toBe(12);
    });

    it('evaluates "Tight / uncertain" when effort is close to capacity', () => {
      // 6 days * 2 hrs/day = 12 hrs available
      // Plan effort = 8 + 4 = 12 hrs
      // Ratio = 12 / 12 = 1.0 (<= 1.15)
      const assessment = calculateFeasibility(6, 2.0, mockResults);
      expect(assessment.feasibility_band).toBe('Tight / uncertain');
    });

    it('evaluates "Not feasible as scoped" when effort exceeds capacity', () => {
      // 3 days * 2 hrs/day = 6 hrs available
      // Plan effort = 8 + 4 = 12 hrs
      // Ratio = 12 / 6 = 2.0 (> 1.15)
      const assessment = calculateFeasibility(3, 2.0, mockResults);
      expect(assessment.feasibility_band).toBe('Not feasible as scoped');
    });

    it('returns "Insufficient information" when days or study hours are invalid', () => {
      const assessment1 = calculateFeasibility(0, 2.0, mockResults);
      expect(assessment1.feasibility_band).toBe('Insufficient information');

      const assessment2 = calculateFeasibility(14, 0, mockResults);
      expect(assessment2.feasibility_band).toBe('Insufficient information');
    });
  });

  describe('Evidence Mapping & Relationships', () => {
    it('correctly maps 1-to-many and identifies unmapped transferable evidence', () => {
      const evidenceList: SkillEvidence[] = [
        {
          id: 'e1',
          skill_name: 'Python',
          title: 'Algorithmic Solutions',
          evidence_type: 'project',
          review_status: 'verified'
        },
        {
          id: 'e2',
          skill_name: 'GraphQL',
          title: 'Apollo GraphQL Server',
          evidence_type: 'project',
          review_status: 'verified'
        }
      ];

      const requirements: Requirement[] = [
        {
          id: 'r1',
          skill_name: 'Python',
          category: 'language',
          importance: 'required',
          source_excerpt: 'Python'
        }
      ];

      const mapping = buildEvidenceMapping(evidenceList, requirements);
      expect(mapping.mapped_evidence.length).toBe(1);
      expect(mapping.mapped_evidence[0].evidence.title).toBe('Algorithmic Solutions');
      expect(mapping.unmapped_evidence.length).toBe(1);
      expect(mapping.unmapped_evidence[0].title).toBe('Apollo GraphQL Server');
    });
  });
});
