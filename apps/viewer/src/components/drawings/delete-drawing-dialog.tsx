import { Trash2 } from "lucide-react";
import { useState } from "react";

import { useDeleteDrawing } from "@/api/drawings";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AttachmentAction } from "@/components/ui/attachment";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** The delete action of a Dessin's card, confirmed first: nothing can bring it back. */
export function DeleteDrawingDialog({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const deletion = useDeleteDrawing();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <AttachmentAction aria-label={`Supprimer ${name}`}>
          <Trash2 aria-hidden />
        </AttachmentAction>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer « {name} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            Le Fichier source et le Dessin parsé seront supprimés définitivement.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletion.isPending}>Annuler</AlertDialogCancel>
          {/* Not an AlertDialogAction, which would close before the deletion ends. */}
          <Button
            variant="destructive"
            disabled={deletion.isPending}
            onClick={() => {
              deletion.mutate(id, {
                onSuccess: () => {
                  setOpen(false);
                },
              });
            }}
          >
            {deletion.isPending ? <Spinner data-icon="inline-start" /> : null}
            Supprimer
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
