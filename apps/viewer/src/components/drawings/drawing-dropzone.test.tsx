import { fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DrawingDropzone } from "./drawing-dropzone";

function dxf(name: string): File {
  return new File(["0\nEOF\n"], name);
}

describe("DrawingDropzone", () => {
  it("hands over the picked files", async () => {
    const onFiles = vi.fn<(files: File[]) => void>();
    const files = [dxf("a.dxf"), dxf("b.dxf")];
    render(<DrawingDropzone onFiles={onFiles} />);

    await userEvent.setup().upload(screen.getByLabelText("Fichiers DXF"), files);

    expect(onFiles).toHaveBeenCalledExactlyOnceWith(files);
  });

  it("hands over the dropped files", () => {
    const onFiles = vi.fn<(files: File[]) => void>();
    const file = dxf("a.dxf");
    render(<DrawingDropzone onFiles={onFiles} />);

    fireEvent.drop(screen.getByText("Glissez vos fichiers DXF ici, ou"), {
      dataTransfer: { files: [file] },
    });

    expect(onFiles).toHaveBeenCalledExactlyOnceWith([file]);
  });

  it("opens the file picker from its button", async () => {
    render(<DrawingDropzone onFiles={vi.fn()} />);
    const input = screen.getByLabelText<HTMLInputElement>("Fichiers DXF");
    const click = vi.spyOn(input, "click");

    await userEvent.setup().click(screen.getByRole("button", { name: "Ouvrir des fichiers DXF" }));

    expect(click).toHaveBeenCalledOnce();
  });
});
