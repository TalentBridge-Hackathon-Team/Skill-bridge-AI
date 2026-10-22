import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Navbar from '../components/Navbar';

describe('Navbar Component', () => {
  it('renders brand and navigation tabs', () => {
    const setActiveTab = vi.fn();
    render(<Navbar activeTab="dashboard" setActiveTab={setActiveTab} />);

    expect(screen.getByText('SkillBridge AI')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Profile & Evidence')).toBeInTheDocument();
    expect(screen.getByText('Job & Goal Analysis')).toBeInTheDocument();
    expect(screen.getByText('Skill Gap Report')).toBeInTheDocument();
    expect(screen.getByText('Practical Tasks')).toBeInTheDocument();
    expect(screen.getByText('Roadmap')).toBeInTheDocument();
  });

  it('calls setActiveTab when a navigation button is clicked', () => {
    const setActiveTab = vi.fn();
    render(<Navbar activeTab="dashboard" setActiveTab={setActiveTab} />);

    fireEvent.click(screen.getByText('Profile & Evidence'));
    expect(setActiveTab).toHaveBeenCalledWith('profile');
  });
});
