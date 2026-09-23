import type { RawEntity, RawPoint } from "./dxf-parser";
import type {
  ArcEntity,
  CircleEntity,
  Entity,
  InsertEntity,
  LineEntity,
  MtextEntity,
  Point,
  PolylineEntity,
  TextEntity,
} from "./parsed-drawing";

// Conversion of the lib's entities into the entities of the Dessin parsé. One
// converter per displayed type; each returns null when the geometry is missing.

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function point(raw: RawPoint): Point {
  return { x: raw.x, y: raw.y };
}

function textPosition(raw: RawEntity): RawPoint | undefined {
  const aligned = (raw.halign ?? 0) !== 0 || (raw.valign ?? 0) !== 0;

  return aligned ? (raw.endPoint ?? raw.startPoint) : raw.startPoint;
}

function mtextRotation(raw: RawEntity): number {
  if (raw.directionVector !== undefined) {
    return Math.atan2(raw.directionVector.y, raw.directionVector.x);
  }

  return radians(raw.rotation ?? 0);
}

function lineEntity(raw: RawEntity, layer: string): LineEntity | null {
  const [start, end] = raw.vertices ?? [];

  if (start === undefined || end === undefined) return null;

  return { type: "LINE", layer, start: point(start), end: point(end) };
}

function polylineEntity(
  raw: RawEntity,
  type: PolylineEntity["type"],
  layer: string,
): PolylineEntity | null {
  // Meshes are 3D surfaces, not outlines.
  if (raw.vertices === undefined || raw.is3dPolygonMesh === true || raw.isPolyfaceMesh === true) {
    return null;
  }

  const vertices = raw.vertices.map((vertex) => ({
    x: vertex.x,
    y: vertex.y,
    bulge: vertex.bulge ?? 0,
  }));

  return { type, layer, vertices, closed: raw.shape ?? false };
}

function circleEntity(raw: RawEntity, layer: string): CircleEntity | null {
  if (raw.center === undefined || raw.radius === undefined) return null;

  return { type: "CIRCLE", layer, center: point(raw.center), radius: raw.radius };
}

function arcEntity(raw: RawEntity, layer: string): ArcEntity | null {
  if (raw.center === undefined || raw.radius === undefined) return null;

  return {
    type: "ARC",
    layer,
    center: point(raw.center),
    radius: raw.radius,
    startAngle: raw.startAngle ?? 0,
    endAngle: raw.endAngle ?? 0,
  };
}

function textEntity(raw: RawEntity, layer: string): TextEntity | null {
  const position = textPosition(raw);

  if (position === undefined) return null;

  return {
    type: "TEXT",
    layer,
    text: raw.text ?? "",
    position: point(position),
    height: raw.textHeight ?? 0,
    rotation: radians(raw.rotation ?? 0),
  };
}

function mtextEntity(raw: RawEntity, layer: string): MtextEntity | null {
  if (raw.position === undefined) return null;

  return {
    type: "MTEXT",
    layer,
    text: raw.text ?? "",
    position: point(raw.position),
    height: raw.height ?? 0,
    width: raw.width ?? 0,
    rotation: mtextRotation(raw),
    attachmentPoint: raw.attachmentPoint ?? 1,
  };
}

/** Null as well when the block is not defined, so that every INSERT references a block. */
function insertEntity(
  raw: RawEntity,
  layer: string,
  blockNames: ReadonlySet<string>,
): InsertEntity | null {
  if (raw.name === undefined || raw.position === undefined || !blockNames.has(raw.name)) {
    return null;
  }

  return {
    type: "INSERT",
    layer,
    block: raw.name,
    position: point(raw.position),
    scale: { x: raw.xScale ?? 1, y: raw.yScale ?? 1 },
    rotation: radians(raw.rotation ?? 0),
  };
}

/** Our entity for a lib entity, or null when its type is not displayed or it cannot be. */
function entity(raw: RawEntity, blockNames: ReadonlySet<string>): Entity | null {
  const layer = raw.layer ?? "0";

  switch (raw.type) {
    case "LINE": {
      return lineEntity(raw, layer);
    }

    case "LWPOLYLINE":
    case "POLYLINE": {
      return polylineEntity(raw, raw.type, layer);
    }

    case "CIRCLE": {
      return circleEntity(raw, layer);
    }

    case "ARC": {
      return arcEntity(raw, layer);
    }

    case "TEXT": {
      return textEntity(raw, layer);
    }

    case "MTEXT": {
      return mtextEntity(raw, layer);
    }

    case "INSERT": {
      return insertEntity(raw, layer, blockNames);
    }

    default: {
      return null;
    }
  }
}

/** The entities that the viewer displays, among `raws`. `blockNames` are the defined blocks. */
export function displayedEntities(
  raws: readonly RawEntity[],
  blockNames: ReadonlySet<string>,
): Entity[] {
  return raws.flatMap((raw) => {
    const converted = entity(raw, blockNames);

    return converted === null ? [] : [converted];
  });
}
