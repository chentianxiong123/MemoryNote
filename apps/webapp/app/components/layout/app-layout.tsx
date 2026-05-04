import { cn } from "~/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AppContainer({ children, className }: AppLayoutProps) {
  return (
    <div className={cn("flex min-h-screen flex-col", className)}>
      {children}
    </div>
  );
}

export function MainCenteredContainer({ children, className }: AppLayoutProps) {
  return (
    <div className={cn("flex flex-1 items-center justify-center", className)}>
      {children}
    </div>
  );
}

export function MainContainer({ children, className }: AppLayoutProps) {
  return (
    <main className={cn("flex-1", className)}>
      {children}
    </main>
  );
}

export function SidebarContainer({ children, className }: AppLayoutProps) {
  return (
    <aside className={cn("w-64 border-r", className)}>
      {children}
    </aside>
  );
}

export function HeaderContainer({ children, className }: AppLayoutProps) {
  return (
    <header className={cn("border-b", className)}>
      {children}
    </header>
  );
}
