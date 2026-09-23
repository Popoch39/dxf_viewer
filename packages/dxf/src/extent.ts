import type {
  ArcEntity,
  Block,
  Entity,
  Extent,
  InsertEntity,
  Point,
  PolylineEntity,
} from "./parsed-drawing";

const FULL_TURN = 2 * Math.PI;

function pointsExtent(points: readonly Point[]): Extent | null {
  const [first] = points;

  if (first === undefined) return null;

  // A loop rather than Math.min(...xs): a large plan would overflow the call stack.
  const min = { x: first.x, y: first.y };
  const max = { x: first.x, y: first.y };

  for (const { x, y } of points) {
    min.x = Math.min(min.x, x);
    min.y = Math.min(min.y, y);
    max.x = Math.max(max.x, x);
    max.y = Math.max(max.y, y);
  }

  return { min, max };
}

function union(extents: readonly (Extent | null)[]): Extent | null {
  return pointsExtent(
    extents.flatMap((extent) => (extent === null ? [] : [extent.min, extent.max])),
  );
}

function counterclockwiseOffset(from: number, to: number): number {
  return (((to - from) % FULL_TURN) + FULL_TURN) % FULL_TURN;
}

/** Points that bound the arc going counterclockwise from `startAngle` to `endAngle`. */
function arcBoundingPoints(
  center: Point,
  radius: number,
  startAngle: number,
  endAngle: number,
): Point[] {
  const sweep = counterclockwiseOffset(startAngle, endAngle) || FULL_TURN;

  const pointAt = (angle: number): Point => ({
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle),
  });

  const quadrants = [0, 1, 2, 3].flatMap((quarter) => {
    const angle = (quarter * Math.PI) / 2;

    return counterclockwiseOffset(startAngle, angle) <= sweep ? [pointAt(angle)] : [];
  });

  return [pointAt(startAngle), pointAt(startAngle + sweep), ...quadrants];
}

/** Points that bound the segment from `start` to `end`, an arc when `bulge` is not 0. */
function segmentBoundingPoints(start: PolylineEntity["vertices"][number], end: Point): Point[] {
  if (start.bulge === 0) return [start, end];

  const chord = { x: end.x - start.x, y: end.y - start.y };
  // Distance from the middle of the chord to the center, along its left normal.
  const offset = (1 - start.bulge ** 2) / (4 * start.bulge);

  const center = {
    x: (start.x + end.x) / 2 - chord.y * offset,
    y: (start.y + end.y) / 2 + chord.x * offset,
  };

  const radius = Math.hypot(start.x - center.x, start.y - center.y);
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x);

  return start.bulge > 0
    ? arcBoundingPoints(center, radius, startAngle, endAngle)
    : arcBoundingPoints(center, radius, endAngle, startAngle);
}

function polylineExtent(polyline: PolylineEntity): Extent | null {
  const { vertices, closed } = polyline;

  const segments = vertices.flatMap((vertex, index) => {
    const next = vertices[index + 1] ?? (closed ? vertices[0] : undefined);

    return next === undefined ? [vertex] : segmentBoundingPoints(vertex, next);
  });

  return pointsExtent(segments);
}

function arcExtent(arc: ArcEntity): Extent | null {
  return pointsExtent(arcBoundingPoints(arc.center, arc.radius, arc.startAngle, arc.endAngle));
}

/** Maps a point of the block's coordinates onto the drawing through the insertion. */
function insertTransform(insert: InsertEntity, basePoint: Point) {
  const cos = Math.cos(insert.rotation);
  const sin = Math.sin(insert.rotation);

  return (point: Point): Point => {
    const x = (point.x - basePoint.x) * insert.scale.x;
    const y = (point.y - basePoint.y) * insert.scale.y;

    return { x: insert.position.x + x * cos - y * sin, y: insert.position.y + x * sin + y * cos };
  };
}

/**
 * Extent of the entities, block insertions included. The extent of an
 * insertion is the one of its block's transformed bounding box: exact unless
 * the insertion is rotated by something else than a quarter turn.
 */
export function entitiesExtent(
  entities: readonly Entity[],
  blocks: ReadonlyMap<string, Block>,
): Extent | null {
  const blockExtents = new Map<string, Extent | null>();

  const blockExtent = (name: string): Extent | null => {
    const known = blockExtents.get(name);

    if (known !== undefined) return known;

    // Marks the block before walking it, so that a block inserting itself ends the recursion.
    blockExtents.set(name, null);

    const block = blocks.get(name);

    const extent =
      block === undefined ? null : union(block.entities.map((child) => extentOf(child)));

    blockExtents.set(name, extent);

    return extent;
  };

  const insertExtent = (insert: InsertEntity): Extent | null => {
    const extent = blockExtent(insert.block);
    const block = blocks.get(insert.block);

    if (extent === null || block === undefined) return null;

    const transform = insertTransform(insert, block.basePoint);

    const corners = [
      extent.min,
      extent.max,
      { x: extent.min.x, y: extent.max.y },
      { x: extent.max.x, y: extent.min.y },
    ];

    return pointsExtent(corners.map((corner) => transform(corner)));
  };

  const extentOf = (entity: Entity) => entityExtent(entity, insertExtent);

  return union(entities.map((entity) => extentOf(entity)));
}

function entityExtent(
  entity: Entity,
  insertExtent: (insert: InsertEntity) => Extent | null,
): Extent | null {
  if (entity.type === "LINE") return pointsExtent([entity.start, entity.end]);

  if (entity.type === "CIRCLE") {
    return arcExtent({ ...entity, type: "ARC", startAngle: 0, endAngle: FULL_TURN });
  }

  if (entity.type === "ARC") return arcExtent(entity);

  if (entity.type === "INSERT") return insertExtent(entity);

  // Texts count by their anchor only: the viewer lays out the glyphs.
  if (entity.type === "TEXT" || entity.type === "MTEXT") return pointsExtent([entity.position]);

  return polylineExtent(entity);
}
