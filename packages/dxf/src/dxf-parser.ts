// Default import: Bun resolves the lib's UMD `main`, which has no named export.
import Parser from "dxf-parser";

// The only file that knows about `dxf-parser`. Its output is described by the
// Raw* types below: the lib declares every field as present, but only sets the
// ones found in the file.

export type RawPoint = { x: number; y: number };

export type RawVertex = RawPoint & { bulge?: number };

export type RawEntity = {
  type: string;
  layer?: string;
  inPaperSpace?: boolean;
  // LINE, LWPOLYLINE, POLYLINE
  vertices?: RawVertex[];
  // Closed polyline flag, under the name the lib gives it.
  // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names
  shape?: boolean;
  is3dPolygonMesh?: boolean;
  isPolyfaceMesh?: boolean;
  // CIRCLE, ARC
  center?: RawPoint;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  // TEXT
  startPoint?: RawPoint;
  endPoint?: RawPoint;
  textHeight?: number;
  halign?: number;
  valign?: number;
  // TEXT, MTEXT, INSERT
  text?: string;
  position?: RawPoint;
  rotation?: number;
  height?: number;
  width?: number;
  attachmentPoint?: number;
  directionVector?: RawPoint;
  name?: string;
  xScale?: number;
  yScale?: number;
};

export type RawBlock = { name: string; position?: RawPoint; entities?: RawEntity[] };

export type RawLayer = { name: string; color?: number; visible?: boolean; frozen?: boolean };

export type RawDxf = {
  header?: { $ACADVER?: string; $INSUNITS?: number };
  entities?: RawEntity[];
  blocks?: Record<string, RawBlock>;
  tables?: { layer?: { layers?: Record<string, RawLayer> } };
};

type Group = { code: number; value: string | number | boolean };

type Scanner = { next(): Group };

type SkippedEntityHandler = new () => {
  ForEntityName: string;
  parseEntity(scanner: Scanner, current: Group): RawEntity;
};

/**
 * The part of the lib's parser that registers handlers. Its typings close
 * `ForEntityName` to the types the lib reads itself, but at runtime it accepts
 * any type: a method signature, checked bivariantly, lets the lib's parser fit.
 */
type EntityHandlerRegistry = { registerEntityHandler(handler: SkippedEntityHandler): void };

/** Entity types `dxf-parser` 1.1 reads itself. */
const HANDLED_TYPES = new Set([
  "3DFACE",
  "ARC",
  "ATTDEF",
  "CIRCLE",
  "DIMENSION",
  "ELLIPSE",
  "INSERT",
  "LINE",
  "LWPOLYLINE",
  "MTEXT",
  "POINT",
  "POLYLINE",
  "SOLID",
  "SPLINE",
  "TEXT",
]);

/** Sub-entities that belong to the entity before them, and section markers. */
const NOT_ENTITIES = new Set(["ATTRIB", "SEQEND", "VERTEX", "ENDBLK", "ENDSEC", "EOF"]);

/** A `0` code line followed by a name; the lookahead keeps the name line available as the next code line. */
const GROUP_ZERO = /^[ \t]*0\r?\n(?=[ \t]*([A-Z0-9_]+)[ \t]*\r?$)/gmu;

/** Every value of a `0` group, a superset of the entity types of the file. */
function groupZeroNames(text: string): Set<string> {
  const names = new Set<string>();

  for (const match of text.matchAll(GROUP_ZERO)) {
    const name = match[1];

    if (name !== undefined) names.add(name);
  }

  return names;
}

/**
 * Handler that keeps an entity type the lib does not read, with its layer and
 * space only, so that it is still counted. The lib drops unknown types silently.
 */
function skippedEntityHandler(type: string) {
  return class SkippedEntity {
    readonly ForEntityName = type;

    /** `current` is the `0` group that opens the entity: its type, known already. */
    parseEntity(scanner: Scanner, _current: Group): RawEntity {
      const entity: RawEntity = { type };
      let group = scanner.next();

      while (group.code !== 0) {
        if (group.code === 8) entity.layer = String(group.value);

        if (group.code === 67) entity.inPaperSpace = group.value !== 0;

        group = scanner.next();
      }

      return entity;
    }
  };
}

/** Runs `dxf-parser` on `text`. Throws whatever the lib throws on unreadable input. */
export function readDxf(text: string): RawDxf | null {
  const parser = new Parser();
  const registry: EntityHandlerRegistry = parser;

  for (const name of groupZeroNames(text)) {
    if (HANDLED_TYPES.has(name) || NOT_ENTITIES.has(name)) continue;

    registry.registerEntityHandler(skippedEntityHandler(name));
  }

  // The lib's IDxf fits RawDxf, which only makes optional the fields it may leave unset.
  return parser.parse(text);
}
