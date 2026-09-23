import { X } from "lucide-react";

import {
  type DrawingSummary,
  useCancelUpload,
  useDeleteDrawing,
  useDrawings,
  useDrawingStatus,
} from "@/api/drawings";
import { AttachmentAction } from "@/components/ui/attachment";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { describeDrawing, describeUpload } from "@/drawings/card-view";
import { type Upload, useUploadOf, useUploads } from "@/store/upload-store";

import { DeleteDrawingDialog } from "./delete-drawing-dialog";
import { DrawingAttachment } from "./drawing-attachment";

/** The Uploads not yet tied to a Dessin, then the caller's Dessins. */
export function DrawingList() {
  const drawings = useDrawings();
  const uploads = useUploads();
  const localUploads = uploads.filter((upload) => upload.drawingId === null);

  if (drawings.isPending) {
    return <DrawingListSkeleton />;
  }

  if (drawings.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Impossible de charger vos Dessins. Réessayez dans un instant.
      </p>
    );
  }

  if (localUploads.length === 0 && drawings.data.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun Dessin pour l'instant.</p>;
  }

  return (
    <ul aria-label="Dessins" className="grid gap-3 sm:grid-cols-2">
      {localUploads.map((upload) => (
        <li key={upload.localId}>
          <LocalUploadCard upload={upload} />
        </li>
      ))}
      {drawings.data.map((drawing) => (
        <li key={drawing.id}>
          <DrawingCard drawing={drawing} />
        </li>
      ))}
    </ul>
  );
}

/** The list while the Dessins load, at the size of a few cards. */
export function DrawingListSkeleton() {
  return (
    <output aria-label="Chargement" className="grid gap-3 sm:grid-cols-2">
      <Skeleton className="h-14 rounded-xl" />
      <Skeleton className="h-14 rounded-xl" />
      <Skeleton className="h-14 rounded-xl" />
      <Skeleton className="h-14 rounded-xl" />
    </output>
  );
}

function LocalUploadCard({ upload }: { upload: Upload }) {
  const cancel = useCancelUpload();
  const { name } = upload.file;

  return (
    <DrawingAttachment name={name} view={describeUpload(upload)}>
      <AttachmentAction
        aria-label={upload.phase === "error" ? `Fermer ${name}` : `Annuler l'Upload de ${name}`}
        onClick={() => {
          cancel(upload.localId);
        }}
      >
        <X aria-hidden />
      </AttachmentAction>
    </DrawingAttachment>
  );
}

function DrawingCard({ drawing }: { drawing: DrawingSummary }) {
  const upload = useUploadOf(drawing.id);

  useDrawingStatus(drawing.id, drawing.status === "queued" || drawing.status === "parsing");

  return (
    <DrawingAttachment name={drawing.name} view={describeDrawing(drawing, upload)}>
      <DrawingCardAction drawing={drawing} upload={upload} />
    </DrawingAttachment>
  );
}

function DrawingCardAction({
  drawing,
  upload,
}: {
  drawing: DrawingSummary;
  upload: Upload | undefined;
}) {
  if (upload !== undefined) {
    return <CancelUploadAction upload={upload} name={drawing.name} />;
  }

  if (drawing.status === "awaiting_upload") {
    return <DiscardDrawingAction id={drawing.id} name={drawing.name} />;
  }

  return <DeleteDrawingDialog id={drawing.id} name={drawing.name} />;
}

function CancelUploadAction({ upload, name }: { upload: Upload; name: string }) {
  const cancel = useCancelUpload();

  // Past this point the Fichier source is handed to the Parsing.
  if (upload.phase === "completing") {
    return null;
  }

  return (
    <AttachmentAction
      aria-label={`Annuler l'Upload de ${name}`}
      onClick={() => {
        cancel(upload.localId);
      }}
    >
      <X aria-hidden />
    </AttachmentAction>
  );
}

// An interrupted Upload: the Dessin has nothing to lose, no confirmation.
function DiscardDrawingAction({ id, name }: { id: string; name: string }) {
  const deletion = useDeleteDrawing();

  return (
    <AttachmentAction
      aria-label={`Supprimer ${name}`}
      disabled={deletion.isPending}
      onClick={() => {
        deletion.mutate(id);
      }}
    >
      {deletion.isPending ? <Spinner /> : <X aria-hidden />}
    </AttachmentAction>
  );
}
