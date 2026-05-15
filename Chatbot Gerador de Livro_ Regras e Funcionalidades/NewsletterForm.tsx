import { Button } from "@/components/ui/button";
import { Mail, CheckCircle, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useAnalytics, ANALYTICS_EVENTS } from "@/hooks/useAnalytics";

/**
 * NewsletterForm Component
 * Captura de e-mails para newsletter com validação e feedback visual
 * Design: Minimalismo Cinematográfico
 */

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const { trackEvent } = useAnalytics();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação básica de e-mail
    if (!email || !email.includes("@")) {
      setStatus("error");
      setMessage("Por favor, insira um e-mail válido.");
      return;
    }

    setStatus("loading");

    // Simular envio (em produção, isso seria uma chamada à API)
    try {
      // Aqui você integraria com um serviço como Mailchimp, ConvertKit, etc.
      // Por enquanto, simulamos um delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setStatus("success");
      setMessage("✓ Inscrição confirmada! Verifique seu e-mail.");
      
      // Rastrear evento de conversão
      trackEvent(ANALYTICS_EVENTS.NEWSLETTER_SUBMITTED, {
        email_domain: email.split("@")[1],
      });
      trackEvent(ANALYTICS_EVENTS.CONVERSION_NEWSLETTER, {
        conversion_type: "newsletter_signup",
      });
      
      setEmail("");

      // Resetar status após 5 segundos
      setTimeout(() => {
        setStatus("idle");
        setMessage("");
      }, 5000);
    } catch (error) {
      setStatus("error");
      setMessage("Algo deu errado. Tente novamente.");
      
      // Rastrear erro
      trackEvent(ANALYTICS_EVENTS.NEWSLETTER_ERROR, {
        error_type: "submission_failed",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            type="email"
            placeholder="Seu melhor e-mail..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === "loading"}
            className="w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder-gray-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all disabled:opacity-50"
          />
          <Mail className="absolute right-3 top-3.5 text-accent opacity-50" size={20} />
        </div>
        <Button
          type="submit"
          disabled={status === "loading"}
          className="bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 px-6 whitespace-nowrap"
        >
          {status === "loading" ? "Inscrevendo..." : "Inscrever"}
        </Button>
      </div>

      {/* Feedback Messages */}
      {message && (
        <div
          className={`mt-3 flex items-center gap-2 text-sm transition-all ${
            status === "success" ? "text-green-400" : "text-red-400"
          }`}
        >
          {status === "success" ? (
            <CheckCircle size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{message}</span>
        </div>
      )}

      {/* Privacy Notice */}
      <p className="text-xs text-gray-500 mt-3">
        Respeitamos sua privacidade. Você pode se desinscrever a qualquer momento.
      </p>
    </form>
  );
}
