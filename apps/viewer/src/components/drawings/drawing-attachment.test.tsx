import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DrawingAttachment } from "./drawing-attachment";

describe("DrawingAttachment", () => {
  it("shows the progress of an Upload", () => {
    render(
      <DrawingAttachment
        name="plan-rdc.dxf"
        view={{ state: "uploading", description: "50 %", progress: 50 }}
      />,
    );

    expect(screen.getByRole("progressbar", { name: "Upload de plan-rdc.dxf" })).toBeDefined();
    expect(screen.getByText("50 %")).toBeDefined();
  });

  it("has no progress bar once the Upload is over", () => {
    render(
      <DrawingAttachment
        name="plan-rdc"
        view={{ state: "done", description: "4 entités", progress: null }}
      />,
    );

    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("renders its actions", () => {
    render(
      <DrawingAttachment name="plan-rdc" view={{ state: "error", description: "", progress: null }}>
        <button type="button">Supprimer</button>
      </DrawingAttachment>,
    );

    expect(screen.getByRole("button", { name: "Supprimer" })).toBeDefined();
  });
});
