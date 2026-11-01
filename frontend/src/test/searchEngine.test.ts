import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  searchGlobal,
  SYSTEM_PAGES,
  CORE_SKILLS_CATALOG,
  buildDynamicUserIndex,
  type GlobalSearchItem,
} from '../services/searchEngine';
import { skillGapService } from '../services/skillGapService';

describe('Dynamic Search Engine', () => {
  const basePool = [...SYSTEM_PAGES, ...CORE_SKILLS_CATALOG];

  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  it('finds navigation pages by alias keywords (cv/resume -> Profile, ats -> Dashboard)', () => {
    const cvResults = searchGlobal('cv', basePool);
    expect(cvResults.length).toBeGreaterThan(0);
    expect(cvResults[0].id).toBe('p_profile');

    const resumeResults = searchGlobal('resume', basePool);
    expect(resumeResults.length).toBeGreaterThan(0);
    expect(resumeResults[0].id).toBe('p_profile');

    const atsResults = searchGlobal('ats', basePool);
    expect(atsResults.length).toBeGreaterThan(0);
    expect(atsResults[0].id).toBe('p_overview');
  });

  it('finds practical tasks via pedagogy synonyms (quiz, mentor, rubric, coding)', () => {
    const mentorResults = searchGlobal('mentor', basePool);
    expect(mentorResults.some(r => r.id === 'p_assessment')).toBe(true);

    const rubricResults = searchGlobal('rubric', basePool);
    expect(rubricResults.some(r => r.id === 'p_assessment')).toBe(true);

    const quizResults = searchGlobal('quiz', basePool);
    expect(quizResults.some(r => r.id === 'p_assessment')).toBe(true);
  });

  it('handles out-of-order multi-token search queries ("docker devops", "python backend")', () => {
    const dockerDevops = searchGlobal('docker devops', basePool);
    expect(dockerDevops.length).toBeGreaterThan(0);
    expect(dockerDevops[0].title).toContain('Docker');

    const pythonBackend = searchGlobal('python backend', basePool);
    expect(pythonBackend.length).toBeGreaterThan(0);
    expect(pythonBackend[0].title).toContain('Python');
  });

  it('dynamically indexes real user target roles and prioritizes them', async () => {
    vi.spyOn(skillGapService, 'getTargetRoles').mockResolvedValue([
      {
        id: 'role_ai_specialist',
        role_title: 'AI Platform Engineer',
        department: 'Core Machine Learning',
        mode: 'job_specific',
        days_remaining: 21,
        study_hours_per_week: 15,
      },
    ]);

    const dynamicItems = await buildDynamicUserIndex('usr_test');
    expect(dynamicItems.some(i => i.title === 'AI Platform Engineer')).toBe(true);

    const pool = [...basePool, ...dynamicItems];
    const results = searchGlobal('platform engineer', pool);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('AI Platform Engineer');
    expect(results[0].category).toBe('role');
    expect(results[0].badge?.label).toBe('Target Job');
  });

  it('dynamically indexes analyzed skill gaps from local session with priority badges', async () => {
    window.localStorage.setItem('skillbridge_selected_role', 'role_backend_1');
    window.localStorage.setItem(
      'skillbridge_cached_analysis_role_backend_1',
      JSON.stringify({
        results: [
          {
            requirement_id: 'req_sql_optim',
            skill_name: 'SQL Query Optimization',
            priority: 'High',
            status: 'Gap',
            effort_hours_estimate: 12,
            importance: 'required',
          },
        ],
      })
    );

    const dynamicItems = await buildDynamicUserIndex('usr_test');
    expect(dynamicItems.some(i => i.title === 'SQL Query Optimization')).toBe(true);

    const pool = [...basePool, ...dynamicItems];
    const results = searchGlobal('sql query optimization', pool);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('SQL Query Optimization');
    expect(results[0].category).toBe('skill_gap');
    expect(results[0].badge?.label).toBe('High Priority Gap');
  });

  it('returns empty array cleanly on blank or whitespace queries', () => {
    expect(searchGlobal('', basePool)).toEqual([]);
    expect(searchGlobal('   ', basePool)).toEqual([]);
  });
});
