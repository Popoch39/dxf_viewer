import { describe, expect, it } from "vitest";

import type { DrawingSummary } from "@/api/drawings";
import type { Upload } from "@/store/upload-store";

import { describeDrawing, describeUpload } from "./card-view";

function drawing(status: DrawingSummary["status"]): DrawingSummary {
  return {
    id: "0199a000-0000-7000-8000-000000000000",
    name: "plan-rdc",
    description: null,
    status,
    error: null,
    sizeBytes: null,
    dxfVersion: null,
    units: null,
    extent: null,
    layers: null,
    entityCounts: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    parsedAt: null,
  };
}

function upload(phase: Upload["phase"]): Upload {
  return {
    localId: "local",
    file: new File(["x".repeat(2048)], "plan-rdc.dxf"),
    drawingId: null,
    phase,
    loaded: 0,
    samples: [],
    error: null,
  };
}

describe("describeUpload", () => {
  it("shows a waiting Upload with its size", () => {
    expect(describeUpload(upload("waiting"))).toEqual({
      state: "idle",
      description: "En attente · 2 Ko",
      progress: null,
    });
  });

  it("shows the progress and the time left of a running Upload", () => {
    const running = {
      ...upload("uploading"),
      loaded: 1024,
      samples: [
        { at: 0, loaded: 0 },
        { at: 1000, loaded: 1024 },
      ],
    };

    expect(describeUpload(running)).toEqual({
      state: "uploading",
      description: "1 Ko sur 2 Ko · 50 % · 1 s restantes",
      progress: 50,
    });
  });

  it("waits for enough samples before telling the time left", () => {
    expect(describeUpload(upload("uploading")).description).toBe(
      "0 o sur 2 Ko · 0 % · calcul du temps restant…",
    );
  });

  it("shows the error of a failed Upload", () => {
    const failed = { ...upload("error"), error: "Ce fichier n'est pas un DXF." };

    expect(describeUpload(failed)).toEqual({
      state: "error",
      description: "Ce fichier n'est pas un DXF.",
      progress: null,
    });
  });
});

describe("describeDrawing", () => {
  it("shows the Upload of this tab first", () => {
    expect(describeDrawing(drawing("awaiting_upload"), upload("completing")).description).toBe(
      "Vérification du fichier…",
    );
  });

  it("shows an Upload that no tab carries on as interrupted", () => {
    expect(describeDrawing(drawing("awaiting_upload"))).toEqual({
      state: "error",
      description: "Upload interrompu",
      progress: null,
    });
  });

  it("follows the Parsing", () => {
    expect(describeDrawing(drawing("queued")).description).toBe("En file d'attente");
    expect(describeDrawing(drawing("parsing")).state).toBe("processing");
  });

  it("sums up a ready Dessin", () => {
    const ready = {
      ...drawing("ready"),
      sizeBytes: 1_572_864,
      dxfVersion: "AC1015",
      entityCounts: { LINE: 3, CIRCLE: 1 },
    };

    expect(describeDrawing(ready)).toEqual({
      state: "done",
      description: "1,5 Mo · DXF AC1015 · 4 entités",
      progress: null,
    });
  });

  it("shows the error of a failed Parsing", () => {
    const failed = { ...drawing("failed"), error: "Invalid DXF" };

    expect(describeDrawing(failed)).toEqual({
      state: "error",
      description: "Invalid DXF",
      progress: null,
    });
  });
});
