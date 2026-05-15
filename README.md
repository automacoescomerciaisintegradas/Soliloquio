# Soliloquio

Landing page premium + checkout PIX para venda da coleção de livros **Solilóquios para a Alma**.

## Stack

- Frontend: React + Vite + Tailwind
- Backend: Node + Express
- Build: `vite build` + `esbuild`

## Estrutura de Branches (Worktree)

- `main`: base estável
- `dev`: desenvolvimento de novas features
- `prod`: validação/publicação

## Rodando localmente

```bash
pnpm install
pnpm run dev
```

URLs locais:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

## Variáveis de ambiente principais

Copie `.env.example` para `.env` e ajuste:

```env
# PIX manual (sem PushinPay)
PIX_MANUAL_COPY_PASTE=
PIX_MANUAL_QR_BASE64=
PIX_MANUAL_AUTO_APPROVE=false

# Entrega
DELIVERY_URL=https://drive.google.com/...

# Produto
PRODUCT_NAME=Coleção Solilóquios para a Alma
PRODUCT_PRICE_CENTS=4970
PRODUCT_PRICE_CENTS_VOLUME=970
PRODUCT_PRICE_CENTS_SINGLE=1490
```

## Checkout PIX

Fluxo atual:

1. Cliente informa e-mail
2. Gera cobrança PIX
3. Exibe QR (com fallback automático via código copia e cola)
4. Polling de status
5. Libera botão de download após pagamento

## Endpoints principais

- `GET /api/catalog`
- `POST /api/create-payment`
- `GET /api/payment-status?charge_id=...`
- `POST /api/webhook/pushinpay` (quando aplicável)

## WhatsApp

Botão flutuante configurado para:

- `https://api.whatsapp.com/send?phone=5541992062238`

## Qualidade

```bash
pnpm run check
pnpm run build
```

## GitHub (fluxo sugerido)

```bash
git checkout dev
git add .
git commit -m "feat: ..."
git push origin dev
gh pr create --base main --head dev
```

## Créditos

Desenvolvido por  
**© Automações Comerciais Integradas! 2026 ⚙️ Todos os direitos reservados.**  
contato@automacoescomerciais.com.br  
Francisco Queiroz 📱 WhatsApp: https://wa.me/558894227586

