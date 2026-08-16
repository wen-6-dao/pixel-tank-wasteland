export const DIRECTIONS = {
  up: { angle: -Math.PI / 2, dx: 0, dy: -1 },
  down: { angle: Math.PI / 2, dx: 0, dy: 1 },
  left: { angle: Math.PI, dx: -1, dy: 0 },
  right: { angle: 0, dx: 1, dy: 0 },
};

export const ALL_DIRECTIONS = [DIRECTIONS.up, DIRECTIONS.down, DIRECTIONS.left, DIRECTIONS.right];

/** 按向量绝对值选主轴方向（用于敌人追击） */
export function primaryDirection(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? DIRECTIONS.right : DIRECTIONS.left;
  return dy > 0 ? DIRECTIONS.down : DIRECTIONS.up;
}

/** 主轴被挡住时尝试的次轴方向 */
export function secondaryDirection(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) return dy > 0 ? DIRECTIONS.down : DIRECTIONS.up;
  return dx > 0 ? DIRECTIONS.right : DIRECTIONS.left;
}
