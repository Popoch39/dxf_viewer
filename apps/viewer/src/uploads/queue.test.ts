import { describe, expect, it } from "vitest";

import { nextToStart, type UploadPhase } from "./queue";

function uploads(...phases: UploadPhase[]) {
  return phases.map((phase, index) => ({ id: index, phase }));
}

describe("nextToStart", () => {
  it("starts the oldest waiting Uploads, up to the limit", () => {
    expect(nextToStart(uploads("waiting", "waiting", "waiting", "waiting"), 3)).toEqual([
      { id: 0, phase: "waiting" },
      { id: 1, phase: "waiting" },
      { id: 2, phase: "waiting" },
    ]);
  });

  it("counts the Uploads already running", () => {
    expect(nextToStart(uploads("creating", "uploading", "waiting", "waiting"), 3)).toEqual([
      { id: 2, phase: "waiting" },
    ]);
  });

  it("starts nothing while the limit is reached", () => {
    expect(nextToStart(uploads("uploading", "completing", "creating", "waiting"), 3)).toEqual([]);
  });

  it("does not count failed Uploads", () => {
    expect(nextToStart(uploads("error", "error", "error", "waiting"), 3)).toEqual([
      { id: 3, phase: "waiting" },
    ]);
  });
});
