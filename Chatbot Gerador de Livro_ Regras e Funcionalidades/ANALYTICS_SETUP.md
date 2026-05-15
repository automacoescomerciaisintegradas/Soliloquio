# Configuração do Google Analytics

## Visão Geral

A landing page "Solilóquios para a Alma" está integrada com Google Analytics para rastreamento de eventos e conversões. O sistema utiliza o hook `useAnalytics()` para facilitar o rastreamento de eventos customizados.

## Eventos Rastreados

### CTAs (Calls to Action)
- **cta_hero_clicked**: Clique no botão "Garantir Minha Coleção" na seção hero
- **cta_hero_learn_more**: Clique no botão "Saber Mais" na seção hero
- **cta_bottom_clicked**: Clique no botão "Garantir Minha Coleção" na seção de CTA inferior

### Newsletter
- **newsletter_submitted**: Inscrição bem-sucedida na newsletter
- **newsletter_error**: Erro ao tentar se inscrever na newsletter

### WhatsApp
- **whatsapp_clicked**: Clique no botão flutuante do WhatsApp

### Conversões
- **conversion_newsletter**: Conversão de inscrição na newsletter
- **conversion_whatsapp**: Conversão de contato via WhatsApp

## Como Configurar

### 1. Adicionar o ID do Google Analytics

O script do Google Analytics já está carregado via `client/index.html`. Você precisa configurar a variável de ambiente:

```bash
VITE_ANALYTICS_WEBSITE_ID=G-XXXXXXXXXX
```

Substitua `G-XXXXXXXXXX` pelo seu ID de propriedade do Google Analytics 4.

### 2. Verificar a Integração

O script já está inserido no `client/index.html`:

```html
<script
  defer
  src="%VITE_ANALYTICS_ENDPOINT%/umami"
  data-website-id="%VITE_ANALYTICS_WEBSITE_ID%"
></script>
```

### 3. Usar o Hook useAnalytics

Para rastrear eventos em qualquer componente:

```tsx
import { useAnalytics, ANALYTICS_EVENTS } from "@/hooks/useAnalytics";

export function MyComponent() {
  const { trackEvent } = useAnalytics();

  const handleClick = () => {
    trackEvent(ANALYTICS_EVENTS.CTA_HERO_CLICKED, {
      button_location: "hero_section",
    });
  };

  return <button onClick={handleClick}>Clique aqui</button>;
}
```

## Métricas Importantes para Monitorar

1. **Taxa de Clique nos CTAs**: Monitore qual botão recebe mais cliques
2. **Taxa de Conversão de Newsletter**: Acompanhe quantos visitantes se inscrevem
3. **Taxa de Contato via WhatsApp**: Veja quantos visitantes entram em contato
4. **Tempo na Página**: Identifique quanto tempo os visitantes passam na landing page
5. **Taxa de Rejeição**: Monitore se os visitantes saem rapidamente

## Dashboard Recomendado

Crie um dashboard no Google Analytics com as seguintes métricas:

- Eventos por tipo (CTA, Newsletter, WhatsApp)
- Taxa de conversão por evento
- Origem do tráfego
- Dispositivo (mobile vs desktop)
- Localização geográfica
- Tempo médio na página

## Próximos Passos

1. **Configurar Metas**: No Google Analytics, crie metas para cada tipo de conversão
2. **Implementar Pixel do Facebook**: Para rastreamento em campanhas de anúncios
3. **Adicionar Rastreamento de Scroll**: Para entender até onde os visitantes scrollam
4. **Implementar A/B Testing**: Teste diferentes versões de CTAs e headlines

## Troubleshooting

Se os eventos não estão sendo rastreados:

1. Verifique se o ID do Google Analytics está correto
2. Abra o DevTools e procure por erros no console
3. Verifique se o script está carregando corretamente
4. Confirme que `window.gtag` está disponível no navegador

## Referências

- [Google Analytics 4 Documentation](https://support.google.com/analytics/answer/10089681)
- [Google Analytics Events](https://support.google.com/analytics/answer/9322688)
