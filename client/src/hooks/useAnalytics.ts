/**
 * useAnalytics Hook
 * Facilita o rastreamento de eventos no Google Analytics
 * Utiliza a API window.gtag() que já está carregada via script
 */

export function useAnalytics() {
  const trackEvent = (
    eventName: string,
    eventParams?: Record<string, string | number | boolean>
  ) => {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", eventName, eventParams);
    }
  };

  const trackPageView = (pagePath: string, pageTitle: string) => {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("config", import.meta.env.VITE_ANALYTICS_WEBSITE_ID, {
        page_path: pagePath,
        page_title: pageTitle,
      });
    }
  };

  return {
    trackEvent,
    trackPageView,
  };
}

/**
 * Eventos Customizados para Rastreamento
 */
export const ANALYTICS_EVENTS = {
  // CTAs
  CTA_HERO_CLICKED: "cta_hero_clicked",
  CTA_HERO_LEARN_MORE: "cta_hero_learn_more",
  CTA_BOTTOM_CLICKED: "cta_bottom_clicked",

  // Newsletter
  NEWSLETTER_SUBMITTED: "newsletter_submitted",
  NEWSLETTER_ERROR: "newsletter_error",

  // WhatsApp
  WHATSAPP_CLICKED: "whatsapp_clicked",

  // Scroll
  SCROLL_TO_SECTION: "scroll_to_section",

  // Books
  BOOK_VIEWED: "book_viewed",

  // Conversions
  CONVERSION_NEWSLETTER: "conversion_newsletter",
  CONVERSION_WHATSAPP: "conversion_whatsapp",
};
