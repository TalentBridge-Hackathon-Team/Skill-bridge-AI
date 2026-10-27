import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import RoadmapPage from '../pages/RoadmapPage';
import { skillGapService } from '../services/skillGapService';
import { MOCK_TARGET_ROLES } from './testFixtures';

describe('Roadmap and Practical Assessment Correlation (End-to-End Sync)', () => {
  const setActiveTabMock = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    setActiveTabMock.mockClear();
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.clear === 'function') {
      window.localStorage.clear();
    }

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
          requirement_id: 'rep_postgres',
          skill_name: 'PostgreSQL',
          category: 'database',
          importance: 'required' as const,
          status: 'Self-reported' as const,
          priority: 'High' as const,
          reason: 'Needs schema evidence',
          recommended_action: 'Build relational project with indexing and migrations',
          effort_hours_estimate: 8,
          supporting_evidence: [],
          evidence_rationale: 'Missing code verification',
          gap_type: 'missing_evidence' as const
        },
        {
          requirement_id: 'rep_auth',
          skill_name: 'Authentication & Security',
          category: 'security',
          importance: 'required' as const,
          status: 'Unverified' as const,
          priority: 'High' as const,
          reason: 'No token verification evidence',
          recommended_action: 'Demonstrate token lifecycle and RBAC',
          effort_hours_estimate: 6,
          supporting_evidence: [],
          evidence_rationale: 'Missing security verification',
          gap_type: 'missing_evidence' as const
        }
      ],
      summary: {
        total_assessed: 2,
        demonstrated_count: 0,
        self_reported_count: 1,
        needs_improvement_count: 0,
        unverified_count: 1,
        required_count: 2,
        preferred_count: 0,
        match_score: 25,
        calculation_explanation: 'Testing',
        total_remediation_hours: 14
      },
      feasibility: {
        available_hours: 28,
        estimated_plan_effort_hours: 14,
        days_remaining: 14,
        study_hours_per_day: 2.0,
        feasibility_band: 'likely_feasible' as const,
        interpretation: 'Feasible within available study capacity',
        assumptions: ['2 hrs/day study pacing'],
        is_scoped_down: false
      } as any,
      evidence_mapping: { mapped_evidence: [], unmapped_evidence: [] },
      is_live_backend: true
    });
  });

  it('initially displays pending status and "Launch Assessment" button for unverified skill', async () => {
    render(<RoadmapPage setActiveTab={setActiveTabMock} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Complete PostgreSQL Practical Assessment/i).length).toBeGreaterThan(0);
    });

    // In uncompleted state, Launch Assessment button is present
    const launchButtons = screen.getAllByRole('button', { name: /Launch Assessment/i });
    expect(launchButtons.length).toBeGreaterThan(0);

    // Initial tasks completed: 0/2
    expect(screen.getByText('0/2')).toBeInTheDocument();
  });

  it('updates RoadmapTask to completed with "Review Rubric" and badge upon receiving assessment passing event', async () => {
    render(<RoadmapPage setActiveTab={setActiveTabMock} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Complete PostgreSQL Practical Assessment/i).length).toBeGreaterThan(0);
    });

    // Simulate grading and passing PostgreSQL assessment (score >= 8/10)
    act(() => {
      window.dispatchEvent(
        new CustomEvent('skillbridge_assessment_passed', {
          detail: {
            skill: 'PostgreSQL',
            score: 9,
            result: {
              status: 'passed',
              score: 9,
              max_score: 10
            }
          }
        })
      );
    });

    // Verify task title updates to Verified: PostgreSQL Practical Deliverable
    await waitFor(() => {
      expect(screen.getByText(/Verified: PostgreSQL Practical Deliverable/i)).toBeInTheDocument();
    });

    // Verify task count advances to 1/2 completed
    expect(screen.getByText('1/2')).toBeInTheDocument();

    // Verify the action button changes from "Launch Assessment" to "Review Rubric"
    expect(screen.getByText(/Review Rubric/i)).toBeInTheDocument();

    // Verify Demonstrated Evidence badge is rendered on the task card
    expect(screen.getByText(/Demonstrated Evidence/i)).toBeInTheDocument();
  });

  it('advances next recommended action to the remaining uncompleted skill gap after passing', async () => {
    render(<RoadmapPage setActiveTab={setActiveTabMock} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Complete PostgreSQL Practical Assessment/i).length).toBeGreaterThan(0);
    });

    // Pass PostgreSQL assessment
    act(() => {
      window.dispatchEvent(
        new CustomEvent('skillbridge_assessment_passed', {
          detail: { skill: 'PostgreSQL', score: 10 }
        })
      );
    });

    // The remaining uncompleted task is Authentication & Security
    await waitFor(() => {
      expect(screen.getAllByText(/Complete Authentication & Security Practical Assessment/i).length).toBeGreaterThan(0);
    });

    // Now pass the second skill (Authentication & Security)
    act(() => {
      window.dispatchEvent(
        new CustomEvent('skillbridge_assessment_passed', {
          detail: { skill: 'Authentication & Security', score: 10 }
        })
      );
    });

    // All tasks completed: shows celebratory banner
    await waitFor(() => {
      expect(screen.getByText(/All Roadmap Practical Deliverables Verified!/i)).toBeInTheDocument();
    });
    expect(screen.getByText('2/2')).toBeInTheDocument();
  });
});
