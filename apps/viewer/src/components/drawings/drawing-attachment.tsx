import { FileText, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import {
  Attachment,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import type { CardView } from "@/drawings/card-view";

/** The card of a Dessin or of an Upload; its actions come as children. */
export function DrawingAttachment({
  name,
  view,
  children,
}: {
  name: string;
  view: CardView;
  children?: ReactNode;
}) {
  return (
    <Attachment state={view.state} className="w-full" aria-label={name}>
      <AttachmentMedia>
        <CardIcon state={view.state} />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{name}</AttachmentTitle>
        <AttachmentDescription>{view.description}</AttachmentDescription>
        {view.progress === null ? null : (
          <Progress value={view.progress} className="mt-1.5" aria-label={`Upload de ${name}`} />
        )}
      </AttachmentContent>
      {children ? <AttachmentActions>{children}</AttachmentActions> : null}
    </Attachment>
  );
}

function CardIcon({ state }: { state: CardView["state"] }) {
  switch (state) {
    case "error": {
      return <TriangleAlert aria-hidden />;
    }

    case "processing": {
      return <Spinner />;
    }

    default: {
      return <FileText aria-hidden />;
    }
  }
}
