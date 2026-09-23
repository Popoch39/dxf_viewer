import { describe, expect, it } from "bun:test";

import { InvalidDxfError, parseDxf } from "../src";
import { fixture } from "./fixtures";

describe("parseDxf on invalid input", () => {
  it("rejects a truncated file", async () => {
    const text = await fixture("corrupt.dxf");

    expect(() => parseDxf(text)).toThrow(InvalidDxfError);
  });

  it.each([
    ["an empty file", ""],
    ["plain text", "hello world\nthis is not a drawing\n"],
    ["a file without any entity section", "  0\nEOF\n"],
    ["a JSON document", '{ "entities": [] }'],
  ])("rejects %s", (_label, text) => {
    expect(() => parseDxf(text)).toThrow(InvalidDxfError);
  });

  it("rejects binary DXF with an explicit message", () => {
    expect(() => parseDxf("AutoCAD Binary DXF\r\n\u001A\u0000")).toThrow(/binary DXF/iu);
  });

  it("explains why the file was refused", async () => {
    const text = await fixture("corrupt.dxf");

    expect(() => parseDxf(text)).toThrow(/^The file is not a valid DXF: .+/u);
  });
});
