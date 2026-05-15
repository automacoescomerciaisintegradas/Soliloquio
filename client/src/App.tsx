import { Route, Switch } from "wouter";
import Home from "@/pages/Home";
import Checkout from "@/pages/Checkout";
import ErrorBoundary from "@/components/ErrorBoundary";
import WhatsAppButton from "@/components/WhatsAppButton";

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/checkout" component={Checkout} />
      <Route component={() => <div>Página não encontrada</div>} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppRoutes />
      <WhatsAppButton />
    </ErrorBoundary>
  );
}
