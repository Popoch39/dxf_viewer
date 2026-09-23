import { Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Where DXF files are dropped or picked; each one becomes an Upload. Dropping
 * is a shortcut for the mouse: the button is the accessible way in.
 */
export function DrawingDropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      data-dragging={dragging}
      className="flex w-full flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition-colors data-[dragging=true]:border-primary data-[dragging=true]:bg-muted/50"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        const { currentTarget, relatedTarget } = event;

        if (!(relatedTarget instanceof Node && currentTarget.contains(relatedTarget))) {
          setDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        onFiles([...event.dataTransfer.files]);
      }}
    >
      <Upload aria-hidden className="size-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Glissez vos fichiers DXF ici, ou</p>
      <FilePicker onFiles={onFiles} />
    </div>
  );
}

function FilePicker({ onFiles }: { onFiles: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        onClick={() => {
          input.current?.click();
        }}
      >
        Ouvrir des fichiers DXF
      </Button>
      <input
        ref={input}
        type="file"
        accept=".dxf"
        multiple
        hidden
        aria-label="Fichiers DXF"
        onChange={(event) => {
          onFiles([...(event.currentTarget.files ?? [])]);
          // The same file can be picked again, once its card is dismissed.
          event.currentTarget.value = "";
        }}
      />
    </>
  );
}
