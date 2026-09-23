import { describe, expect, it } from "vitest";

import { drawingNameFrom, isDxfFile } from "./validation";

describe("isDxfFile", () => {
  it("accepts a .dxf file, whatever the case of its extension", () => {
    expect(isDxfFile("plan.dxf")).toBe(true);
    expect(isDxfFile("PLAN.DXF")).toBe(true);
  });

  it("refuses any other file", () => {
    expect(isDxfFile("plan.dwg")).toBe(false);
    expect(isDxfFile("plan.dxf.txt")).toBe(false);
    expect(isDxfFile(".dxf")).toBe(false);
  });
});

describe("drawingNameFrom", () => {
  it("drops the extension", () => {
    expect(drawingNameFrom("plan rdc.DXF")).toBe("plan rdc");
  });

  it("keeps the file name when nothing is left without the extension", () => {
    expect(drawingNameFrom("  .dxf")).toBe("  .dxf");
  });

  it("fits the name within 200 characters", () => {
    expect(drawingNameFrom(`${"a".repeat(300)}.dxf`)).toHaveLength(200);
  });
});
