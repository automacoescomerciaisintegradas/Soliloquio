import { Redirect, Route, Switch, useLocation } from "wouter";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "@/pages/Login";
import Chat from "@/pages/Chat";
import Home from "@/pages/Home";
import ErrorBoundary from "@/components/ErrorBoundary";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="text-gray-600">Carregando...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { usuario, carregando } = useAuth();
  const [localizacao] = useLocation();

  const rotaAtual = `${localizacao}${window.location.search}`;
  const destinoLogin = `/login?next=${encodeURIComponent(rotaAtual)}`;

  if (carregando) {
    return <LoadingScreen />;
  }

  if (!usuario) {
    return <Redirect to={destinoLogin} />;
  }

  return <Component />;
}

function ChatProtegido() {
  return <ProtectedRoute component={Chat} />;
}

function AppRoutes() {
  const { carregando } = useAuth();

  if (carregando) {
    return <LoadingScreen />;
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/entrar" component={Login} />
      <Route path="/app" component={ChatProtegido} />
      <Route path="/chat" component={ChatProtegido} />
      <Route component={() => <div>Página não encontrada</div>} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  );
}
