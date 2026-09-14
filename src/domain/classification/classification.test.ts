import { describe, expect, it } from 'vitest';
import { classifyTransition } from './service';

describe('classification service', () => {
  it('classifies a simple single-site engagement as low complexity', () => {
    const result = classifyTransition({
      'scope.plan_type': 'single_site',
      'scope.products': ['wm'],
      'scope.site_count': 1,
      'complexity.integration_count': 0,
    });
    expect(result.planType).toBe('single_site');
    expect(result.complexityLevel).toBe('low');
    expect(result.reasons.find((r) => r.field === 'complexityLevel')).toBeDefined();
  });

  it('classifies a multi-site engagement with integrations as higher complexity', () => {
    const result = classifyTransition({
      'scope.plan_type': 'multi_site',
      'scope.site_count': 6,
      'complexity.integration_count': 4,
      'complexity.uses_mif': true,
      'complexity.custom_extensions': true,
      'delivery.data_migration_concerns': true,
    });
    expect(result.complexityLevel).toBe('high');
  });

  it('derives timeline pressure from start/go-live date spread', () => {
    const tight = classifyTransition({
      'timeline.target_start_date': '2027-01-01',
      'timeline.target_go_live_date': '2027-03-01',
    });
    expect(tight.timelinePressure).toBe('high');

    const relaxed = classifyTransition({
      'timeline.target_start_date': '2027-01-01',
      'timeline.target_go_live_date': '2027-09-01',
    });
    expect(relaxed.timelinePressure).toBe('low');
  });

  it('never silently changes without new answers — same input, same output', () => {
    const input = { 'scope.plan_type': 'multi_site', 'complexity.integration_count': 5 };
    const a = classifyTransition(input);
    const b = classifyTransition(input);
    expect(a).toEqual(b);
  });
});
