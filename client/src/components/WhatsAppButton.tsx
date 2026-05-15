import { MessageCircle } from "lucide-react";
import { useState } from "react";

/**
 * WhatsAppButton Component
 * Botão flutuante do WhatsApp no canto inferior direito
 * Design: Minimalismo Cinematográfico com animação suave
 */

export default function WhatsAppButton() {
  const [isHovered, setIsHovered] = useState(false);

  // Número do WhatsApp (formato: +55 41 92062-238)
  const phoneNumber = "5541992062238";
  const message = "Olá! Gostaria de saber mais sobre a coleção 'Solilóquios para a Alma'.";
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Tooltip */}
      {isHovered && (
        <div className="absolute bottom-16 right-0 bg-card border border-accent rounded-lg px-4 py-2 whitespace-nowrap text-sm text-foreground shadow-lg animate-in fade-in duration-200">
          <p className="font-semibold text-accent">Fale conosco!</p>
          <p className="text-gray-400">Responderemos em breve</p>
        </div>
      )}

      {/* Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex items-center justify-center w-14 h-14 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 group"
        aria-label="Contatar via WhatsApp"
      >
        <MessageCircle size={24} className="group-hover:scale-110 transition-transform" />
      </a>

      {/* Pulse Animation */}
      <div className="absolute inset-0 w-14 h-14 bg-green-500 rounded-full animate-pulse opacity-20"></div>
    </div>
  );
}
