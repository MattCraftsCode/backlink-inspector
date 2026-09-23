import { describe, expect, it } from 'vitest';
import { getBadgePosition } from './badge-position';

describe('badge position', () => {
  it('places normal content badges above the target', () => {
    expect(getBadgePosition({ top: 120, right: 260, bottom: 150, left: 160, width: 100, height: 30 }, 1200, 800).side).toBe('top');
  });

  it('moves a top-left badge to the right side', () => {
    expect(getBadgePosition({ top: 2, right: 72, bottom: 28, left: 0, width: 72, height: 26 }, 1200, 800).side).toBe('right');
  });

  it('moves a top-right badge below the target', () => {
    expect(getBadgePosition({ top: 1, right: 1200, bottom: 29, left: 1120, width: 80, height: 28 }, 1200, 800).side).toBe('bottom');
  });

  it('keeps the badge inside when no outside edge has enough room', () => {
    expect(getBadgePosition({ top: 0, right: 100, bottom: 100, left: 0, width: 100, height: 100 }, 100, 100).side).toBe('inside');
  });
});
