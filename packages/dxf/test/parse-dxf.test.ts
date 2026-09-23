import { describe, expect, it } from "bun:test";

import { Value } from "@sinclair/typebox/value";

import { ParsedDrawing, parseDxf } from "../src";
import type { Extent } from "../src";
import { fixture } from "./fixtures";

async function parsedFixture(name: string): Promise<ParsedDrawing> {
  return parseDxf(await fixture(name));
}

function expectExtent(actual: Extent | null, expected: Extent) {
  expect(actual).not.toBeNull();
  expect(actual?.min.x).toBeCloseTo(expected.min.x);
  expect(actual?.min.y).toBeCloseTo(expected.min.y);
  expect(actual?.max.x).toBeCloseTo(expected.max.x);
  expect(actual?.max.y).toBeCloseTo(expected.max.y);
}

/** Names of the blocks referenced by the INSERTs of the model space and of every block. */
function insertedBlockNames(drawing: ParsedDrawing): string[] {
  return [drawing.entities, ...Object.values(drawing.blocks).map((block) => block.entities)]
    .flat()
    .flatMap((entity) => (entity.type === "INSERT" ? [entity.block] : []));
}

describe("parseDxf on real files", () => {
  const fixtures = ["r12-without-blocks.dxf", "r2000-with-blocks.dxf", "r2018-nested-blocks.dxf"];

  it.each(fixtures)("returns a Dessin parsé that matches the schema (%s)", async (name) => {
    const drawing = await parsedFixture(name);

    expect(Value.Check(ParsedDrawing, drawing)).toBe(true);
  });

  it.each(fixtures)("only references blocks that are defined (%s)", async (name) => {
    const drawing = await parsedFixture(name);

    for (const block of insertedBlockNames(drawing)) {
      expect(Object.keys(drawing.blocks)).toContain(block);
    }
  });

  it.each(fixtures)("survives a JSON round trip unchanged (%s)", async (name) => {
    const drawing = await parsedFixture(name);

    expect(JSON.parse(JSON.stringify(drawing))).toEqual(drawing);
  });
});

describe("parseDxf on a R12 plan without blocks", () => {
  it("reads the DXF version and defaults the units", async () => {
    const { meta } = await parsedFixture("r12-without-blocks.dxf");

    expect(meta.dxfVersion).toBe("R12");
    expect(meta.units).toBe("unitless");
  });

  it("counts every entity type, unknown ones included", async () => {
    const { meta } = await parsedFixture("r12-without-blocks.dxf");

    expect(meta.entityCounts).toEqual({
      LINE: 1,
      POLYLINE: 1,
      CIRCLE: 1,
      ARC: 1,
      TEXT: 1,
      POINT: 1,
    });
  });

  it("extracts the common entities and ignores the others", async () => {
    const { entities, blocks } = await parsedFixture("r12-without-blocks.dxf");

    expect(entities.map((entity) => entity.type)).toEqual([
      "LINE",
      "POLYLINE",
      "CIRCLE",
      "ARC",
      "TEXT",
    ]);
    expect(blocks).toEqual({});
  });

  it("extracts the geometry of each entity", async () => {
    const { entities } = await parsedFixture("r12-without-blocks.dxf");

    expect(entities).toEqual([
      { type: "LINE", layer: "WALLS", start: { x: 0, y: 0 }, end: { x: 100, y: 50 } },
      {
        type: "POLYLINE",
        layer: "WALLS",
        closed: true,
        vertices: [
          { x: 10, y: 10, bulge: 0 },
          { x: 20, y: 10, bulge: 0 },
          { x: 20, y: 20, bulge: 0 },
        ],
      },
      { type: "CIRCLE", layer: "WALLS", center: { x: 50, y: 50 }, radius: 10 },
      {
        type: "ARC",
        layer: "WALLS",
        center: { x: 0, y: 0 },
        radius: 20,
        startAngle: 0,
        endAngle: Math.PI / 2,
      },
      {
        type: "TEXT",
        layer: "NOTES",
        text: "Hello",
        position: { x: 5, y: -5 },
        height: 2.5,
        rotation: 0,
      },
    ]);
  });

  it("extracts the layers with their name, color and visibility", async () => {
    const { layers } = await parsedFixture("r12-without-blocks.dxf");

    expect(layers).toContainEqual({ name: "WALLS", color: 0xff0000, visible: true });
    expect(layers).toContainEqual({ name: "NOTES", color: 0x00ff00, visible: false });
    expect(layers.map((layer) => layer.name)).toContain("0");
  });

  it("computes the extent from the geometry", async () => {
    const { meta } = await parsedFixture("r12-without-blocks.dxf");

    // Line up to (100, 50), circle up to y = 60, text down to y = -5.
    expectExtent(meta.extent, { min: { x: 0, y: -5 }, max: { x: 100, y: 60 } });
  });
});

describe("parseDxf on a R2000 plan with blocks", () => {
  it("reads the DXF version and the units", async () => {
    const { meta } = await parsedFixture("r2000-with-blocks.dxf");

    expect(meta.dxfVersion).toBe("R2000");
    expect(meta.units).toBe("millimeters");
  });

  it("counts the entity types, even those the parser cannot read", async () => {
    const { meta } = await parsedFixture("r2000-with-blocks.dxf");

    expect(meta.entityCounts).toEqual({
      INSERT: 3,
      LWPOLYLINE: 1,
      MTEXT: 1,
      ELLIPSE: 1,
      HATCH: 1,
    });
  });

  it("keeps the block definitions, indexed by name", async () => {
    const { blocks } = await parsedFixture("r2000-with-blocks.dxf");

    expect(Object.keys(blocks).toSorted()).toEqual(["DOOR", "TABLE"]);
    expect(blocks.TABLE?.basePoint).toEqual({ x: 5, y: 5 });
    expect(blocks.DOOR?.entities.map((entity) => entity.type)).toEqual(["LINE", "ARC"]);
  });

  it("references blocks from the INSERTs with their transformation, without flattening", async () => {
    const { entities } = await parsedFixture("r2000-with-blocks.dxf");
    const inserts = entities.filter((entity) => entity.type === "INSERT");

    expect(inserts).toEqual([
      {
        type: "INSERT",
        layer: "DOORS",
        block: "DOOR",
        position: { x: 100, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: Math.PI / 2,
      },
      {
        type: "INSERT",
        layer: "DOORS",
        block: "DOOR",
        position: { x: 0, y: 0 },
        scale: { x: 2, y: 2 },
        rotation: 0,
      },
      {
        type: "INSERT",
        layer: "FURNITURE",
        block: "TABLE",
        position: { x: 50, y: 50 },
        scale: { x: 1, y: 1 },
        rotation: 0,
      },
    ]);
    expect(entities.map((entity) => entity.type)).not.toContain("ARC");
  });

  it("extracts light polylines with their bulges, and multiline texts", async () => {
    const { entities } = await parsedFixture("r2000-with-blocks.dxf");

    expect(entities).toContainEqual({
      type: "LWPOLYLINE",
      layer: "0",
      closed: false,
      vertices: [
        { x: 0, y: -10, bulge: 1 },
        { x: 20, y: -10, bulge: 0 },
      ],
    });
    expect(entities).toContainEqual({
      type: "MTEXT",
      layer: "0",
      text: "Ground floor",
      position: { x: 30, y: 70 },
      height: 3,
      width: 0,
      rotation: 0,
      attachmentPoint: 1,
    });
  });

  it("hides frozen layers", async () => {
    const { layers } = await parsedFixture("r2000-with-blocks.dxf");

    expect(layers).toContainEqual({ name: "FURNITURE", color: 0xffff00, visible: false });
    expect(layers).toContainEqual({ name: "DOORS", color: 0x0000ff, visible: true });
  });

  it("computes the extent through the block insertions and the bulges", async () => {
    const { meta } = await parsedFixture("r2000-with-blocks.dxf");

    // Rotated door down to x = 90..100, table around (50, 50), bulge down to
    // y = -20, text up to y = 70.
    expectExtent(meta.extent, { min: { x: 0, y: -20 }, max: { x: 100, y: 70 } });
  });
});

describe("parseDxf on a R2018 plan with nested blocks", () => {
  it("reads the DXF version and the units", async () => {
    const { meta } = await parsedFixture("r2018-nested-blocks.dxf");

    expect(meta.dxfVersion).toBe("R2018");
    expect(meta.units).toBe("meters");
  });

  it("leaves the paper space out", async () => {
    const { entities, meta } = await parsedFixture("r2018-nested-blocks.dxf");

    expect(meta.entityCounts).toEqual({ INSERT: 2, LINE: 1, SPLINE: 1 });
    expect(entities.map((entity) => entity.type)).toEqual(["INSERT", "INSERT", "LINE"]);
  });

  it("keeps nested insertions inside their block", async () => {
    const { blocks } = await parsedFixture("r2018-nested-blocks.dxf");

    expect(blocks.DESK?.entities).toContainEqual({
      type: "INSERT",
      layer: "CHAIRS",
      block: "CHAIR",
      position: { x: 1, y: -0.5 },
      scale: { x: 1, y: 1 },
      rotation: 0,
    });
  });

  it("extracts every layer", async () => {
    const { layers } = await parsedFixture("r2018-nested-blocks.dxf");

    expect(layers.map((layer) => layer.name).toSorted()).toEqual([
      "0",
      "AXES",
      "CHAIRS",
      "DESKS",
      "Defpoints",
    ]);
  });

  it("computes the extent through nested and rotated insertions", async () => {
    const { meta } = await parsedFixture("r2018-nested-blocks.dxf");

    // Desk at the origin with its chair down to y = -1, and the desk rotated by
    // 180° at (5, 0), which spans x = 3..5.
    expectExtent(meta.extent, { min: { x: 0, y: -1 }, max: { x: 5, y: 1 } });
  });
});
