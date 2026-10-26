import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RoadmapPage from '../pages/RoadmapPage';
import { skillGapService } from '../services/skillGapService';
import { MOCK_TARGET_ROLES } from '../services/mockSkillGapData';

describe('RoadmapPage Component (Member 4)', () => {
  const setActiveTabMock = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    setActiveTabMock.mockClear();

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
          requirement_id: 'rep_1',
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
          requirement_id: 'rep_2',
          skill_name: 'Authentication & Security',
          category: 'security',
          importance: 'required' as const,
          status: 'Missing' as const,
          priority: 'High' as const,
          reason: 'No token verification evidence',
          recommended_action: 'Demonstrate token lifecycle and RBAC',
          effort_hours_estimate: 6,
          supporting_evidence: [],
          evidence_rationale: 'Missing security verification',
          gap_type: 'missing_evidence' as const
        },
        {
          requirement_id: 'rep_3',
          skill_name: 'Python',
          category: 'language',
          importance: 'required' as const,
          status: 'Demonstrated' as const,
          priority: 'Low' as const,
          reason: 'Verified',
          recommended_action: 'Ready',
          effort_hours_estimate: 0,
          supporting_evidence: [],
          evidence_rationale: 'Verified repository attached',
          gap_type: 'demonstrated' as const
        }
      ] as any,
      summary: {
        total_assessed: 3,
        demonstrated_count: 1,
        self_reported_count: 1,
        needs_improvement_count: 0,
        unverified_count: 1,
        required_count: 3,
        preferred_count: 0,
        match_score: 33.3,
        calculation_explanation: 'Testing',
        total_remediation_hours: 14
      } as any,
      feasibility: {
        available_hours: 40,
        estimated_plan_effort_hours: 14,
        days_remaining: 14,
        study_hours_per_day: 1.0,
        feasibility_band: 'Likely feasible' as const,
        interpretation: 'Feasible',
        assumptions: []
      } as any
    } as any);
  });

  it('renders Roadmap correlated with real skill gaps', async () => {
    render(<RoadmapPage setActiveTab={setActiveTabMock} />);

    // Wait for dynamic tasks to populate from runAnalysis
    await waitFor(() => {
      expect(screen.getAllByText(/Complete PostgreSQL Practical Assessment/i).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/Complete Authentication & Security Practical Assessment/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Verified: Python Practical Deliverable/i).length).toBeGreaterThan(0);
  });

  it('launches practical assessment for a specific skill when CTA clicked', async () => {
    render(<RoadmapPage setActiveTab={setActiveTabMock} />);

    await waitFor(() => {
      expect(screen.getByText(/Complete PostgreSQL Practical Assessment/i)).toBeInTheDocument();
    });

    // Find and click the launch assessment button
    const launchButtons = screen.getAllByRole('button', { name: /Launch Assessment/i });
    expect(launchButtons.length).toBeGreaterThan(0);

    fireEvent.click(launchButtons[0]);

    expect(setActiveTabMock).toHaveBeenCalledWith('assessment');
  });

  it('recalculates burn-rate when deadline days option is clicked', async () => {
    render(<RoadmapPage setActiveTab={setActiveTabMock} />);

    await waitFor(() => {
      expect(screen.getByText(/Complete PostgreSQL Practical Assessment/i)).toBeInTheDocument();
    });

    const day7Btn = screen.getByRole('button', { name: '7 Days' });
    fireEvent.click(day7Btn);

    // Pace should update based on 14h remaining over 7 days
    await waitFor(() => {
      expect(screen.getByText(/Based on 14h remaining over 7 days/i)).toBeInTheDocument();
    });
  });

  it('displays automated system tracking indicator and has no manual checkbox controls', async () => {
    render(<RoadmapPage setActiveTab={setActiveTabMock} />);

    await waitFor(() => {
      expect(screen.getByText(/Complete PostgreSQL Practical Assessment/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Automated System Tracking/i)).toBeInTheDocument();

    // Manual click instruction should NOT exist
    expect(screen.queryByText(/Click checkboxes to mark progress/i)).not.toBeInTheDocument();

    // Verify demonstrated task has Demonstrated Evidence badge
    expect(screen.getByText(/Demonstrated Evidence/i)).toBeInTheDocument();
  });
});
