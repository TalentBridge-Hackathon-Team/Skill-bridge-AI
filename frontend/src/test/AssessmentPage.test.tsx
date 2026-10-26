import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AssessmentPage from '../pages/AssessmentPage';
import { skillGapService } from '../services/skillGapService';
import { MOCK_TARGET_ROLES } from '../services/mockSkillGapData';

describe('AssessmentPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(skillGapService, 'getTargetRoles').mockResolvedValue(MOCK_TARGET_ROLES);
    vi.spyOn(skillGapService, 'runAnalysis').mockResolvedValue({
      role: MOCK_TARGET_ROLES[0],
      profile: {
        user_id: 'usr_demo_001',
        name: 'Demo User',
        target_role: 'Junior Backend Developer',
        education: 'B.Sc.',
        skills: ['Python'],
        evidence: []
      },
      results: [
        {
          requirement_id: 'rep_2',
          skill_name: 'PostgreSQL',
          category: 'database',
          importance: 'required' as const,
          status: 'Self-reported' as const,
          priority: 'High' as const,
          reason: 'Missing evidence',
          recommended_action: 'Build project',
          effort_hours_estimate: 8,
          supporting_evidence: [],
          evidence_rationale: 'Missing code verification',
          gap_type: 'missing_evidence' as const
        }
      ] as any,
      summary: {
        total_assessed: 1,
        demonstrated_count: 0,
        self_reported_count: 1,
        needs_improvement_count: 0,
        unverified_count: 0,
        required_count: 1,
        preferred_count: 0,
        match_score: 50,
        calculation_explanation: 'Test',
        total_remediation_hours: 8
      } as any,
      feasibility: {
        available_hours: 40,
        estimated_plan_effort_hours: 8,
        days_remaining: 14,
        study_hours_per_day: 0.57,
        feasibility_band: 'Likely feasible' as const,
        interpretation: 'Feasible',
        assumptions: []
      } as any
    } as any);
  });

  it('renders without crashing and displays real skill gap tabs', async () => {
    render(<AssessmentPage />);
    await waitFor(() => {
      expect(screen.getByText(/Practical Tasks & Skill Gap Assessments/i)).toBeInTheDocument();
    });
    expect(screen.getAllByText('PostgreSQL').length).toBeGreaterThan(0);
  });

  it('evaluates submission without crashing the page', async () => {
    // Mock successful backend response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        submission_id: 'sub_test_123',
        task_id: 'asm_postgresql',
        target_skill: 'PostgreSQL',
        user_id: 'usr_demo_001',
        submission_type: 'code',
        score: 9,
        max_score: 10,
        status: 'passed',
        criteria_breakdown: [
          {
            id: 'c1_schema',
            name: 'Relational Schema & Constraints',
            score: 2,
            max_score: 2,
            passed: true,
            feedback: 'Verified schema'
          }
        ],
        overall_feedback: 'Outstanding schema deliverable!',
        roadmap_sync: {
          roadmap_updated: true,
          evidence_created: true
        }
      })
    }) as any;

    render(<AssessmentPage />);

    await waitFor(() => {
      expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    });

    const evalButton = screen.getByRole('button', { name: /Evaluate PostgreSQL Deliverable/i });
    expect(evalButton).toBeInTheDocument();

    fireEvent.click(evalButton);

    await waitFor(() => {
      expect(screen.getByText(/9\/10/i)).toBeInTheDocument();
    });

    // Page must NOT vanish - main heading still present
    expect(screen.getByText(/Practical Tasks & Skill Gap Assessments/i)).toBeInTheDocument();
  });

  it('handles evaluation failure or score < 8 without crashing', async () => {
    // Mock backend returning failing evaluation
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        submission_id: 'sub_fail_123',
        task_id: 'asm_postgresql',
        target_skill: 'PostgreSQL',
        user_id: 'usr_demo_001',
        submission_type: 'code',
        score: 6,
        max_score: 10,
        status: 'failed',
        criteria_breakdown: [
          {
            id: 'c1_schema',
            name: 'Relational Schema & Constraints',
            score: 1,
            max_score: 2,
            passed: false,
            feedback: 'Missing foreign key constraints'
          }
        ],
        overall_feedback: 'Needs improvement in constraints.',
        personalized_support: {
          title: 'Targeted Mastery: PostgreSQL',
          concept: 'PostgreSQL Core Competency',
          target_skill: 'PostgreSQL',
          user_preference: 'visual',
          struggle_detected: true,
          interactive_flow_steps: [
            { step: 1, title: '1. Schema', detail: 'Schema details', highlight: 'Highlight' }
          ]
        }
      })
    }) as any;

    render(<AssessmentPage />);

    await waitFor(() => {
      expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    });

    const evalButton = screen.getByRole('button', { name: /Evaluate PostgreSQL Deliverable/i });
    fireEvent.click(evalButton);

    await waitFor(() => {
      expect(screen.getByText(/6\/10/i)).toBeInTheDocument();
    });

    // Personalized AI micro-lesson should appear
    expect(screen.getByText(/Personalized AI Micro-Lesson: PostgreSQL/i)).toBeInTheDocument();
    expect(screen.getByText(/Practical Tasks & Skill Gap Assessments/i)).toBeInTheDocument();

    // Verify Experience Level buttons exist
    expect(screen.getByRole('button', { name: /beginner/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /intermediate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /advanced/i })).toBeInTheDocument();

    // Verify the permanent continuous simulator is NOT present
    expect(screen.queryByText(/Architecture & Execution Lifecycle Simulator/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Play Live Animation/i)).not.toBeInTheDocument();
  });

  it('allows switching experience level and chatting with Socratic AI Mentor', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      const u = String(url);
      if (u.includes('/api/assessments/micro-lesson/chat/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            reply: 'In PostgreSQL, think of boundary checks like a bouncer at a club entrance.',
            socraticQuestion: 'How will your deliverable test this boundary before data access?',
            conceptAnimation: {
              type: 'boundary_check',
              title: 'Interactive Concept Animation: PostgreSQL Verification Boundary',
              description: 'Watch how requests are validated and rejected at the gateway perimeter.'
            },
            chat_history: [
              { id: 'm_1', sender: 'mentor', text: 'In PostgreSQL, think of boundary checks like a bouncer at a club entrance.' }
            ],
            unlocked_hint_level: 1,
            experience_level: 'beginner',
            learning_preference: 'visual'
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          submission_id: 'sub_fail_1',
          task_id: 'asm_postgresql',
          target_skill: 'PostgreSQL',
          score: 5,
          max_score: 10,
          status: 'failed',
          criteria_breakdown: [],
          overall_feedback: 'Needs improvement'
        })
      });
    }) as any;

    render(<AssessmentPage />);

    await waitFor(() => {
      expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    });

    const evalButton = screen.getByRole('button', { name: /Evaluate PostgreSQL Deliverable/i });
    fireEvent.click(evalButton);

    await waitFor(() => {
      expect(screen.getByText(/Personalized AI Micro-Lesson: PostgreSQL/i)).toBeInTheDocument();
    });

    // Switch experience level to beginner
    const beginnerBtn = screen.getByRole('button', { name: /beginner/i });
    fireEvent.click(beginnerBtn);
    expect(beginnerBtn).toBeInTheDocument();

    // Click boundary check quick chip
    const chip = screen.getByRole('button', { name: /Why boundary checks\?/i });
    fireEvent.click(chip);

    await waitFor(() => {
      expect(screen.getByText(/think of boundary checks like a bouncer/i)).toBeInTheDocument();
    });
  });

  it('visibly adapts chat and guidance when switching between experience levels and assistance styles', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          submission_id: 'sub_fail_2',
          task_id: 'asm_postgresql',
          target_skill: 'PostgreSQL',
          score: 5,
          max_score: 10,
          status: 'failed',
          criteria_breakdown: [],
          overall_feedback: 'Needs improvement'
        })
      })
    ) as any;

    render(<AssessmentPage />);

    await waitFor(() => {
      expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    });

    const evalButton = screen.getByRole('button', { name: /Evaluate PostgreSQL Deliverable/i });
    fireEvent.click(evalButton);

    await waitFor(() => {
      expect(screen.getByText(/Personalized AI Micro-Lesson: PostgreSQL/i)).toBeInTheDocument();
    });

    // 1. Switch level to Advanced
    const advancedBtn = screen.getByRole('button', { name: /^advanced$/i });
    fireEvent.click(advancedBtn);
    expect(screen.getByText(/Experience Level set to Advanced/i)).toBeInTheDocument();

    // 2. Switch assistance style to Visual
    const visualBtns = screen.getAllByRole('button', { name: /visual/i });
    fireEvent.click(visualBtns[visualBtns.length - 1]);
    expect(screen.getByText(/Style updated to Visual Mode/i)).toBeInTheDocument();

    // 3. Switch assistance style to Hands-on
    const handsOnBtns = screen.getAllByRole('button', { name: /hands-on/i });
    fireEvent.click(handsOnBtns[handsOnBtns.length - 1]);
    expect(screen.getByText(/Style updated to Hands-on Mode/i)).toBeInTheDocument();

    // 4. Switch assistance style to Socratic
    const socraticBtns = screen.getAllByRole('button', { name: /socratic/i });
    fireEvent.click(socraticBtns[socraticBtns.length - 1]);
    expect(screen.getByText(/Style updated to Socratic Mode/i)).toBeInTheDocument();
  });

  it('accurately detects PyTorch/ML domain and prevents web API hallucinations in Socratic mentor guidance', async () => {
    window.history.pushState({}, '', '?skill=PyTorch');
    vi.spyOn(skillGapService, 'runAnalysis').mockResolvedValue({
      role: { id: 'role_ai_engineer', role_title: 'Machine Learning Engineer', mode: 'goal_based', level: 'Junior', department: 'AI', days_remaining: 14, study_hours_per_week: 20, summary: '', job_text: '', requirements: [] } as any,
      profile: { user_id: 'usr_ai', name: 'AI Learner', target_role: 'Machine Learning Engineer', education: 'B.Sc.', skills: [], evidence: [] },
      results: [
        {
          requirement_id: 'req_pytorch',
          skill_name: 'PyTorch',
          category: 'ai_ml',
          importance: 'required' as const,
          status: 'Self-reported' as const,
          priority: 'High' as const,
          reason: 'Missing evidence',
          recommended_action: 'Build project',
          effort_hours_estimate: 10,
          supporting_evidence: [],
          evidence_rationale: 'Missing code verification',
          gap_type: 'missing_evidence' as const
        }
      ] as any,
      summary: { total_assessed: 1, demonstrated_count: 0, self_reported_count: 1, needs_improvement_count: 0, unverified_count: 0, required_count: 1, preferred_count: 0, match_score: 50, calculation_explanation: 'Test', total_remediation_hours: 10 } as any,
      feasibility: { available_hours: 40, estimated_plan_effort_hours: 10, days_remaining: 14, study_hours_per_day: 0.71, feasibility_band: 'Likely feasible' as const, interpretation: 'Feasible', assumptions: [] } as any
    } as any);

    global.fetch = vi.fn().mockImplementation((url) => {
      const u = String(url);
      if (u.includes('/micro-lesson/chat/')) {
        return Promise.reject(new Error('Network error testing client fallback'));
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          submission_id: 'sub_pytorch',
          task_id: 'asm_pytorch',
          target_skill: 'PyTorch',
          score: 5,
          max_score: 10,
          status: 'failed',
          criteria_breakdown: [],
          overall_feedback: 'Needs improvement'
        })
      });
    }) as any;

    render(<AssessmentPage />);

    await waitFor(() => {
      expect(screen.getAllByText('PyTorch').length).toBeGreaterThan(0);
    });

    const evalButton = screen.getByRole('button', { name: /Evaluate PyTorch Deliverable/i });
    fireEvent.click(evalButton);

    await waitFor(() => {
      expect(screen.getByText(/Personalized AI Micro-Lesson: PyTorch/i)).toBeInTheDocument();
    });

    // 1. Verify PyTorch specific topic preset chips appear
    expect(screen.getByRole('button', { name: /Autograd & Computational Graph/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Why optimizer\.zero_grad\(\)\?/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CUDA Out-Of-Memory & loss\.item\(\)/i })).toBeInTheDocument();

    // 2. Click Autograd preset chip
    const autogradChip = screen.getByRole('button', { name: /Autograd & Computational Graph/i });
    fireEvent.click(autogradChip);

    await waitFor(() => {
      // Must contain deep learning concepts
      expect(screen.getByText(/lifecycle of a neural network training iteration/i)).toBeInTheDocument();
    });

    // Must NOT contain web API hallucinations
    expect(screen.queryByText(/Django Middleware/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/403 Forbidden/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Response Serializer/i)).not.toBeInTheDocument();

    // 3. Click Run training loop animation chip
    const animChip = screen.getByRole('button', { name: /Run training loop animation/i });
    fireEvent.click(animChip);

    await waitFor(() => {
      expect(screen.getByText(/Interactive Deep Learning Flow: PyTorch/i)).toBeInTheDocument();
      expect(screen.getByText(/1\. DataLoader/i)).toBeInTheDocument();
      expect(screen.getByText(/2\. Forward Pass/i)).toBeInTheDocument();
      expect(screen.getByText(/3\. Loss Criterion/i)).toBeInTheDocument();
      expect(screen.getByText(/4\. Autograd ∇W/i)).toBeInTheDocument();
    });

    // 4. Switch to Hands-on mode and verify PyTorch specific test assertions
    const handsOnBtns = screen.getAllByRole('button', { name: /hands-on/i });
    fireEvent.click(handsOnBtns[handsOnBtns.length - 1]);

    await waitFor(() => {
      expect(screen.getAllByText(/Style updated to Hands-on Mode/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/assert outputs/i).length).toBeGreaterThan(0);
    });

    expect(screen.queryByText(/Django/i)).not.toBeInTheDocument();
    window.history.pushState({}, '', '/');
  });
});
