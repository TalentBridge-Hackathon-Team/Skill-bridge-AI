import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LinkEvidenceModal from '../components/skill-gap/LinkEvidenceModal';

describe('LinkEvidenceModal Custom Skill Support', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSubmitEvidence: vi.fn().mockResolvedValue(undefined),
    availableSkills: ['Python', 'Vector Databases', 'PyTorch'],
    initialSkillName: 'Python'
  };

  it('renders standard dropdown with available skills and custom option', () => {
    render(<LinkEvidenceModal {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Target Skill Requirement *')).toBeInTheDocument();
    
    // There are 3 select dropdowns (Skill, Type, Status)
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('Vector Databases')).toBeInTheDocument();
    expect(screen.getByText('✏️ + Enter custom skill not listed above...')).toBeInTheDocument();
  });

  it('toggles to custom skill input when clicking "+ Enter custom skill" button', () => {
    render(<LinkEvidenceModal {...defaultProps} />);

    const toggleBtn = screen.getByText('+ Enter custom skill');
    fireEvent.click(toggleBtn);

    expect(screen.getByPlaceholderText(/e\.g\. Docker, Kubernetes, Redis/i)).toBeInTheDocument();
    expect(screen.getByText('← Select from role list')).toBeInTheDocument();
  });

  it('switches to custom mode when selecting "✏️ + Enter custom skill not listed above..." from dropdown', () => {
    render(<LinkEvidenceModal {...defaultProps} />);

    // First combobox is the Target Skill select
    const skillSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(skillSelect, { target: { value: '__custom__' } });

    expect(screen.getByPlaceholderText(/e\.g\. Docker, Kubernetes, Redis/i)).toBeInTheDocument();
  });

  it('populates custom input when clicking suggestion chip', () => {
    render(<LinkEvidenceModal {...defaultProps} />);

    // Switch to custom mode
    fireEvent.click(screen.getByText('+ Enter custom skill'));

    // Click "+Docker" chip
    const dockerChip = screen.getByRole('button', { name: '+Docker' });
    fireEvent.click(dockerChip);

    const input = screen.getByPlaceholderText(/e\.g\. Docker, Kubernetes, Redis/i) as HTMLInputElement;
    expect(input.value).toBe('Docker');
  });

  it('auto-activates custom skill mode if initialSkillName is not in availableSkills', () => {
    render(
      <LinkEvidenceModal
        {...defaultProps}
        availableSkills={['Python', 'PyTorch']}
        initialSkillName="Docker"
      />
    );

    // Should already be in custom input mode with "Docker" prefilled
    const input = screen.getByPlaceholderText(/e\.g\. Docker, Kubernetes, Redis/i) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('Docker');
  });

  it('submits custom skill correctly in onSubmitEvidence payload', async () => {
    const onSubmitEvidence = vi.fn().mockResolvedValue(undefined);
    render(<LinkEvidenceModal {...defaultProps} onSubmitEvidence={onSubmitEvidence} />);

    // Switch to custom mode
    fireEvent.click(screen.getByText('+ Enter custom skill'));

    // Type custom skill
    const skillInput = screen.getByPlaceholderText(/e\.g\. Docker, Kubernetes, Redis/i);
    fireEvent.change(skillInput, { target: { value: 'Kubernetes' } });

    // Fill title and description
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Order Processing Relational Database/i), {
      target: { value: 'K8s Cluster Helm Deployment' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe how this project demonstrates/i), {
      target: { value: 'Production manifests with HPA and ingress controllers' }
    });

    // Click submit
    const submitBtn = screen.getByRole('button', { name: /save & recalculate match/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmitEvidence).toHaveBeenCalledTimes(1);
      expect(onSubmitEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          skill_name: 'Kubernetes',
          title: 'K8s Cluster Helm Deployment',
          description: 'Production manifests with HPA and ingress controllers'
        })
      );
    });
  });
});
