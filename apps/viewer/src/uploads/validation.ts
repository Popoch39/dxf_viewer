const DXF_EXTENSION = ".dxf";

// The API caps the name of a Dessin at 200 characters.
const MAX_NAME_LENGTH = 200;

/** Whether a file can be sent as a Fichier source: only its extension is checked here. */
export function isDxfFile(filename: string): boolean {
  return filename.length > DXF_EXTENSION.length && filename.toLowerCase().endsWith(DXF_EXTENSION);
}

/** The name given to a new Dessin: its file name, without the extension. */
export function drawingNameFrom(filename: string): string {
  const name = isDxfFile(filename) ? filename.slice(0, -DXF_EXTENSION.length) : filename;

  return name.trim().slice(0, MAX_NAME_LENGTH) || filename.slice(0, MAX_NAME_LENGTH);
}
