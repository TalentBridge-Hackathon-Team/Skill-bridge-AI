import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge from '../components/StatusBadge';

describe('StatusBadge Component', () => {
  it('renders Demonstrated status badge correctly', () => {
    render(<StatusBadge status="Demonstrated" />);
    expect(screen.getByText('Demonstrated')).toBeInTheDocument();
  });

  it('renders Self-reported status badge correctly', () => {
    render(<StatusBadge status="Self-reported" />);
    expect(screen.getByText('Self-reported')).toBeInTheDocument();
  });

  it('renders Unverified status badge correctly', () => {
    render(<StatusBadge status="Unverified" />);
    expect(screen.getByText('Unverified')).toBeInTheDocument();
  });

  it('renders Needs improvement status badge correctly', () => {
    render(<StatusBadge status="Needs improvement" />);
    expect(screen.getByText('Needs improvement')).toBeInTheDocument();
  });
});
