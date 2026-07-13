import { BrainCircuit } from "lucide-react";
import { Outlet } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BrainCircuit className="size-4" />
          </div>
          EngineerBrain
        </div>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <Outlet />
      </main>
    </div>
  );
}
