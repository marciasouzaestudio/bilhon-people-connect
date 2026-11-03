import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useApp } from "@/contexts/AppContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/use-role";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader2 } from "lucide-react";

// Auth pages (not lazy — need fast load)
import Login from "./pages/Login";
import UpdatePassword from "./pages/UpdatePassword";

// App pages (lazy loaded)
const Setup = lazy(() => import("./pages/Setup"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Sources = lazy(() => import("./pages/Sources"));
const Gallery = lazy(() => import("./pages/Gallery"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Brands = lazy(() => import("./pages/Brands"));
const Lab = lazy(() => import("./pages/Lab"));
const Studio = lazy(() => import("./pages/Studio"));
const Autopilot = lazy(() => import("./pages/Autopilot"));
const Creatives = lazy(() => import("./pages/Creatives"));
const Admin = lazy(() => import("./pages/Admin"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

// Redirect to login if not authenticated
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthEnabled } = useAuth();

  if (loading) return <PageLoader />;
  if (!isAuthEnabled) return <>{children}</>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Redirect to /setup if onboarding not completed
function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const { onboardingCompleted, configLoading } = useApp();
  if (configLoading) return <PageLoader />;
  if (!onboardingCompleted) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

// Restringe a rota a administradores da plataforma
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useRole();
  if (loading) return <PageLoader />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// Redirect to dashboard if already authenticated
function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthEnabled } = useAuth();

  if (loading) return <PageLoader />;
  // If auth not configured, show the page (login will work when configured)
  if (!isAuthEnabled) return <>{children}</>;
  // Já autenticado: vai ao dashboard (RequireOnboarding cuida de quem falta onboarding).
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Auth routes (guest only) */}
                  <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
                  {/* go-live: /signup e /forgot-password removidos (provisão controlada) */}
                  <Route path="/update-password" element={<UpdatePassword />} />

                  {/* Onboarding (authenticated) */}
                  <Route path="/setup" element={<RequireAuth><Setup /></RequireAuth>} />

                  {/* App routes (authenticated + onboarded + layout) */}
                  <Route element={<RequireAuth><RequireOnboarding><AppLayout /></RequireOnboarding></RequireAuth>}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/accounts" element={<Accounts />} />
                    <Route path="/studio" element={<Studio />} />
                    {/* Telas antigas aposentadas — redirecionam ao Studio unificado */}
                    <Route path="/create" element={<Navigate to="/studio" replace />} />
                    <Route path="/carousel" element={<Navigate to="/studio" replace />} />
                    <Route path="/visuals" element={<Navigate to="/studio" replace />} />
                    {/* Criativos para Meta Ads (módulo separado do Studio) */}
                    <Route path="/criativos" element={<Creatives />} />
                    <Route path="/gallery" element={<Gallery />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/lab" element={<Lab />} />
                    <Route path="/schedule" element={<Schedule />} />
                    <Route path="/sources" element={<Sources />} />
                    <Route path="/brands" element={<Brands />} />
                    {/* Diagnóstico fundido nas Métricas — redireciona quem tiver link salvo */}
                    <Route path="/insights" element={<Navigate to="/analytics" replace />} />
                    <Route path="/autopilot" element={<Autopilot />} />
                    <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
                  </Route>

                  {/* Redirects */}
                  <Route path="/" element={<Navigate to="/login" replace />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </AppProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
