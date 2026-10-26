import { Random } from './rng';

export interface Point {
  x: number;
  y: number;
}

// Poisson Disk Sampling (Bridson 2007), following section 3.3:
// 1. a background grid with cell size rMin/√2 holds at most one point per cell;
// 2. the first point is random and becomes active;
// 3. while points are active: take a random active point p and try k
//    candidates in the ring [rMin, 2·rMin] around it; every candidate at
//    least rMin from all neighbours is added (and becomes active); if none
//    is, p is retired.
// Runs in O(n). Stops early at `maxPoints`.
export function poissonDiskSampling(
  width: number,
  height: number,
  rMin: number,
  random: Random,
  k = 30,
  maxPoints = Infinity
): Point[] {
  const cellSize = rMin / Math.SQRT2;
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const grid = new Int32Array(cols * rows).fill(-1);
  const points: Point[] = [];
  const active: number[] = [];
  const rMinSquared = rMin * rMin;

  const cellOf = (p: Point) => ({
    col: Math.min(Math.floor(p.x / cellSize), cols - 1),
    row: Math.min(Math.floor(p.y / cellSize), rows - 1),
  });

  const add = (p: Point) => {
    const { col, row } = cellOf(p);
    grid[row * cols + col] = points.length;
    active.push(points.length);
    points.push(p);
  };

  // A point at distance ≥ rMin can only conflict within two cells.
  const isFarEnough = (p: Point) => {
    const { col, row } = cellOf(p);
    for (let r = Math.max(row - 2, 0); r <= Math.min(row + 2, rows - 1); r++) {
      for (let c = Math.max(col - 2, 0); c <= Math.min(col + 2, cols - 1); c++) {
        const index = grid[r * cols + c];
        if (index === -1) continue;
        const dx = points[index].x - p.x;
        const dy = points[index].y - p.y;
        if (dx * dx + dy * dy < rMinSquared) return false;
      }
    }
    return true;
  };

  add({ x: random() * width, y: random() * height });

  while (active.length > 0 && points.length < maxPoints) {
    const activeIndex = Math.floor(random() * active.length);
    const p = points[active[activeIndex]];
    let added = false;

    for (let i = 0; i < k && points.length < maxPoints; i++) {
      const angle = random() * 2 * Math.PI;
      const distance = rMin * (1 + random());
      const candidate = {
        x: p.x + Math.cos(angle) * distance,
        y: p.y + Math.sin(angle) * distance,
      };
      if (
        candidate.x < 0 || candidate.x >= width ||
        candidate.y < 0 || candidate.y >= height
      ) {
        continue;
      }
      if (isFarEnough(candidate)) {
        add(candidate);
        added = true;
      }
    }

    if (!added) {
      // Retire p: swap-remove from the active list.
      active[activeIndex] = active[active.length - 1];
      active.pop();
    }
  }
  return points;
}
