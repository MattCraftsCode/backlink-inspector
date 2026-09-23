export type BadgeSide = 'top' | 'right' | 'bottom' | 'left' | 'inside';

export interface RectLike {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export interface BadgePosition {
  side: BadgeSide;
  left: number;
  top: number;
}

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
);

export const getBadgePosition = (
  rect: RectLike,
  viewportWidth: number,
  viewportHeight: number,
  badgeSize = 24,
  gap = 8,
): BadgePosition => {
  const viewportPadding = 4;
  const requiredSpace = badgeSize + gap;
  const horizontal = clamp(
    3 + rect.width / 2 - badgeSize / 2,
    7 - rect.left,
    viewportWidth - badgeSize - viewportPadding - rect.left + 3,
  );
  const vertical = clamp(
    3 + rect.height / 2 - badgeSize / 2,
    7 - rect.top,
    viewportHeight - badgeSize - viewportPadding - rect.top + 3,
  );

  if (rect.top >= requiredSpace) {
    return { side: 'top', left: horizontal, top: -badgeSize - gap + 3 };
  }
  if (viewportWidth - rect.right >= requiredSpace) {
    return { side: 'right', left: rect.width + gap + 3, top: vertical };
  }
  if (viewportHeight - rect.bottom >= requiredSpace) {
    return { side: 'bottom', left: horizontal, top: rect.height + gap + 3 };
  }
  if (rect.left >= requiredSpace) {
    return { side: 'left', left: -badgeSize - gap + 3, top: vertical };
  }
  return { side: 'inside', left: horizontal, top: vertical };
};
