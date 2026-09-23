import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { drawingQueries, useStartUploads } from "@/api/drawings";
import { DrawingDropzone } from "@/components/drawings/drawing-dropzone";
import { DrawingList, DrawingListSkeleton } from "@/components/drawings/drawing-list";

export const Route = createFileRoute("/_authenticated/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(drawingQueries.list()),
  pendingComponent: HomePending,
  component: HomePage,
});

function HomePage() {
  const startUploads = useStartUploads();

  return (
    <HomeLayout dropzone={<DrawingDropzone onFiles={startUploads} />}>
      <DrawingList />
    </HomeLayout>
  );
}

function HomePending() {
  return (
    <HomeLayout dropzone={<DrawingDropzone onFiles={() => {}} />}>
      <DrawingListSkeleton />
    </HomeLayout>
  );
}

function HomeLayout({ dropzone, children }: { dropzone: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Mes Dessins</h1>
      {dropzone}
      {children}
    </main>
  );
}
