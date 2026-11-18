import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <section
      aria-labelledby="auth-title"
      className="w-full rounded-xl border bg-card p-6 shadow-sm sm:p-8"
    >
      <header className="mb-6 flex flex-col gap-1.5">
        <h1 id="auth-title" className="text-xl font-semibold tracking-tight">
          {title}
        </h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </header>
      {children}
      {footer && (
        <footer className="mt-6 text-center text-sm text-muted-foreground">{footer}</footer>
      )}
    </section>
  );
}
