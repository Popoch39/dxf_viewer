import { TypeCompiler } from "@sinclair/typebox/compiler";

import { readDxf } from "./dxf-parser";
import type { RawBlock, RawDxf, RawEntity, RawLayer } from "./dxf-parser";
import { displayedEntities, point } from "./entities";
import { entitiesExtent } from "./extent";
import { DXF_UNITS, ParsedDrawing } from "./parsed-drawing";
import type { Block, EntityCounts, Layer, Units } from "./parsed-drawing";

/** The Fichier source cannot be read as a DXF. `message` is meant for the Propriétaire. */
export class InvalidDxfError extends Error {
  override readonly name = "InvalidDxfError";

  constructor(reason: string, cause?: unknown) {
    super(`The file is not a valid DXF: ${reason}`, { cause });
  }
}

const parsedDrawingSchema = TypeCompiler.Compile(ParsedDrawing);

/** `$ACADVER` codes, by release. */
const DXF_VERSIONS = new Map([
  ["AC1006", "R10"],
  ["AC1009", "R12"],
  ["AC1012", "R13"],
  ["AC1014", "R14"],
  ["AC1015", "R2000"],
  ["AC1018", "R2004"],
  ["AC1021", "R2007"],
  ["AC1024", "R2010"],
  ["AC1027", "R2013"],
  ["AC1032", "R2018"],
]);

/** Blocks that hold the layouts (`*Model_Space`, `$PAPER_SPACE`…) rather than a reusable definition. */
const LAYOUT_BLOCK = /^[*$](?:model|paper)_space/iu;

const BINARY_DXF_SENTINEL = "AutoCAD Binary DXF";

function entityCounts(entities: readonly RawEntity[]): EntityCounts {
  const counts = new Map<string, number>();

  for (const { type } of entities) counts.set(type, (counts.get(type) ?? 0) + 1);

  return Object.fromEntries(counts);
}

function displayedLayer(raw: RawLayer): Layer {
  return {
    name: raw.name,
    color: raw.color ?? 0xff_ff_ff,
    visible: (raw.visible ?? true) && raw.frozen !== true,
  };
}

function units(dxf: RawDxf): Units {
  return DXF_UNITS[dxf.header?.$INSUNITS ?? 0] ?? "unitless";
}

function dxfVersion(dxf: RawDxf): string | null {
  const code = dxf.header?.$ACADVER;

  return code === undefined ? null : (DXF_VERSIONS.get(code) ?? code);
}

function readableDxf(text: string): RawDxf & { entities: RawEntity[] } {
  if (text.startsWith(BINARY_DXF_SENTINEL)) {
    throw new InvalidDxfError("binary DXF is not supported, save the drawing as ASCII DXF");
  }

  let dxf: RawDxf | null;

  try {
    dxf = readDxf(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    throw new InvalidDxfError(`it is empty, truncated or corrupt (${detail})`, error);
  }

  if (dxf?.entities === undefined) throw new InvalidDxfError("it has no ENTITIES section");

  return { ...dxf, entities: dxf.entities };
}

function blockDefinition(raw: RawBlock, blockNames: ReadonlySet<string>): Block {
  return {
    basePoint: point(raw.position ?? { x: 0, y: 0 }),
    entities: displayedEntities(raw.entities ?? [], blockNames),
  };
}

/**
 * Parses the text of a Fichier source into a Dessin parsé, checked against the
 * `ParsedDrawing` schema. Throws an `InvalidDxfError` when the text is not a
 * readable ASCII DXF.
 */
export function parseDxf(text: string): ParsedDrawing {
  const dxf = readableDxf(text);

  const rawBlocks = Object.values(dxf.blocks ?? {}).filter(
    (block) => !LAYOUT_BLOCK.test(block.name),
  );

  const blockNames = new Set(rawBlocks.map((block) => block.name));

  const blocks = new Map(
    rawBlocks.map((block) => [block.name, blockDefinition(block, blockNames)]),
  );

  const modelSpace = dxf.entities.filter((raw) => raw.inPaperSpace !== true);
  const entities = displayedEntities(modelSpace, blockNames);

  const drawing: ParsedDrawing = {
    meta: {
      dxfVersion: dxfVersion(dxf),
      units: units(dxf),
      extent: entitiesExtent(entities, blocks),
      entityCounts: entityCounts(modelSpace),
    },
    layers: Object.values(dxf.tables?.layer?.layers ?? {}).map((raw) => displayedLayer(raw)),
    blocks: Object.fromEntries(blocks),
    entities,
  };

  if (!parsedDrawingSchema.Check(drawing)) {
    const issue = parsedDrawingSchema.Errors(drawing).First();

    throw new InvalidDxfError(`it holds unreadable values (${issue?.path}: ${issue?.message})`);
  }

  return drawing;
}
