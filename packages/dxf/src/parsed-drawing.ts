import { Type } from "@sinclair/typebox";
import type { Static } from "@sinclair/typebox";

// The Dessin parsé: what the viewer displays, stored as JSON. Points are 2D,
// angles are in radians, counterclockwise.

export const Point = Type.Object({ x: Type.Number(), y: Type.Number() });

export type Point = Static<typeof Point>;

export const Extent = Type.Object({ min: Point, max: Point });

export type Extent = Static<typeof Extent>;

/** `$INSUNITS` values of the DXF header, by code. */
export const DXF_UNITS = [
  "unitless",
  "inches",
  "feet",
  "miles",
  "millimeters",
  "centimeters",
  "meters",
  "kilometers",
  "microinches",
  "mils",
  "yards",
  "angstroms",
  "nanometers",
  "microns",
  "decimeters",
  "decameters",
  "hectometers",
  "gigameters",
  "astronomical units",
  "light years",
  "parsecs",
  "US survey feet",
  "US survey inches",
  "US survey yards",
  "US survey miles",
] as const;

export const Units = Type.Union(DXF_UNITS.map((unit) => Type.Literal(unit)));

export type Units = Static<typeof Units>;

export const Layer = Type.Object({
  name: Type.String(),
  /** RGB color, `0xRRGGBB`. */
  color: Type.Integer({ minimum: 0, maximum: 0xff_ff_ff }),
  /** False when the layer is off or frozen. */
  visible: Type.Boolean(),
});

export type Layer = Static<typeof Layer>;

/** Number of entities per DXF entity type (`LINE`, `INSERT`…), ignored types included. */
export const EntityCounts = Type.Record(Type.String(), Type.Integer({ minimum: 0 }));

export type EntityCounts = Static<typeof EntityCounts>;

const layer = Type.String();

export const LineEntity = Type.Object({
  type: Type.Literal("LINE"),
  layer,
  start: Point,
  end: Point,
});

export type LineEntity = Static<typeof LineEntity>;

export const PolylineVertex = Type.Object({
  x: Type.Number(),
  y: Type.Number(),
  /** Tangent of a quarter of the angle of the arc to the next vertex; 0 for a straight segment. */
  bulge: Type.Number(),
});

export type PolylineVertex = Static<typeof PolylineVertex>;

/** LWPOLYLINE and 2D POLYLINE share the same geometry. */
export const PolylineEntity = Type.Object({
  type: Type.Union([Type.Literal("LWPOLYLINE"), Type.Literal("POLYLINE")]),
  layer,
  vertices: Type.Array(PolylineVertex),
  closed: Type.Boolean(),
});

export type PolylineEntity = Static<typeof PolylineEntity>;

export const CircleEntity = Type.Object({
  type: Type.Literal("CIRCLE"),
  layer,
  center: Point,
  radius: Type.Number({ minimum: 0 }),
});

export type CircleEntity = Static<typeof CircleEntity>;

export const ArcEntity = Type.Object({
  type: Type.Literal("ARC"),
  layer,
  center: Point,
  radius: Type.Number({ minimum: 0 }),
  startAngle: Type.Number(),
  endAngle: Type.Number(),
});

export type ArcEntity = Static<typeof ArcEntity>;

export const TextEntity = Type.Object({
  type: Type.Literal("TEXT"),
  layer,
  text: Type.String(),
  /** Anchor of the text: its alignment point when it is aligned, its insertion point otherwise. */
  position: Point,
  height: Type.Number(),
  rotation: Type.Number(),
});

export type TextEntity = Static<typeof TextEntity>;

export const MtextEntity = Type.Object({
  type: Type.Literal("MTEXT"),
  layer,
  /** Raw MTEXT content, inline formatting codes included. */
  text: Type.String(),
  position: Point,
  height: Type.Number(),
  /** Width of the text box; 0 when the text does not wrap. */
  width: Type.Number(),
  rotation: Type.Number(),
  /** Which point of the text box sits on `position`: 1 top left … 9 bottom right. */
  attachmentPoint: Type.Integer({ minimum: 1, maximum: 9 }),
});

export type MtextEntity = Static<typeof MtextEntity>;

/** Insertion of a block definition: the block's entities are not flattened. */
export const InsertEntity = Type.Object({
  type: Type.Literal("INSERT"),
  layer,
  /** Name of a block of `ParsedDrawing.blocks`. */
  block: Type.String(),
  position: Point,
  scale: Point,
  rotation: Type.Number(),
});

export type InsertEntity = Static<typeof InsertEntity>;

export const Entity = Type.Union([
  LineEntity,
  PolylineEntity,
  CircleEntity,
  ArcEntity,
  TextEntity,
  MtextEntity,
  InsertEntity,
]);

export type Entity = Static<typeof Entity>;

export const Block = Type.Object({
  /** Point of the block mapped onto the position of its insertions. */
  basePoint: Point,
  entities: Type.Array(Entity),
});

export type Block = Static<typeof Block>;

export const DrawingMeta = Type.Object({
  /** `R12`, `R2000`, `R2018`…, or the raw `$ACADVER` code when it is unknown; null when absent. */
  dxfVersion: Type.Union([Type.String(), Type.Null()]),
  units: Units,
  /** Bounding box of the model space; null when there is nothing to bound. */
  extent: Type.Union([Extent, Type.Null()]),
  entityCounts: EntityCounts,
});

export type DrawingMeta = Static<typeof DrawingMeta>;

export const ParsedDrawing = Type.Object({
  meta: DrawingMeta,
  layers: Type.Array(Layer),
  /** Block definitions, by name. */
  blocks: Type.Record(Type.String(), Block),
  /** Entities of the model space. */
  entities: Type.Array(Entity),
});

export type ParsedDrawing = Static<typeof ParsedDrawing>;
