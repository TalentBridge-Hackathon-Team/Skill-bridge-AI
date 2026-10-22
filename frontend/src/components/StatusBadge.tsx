import type { SkillStatus } from '../types';

interface StatusBadgeProps {
  status: SkillStatus | string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    'Demonstrated': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Self-reported': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Needs improvement': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    'Unverified': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };

  const badgeClass = styles[status] || styles['Unverified'];

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeClass} uppercase tracking-wider`}>
      {status}
    </span>
  );
}
