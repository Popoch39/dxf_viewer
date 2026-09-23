/** Text of a DXF file of `test/fixtures`. */
export function fixture(name: string): Promise<string> {
  return Bun.file(new URL(`fixtures/${name}`, import.meta.url)).text();
}
