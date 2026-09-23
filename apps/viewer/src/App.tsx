import { Button } from "@/components/ui/button";

function App() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">DXF Viewer</h1>
      <Button>Ouvrir un fichier DXF</Button>
    </main>
  );
}

export default App;
