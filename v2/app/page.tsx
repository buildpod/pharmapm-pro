import { Button } from "@/components/ui/button";
import { FlaskConical } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-10 w-10 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            AivelloStudio RIM
          </h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Pharma project management — enterprise grade.
        </p>
      </div>

      <div className="flex flex-col items-center gap-6 rounded-xl border border-border bg-card p-10 shadow-sm">
        <p className="text-2xl font-semibold text-foreground">Hello, RIM</p>
        <p className="max-w-xs text-center text-sm text-muted-foreground">
          Stack confirmed: Next.js 14 · TypeScript · Tailwind · shadcn/ui
        </p>
        <Button size="lg">
          Get Started
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" size="sm">
            View v1
          </Button>
          <Button variant="ghost" size="sm">
            Learn more
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        M1 — Project setup · AivelloStudio RIM v2
      </p>
    </main>
  );
}
