import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SkillGapPage from '../pages/SkillGapPage';
import { skillGapService } from '../services/skillGapService';
import { MOCK_TARGET_ROLES } from '../services/mockSkillGapData';

describe('SkillGapPage Component (Member 3)', () => {
  const mockAnalysisResponse = {
    role: MOCK_TARGET_ROLES[0],
    profile: {
      user_id: 'usr_demo_001',
      name: 'Demo User',
      target_role: 'Junior Backend Developer',
      education: 'B.Sc.',
      skills: ['Python', 'Django REST Framework', 'PostgreSQL'],
      evidence: []
    },
    results: [
      {
        requirement_id: 'rep_1',
        skill_name: 'Django REST Framework',
        category: 'framework',
        importance: 'required' as const,
        status: 'Demonstrated' as const,
        priority: 'Low' as const,
        reason: 'Verified project evidence found in profile.',
        recommended_action: 'Ready to showcase in technical interviews.',
        effort_hours_estimate: 0,
        supporting_evidence: [],
        evidence_rationale: 'Verified repository attached',
        gap_type: 'demonstrated' as const
      },
      {
        requirement_id: 'rep_2',
        skill_name: 'PostgreSQL',
        category: 'database',
        importance: 'required' as const,
        status: 'Self-reported' as const,
        priority: 'High' as const,
        reason: 'Listed in profile skills, but no verified repository linked.',
        recommended_action: 'Link a project repository featuring implementation code.',
        effort_hours_estimate: 8,
        supporting_evidence: [],
        evidence_rationale: 'Missing code verification',
        gap_type: 'missing_evidence' as const
      },
      {
        requirement_id: 'rep_3',
        skill_name: 'Python',
        category: 'language',
        importance: 'required' as const,
        status: 'Demonstrated' as const,
        priority: 'Low' as const,
        reason: 'Verified code implementations found.',
        recommended_action: 'Ready to showcase.',
        effort_hours_estimate: 0,
        supporting_evidence: [],
        evidence_rationale: 'Verified',
        gap_type: 'demonstrated' as const
      }
    ],
    summary: {
      total_assessed: 3,
      demonstrated_count: 2,
      self_reported_count: 1,
      needs_improvement_count: 0,
      unverified_count: 0,
      required_count: 3,
      preferred_count: 0,
      match_score: 83,
      calculation_explanation: 'Calculated from 3 requirements.',
      total_remediation_hours: 8
    },
    feasibility: {
      available_hours: 28,
      estimated_plan_effort_hours: 12,
      days_remaining: 14,
      study_hours_per_day: 2,
      feasibility_band: 'Likely feasible' as const,
      interpretation: 'Estimated effort is comfortably below available study capacity.',
      assumptions: ['14 days remaining'],
      suggested_scope: 'Focus on High-priority deliverables.'
    },
    evidence_mapping: {
      mapped_evidence: [],
      unmapped_evidence: []
    },
    is_live_backend: true
  };

  beforeEach(() => {
    vi.spyOn(skillGapService, 'getTargetRoles').mockResolvedValue(MOCK_TARGET_ROLES);
    vi.spyOn(skillGapService, 'runAnalysis').mockResolvedValue(mockAnalysisResponse as any);
  });

  it('renders the page header, title, and navigation buttons', async () => {
    const setActiveTab = vi.fn();
    render(<SkillGapPage setActiveTab={setActiveTab} />);

    await waitFor(() => {
      expect(screen.getByText('Skill Gap & Evidence Matching')).toBeInTheDocument();
      expect(screen.getByText('Evidence Matrix')).toBeInTheDocument();
      expect(screen.getByText('Link Evidence')).toBeInTheDocument();
    });
  });

  it('renders overview metrics and feasibility card after analysis loads', async () => {
    const setActiveTab = vi.fn();
    render(<SkillGapPage setActiveTab={setActiveTab} />);

    await waitFor(() => {
      expect(screen.getByText('Target Role Readiness')).toBeInTheDocument();
      expect(screen.getByText('Deadline Feasibility Assessment')).toBeInTheDocument();
    });

    // Verify key skill requirements are displayed
    expect(screen.getByText('Django REST Framework')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
  });

  it('filters skills when typing into search input', async () => {
    const setActiveTab = vi.fn();
    render(<SkillGapPage setActiveTab={setActiveTab} />);

    await waitFor(() => {
      expect(screen.getByText('Django REST Framework')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search skills/i);
    fireEvent.change(searchInput, { target: { value: 'PostgreSQL' } });

    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.queryByText('Django REST Framework')).not.toBeInTheDocument();
  });

  it('opens and closes Evidence Matrix modal', async () => {
    const setActiveTab = vi.fn();
    render(<SkillGapPage setActiveTab={setActiveTab} />);

    await waitFor(() => {
      expect(screen.getByText('Evidence Matrix')).toBeInTheDocument();
    });

    const matrixButton = screen.getByText('Evidence Matrix');
    fireEvent.click(matrixButton);

    expect(screen.getByText('Evidence Traceability Matrix')).toBeInTheDocument();

    const closeButton = screen.getByLabelText('Close dialog');
    fireEvent.click(closeButton);

    expect(screen.queryByText('Evidence Traceability Matrix')).not.toBeInTheDocument();
  });

  it('opens and closes Link Evidence modal', async () => {
    const setActiveTab = vi.fn();
    render(<SkillGapPage setActiveTab={setActiveTab} />);

    await waitFor(() => {
      expect(screen.getByText('Link Evidence')).toBeInTheDocument();
    });

    const linkButton = screen.getByText('Link Evidence');
    fireEvent.click(linkButton);

    expect(screen.getByText('Link Supporting Evidence')).toBeInTheDocument();

    const closeButton = screen.getByLabelText('Close dialog');
    fireEvent.click(closeButton);

    expect(screen.queryByText('Link Supporting Evidence')).not.toBeInTheDocument();
  });
});
