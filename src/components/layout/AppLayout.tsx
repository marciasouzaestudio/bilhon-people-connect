import { Suspense } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { useApp } from "@/contexts/AppContext";

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export function AppLayout() {
  const { isConfigured, onboardingCompleted, configLoading } = useApp();

  if (configLoading) return null;

  // Redireciona para setup apenas na primeira vez (onboarding não completado E sem config)
  if (!isConfigured && !onboardingCompleted) {
    return <Navigate to="/setup" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="min-h-[calc(100vh-4rem)]">
        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          {/* Suspense do CONTEÚDO fica aqui dentro (e não em volta de <Routes>) para
              que o carregamento lazy de cada página NÃO desmonte os menus/layout —
              era isso que dava a sensação de "refresh completo" a cada navegação. */}
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
