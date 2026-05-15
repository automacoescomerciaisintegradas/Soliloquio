import express from "express";
import { createServer } from "http";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const docsWebhookUrl = process.env.DOCS_WEBHOOK_URL;
const comprovantesWebhookUrl =
  process.env.COMPROVANTES_WEBHOOK_URL || process.env.DOCS_WEBHOOK_URL;
const whatsappProvider = (process.env.WHATSAPP_PROVIDER || "none").toLowerCase();
const whatsappEvolutionUrl = process.env.WHATSAPP_EVOLUTION_URL;
const whatsappEvolutionApiKey = process.env.WHATSAPP_EVOLUTION_API_KEY;
const whatsappEvolutionInstance = process.env.WHATSAPP_EVOLUTION_INSTANCE;
const whatsappMetaToken =
  process.env.WHATSAPP_META_TOKEN ||
  process.env.META_CLI_ACCESS_TOKEN ||
  process.env.META_ACCESS_TOKEN;
const whatsappMetaPhoneNumberId =
  process.env.WHATSAPP_META_PHONE_NUMBER_ID ||
  process.env.META_CLI_WABA_PHONE_ID ||
  process.env.META_WABA_PHONE_ID;
const whatsappMetaApiVersion =
  process.env.WHATSAPP_META_API_VERSION || process.env.META_API_VERSION || "v22.0";
const whatsappWebhookVerifyToken =
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || "";
const whatsappMetaAppSecret = process.env.WHATSAPP_META_APP_SECRET || process.env.META_APP_SECRET || "";
const adminEmails = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(item => item.trim().toLowerCase())
    .filter(Boolean),
);

const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;
const devMetaIntegrations = new Map<string, Record<string, unknown>>();

type UsuarioAutenticado = {
  id: string;
  email: string | null;
  userMetadata: Record<string, unknown> | null;
  appMetadata: Record<string, unknown> | null;
};

type EventoWhatsappRecebido = {
  provider: "meta" | "evolution";
  telefone: string;
  texto: string;
  externalMessageId: string;
  pushName?: string | null;
  timestamp?: string | null;
  rawPayload: unknown;
};

type MetaIntegrationInput = {
  accessToken: string;
  phoneNumberId: string;
  wabaId?: string;
  systemUserId?: string;
  businessId?: string;
  configId?: string;
  onboardingUrl?: string;
  apiVersion?: string;
};

type CheckoutProductType = "collection" | "volume" | "single";
type CheckoutPaymentStatus = "pending" | "paid" | "expired" | "canceled";

type CheckoutProduct = {
  id: string;
  type: CheckoutProductType;
  title: string;
  subtitle: string;
  author: string;
  description: string;
  priceCents: number;
  volume?: number;
};

type CheckoutPaymentRecord = {
  chargeId: string;
  email: string;
  productId: string;
  productTitle: string;
  amountCents: number;
  status: CheckoutPaymentStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  paidAt: string | null;
  ip: string;
  userAgent: string | null;
};

const pushinpayToken = (process.env.PUSHINPAY_TOKEN || "").trim();
const pushinpayBaseUrl = (process.env.PUSHINPAY_BASE_URL || "https://api.pushinpay.com.br/api")
  .trim()
  .replace(/\/+$/, "");
const pushinpayWebhookSecret = (process.env.PUSHINPAY_WEBHOOK_SECRET || "").trim();
const pushinpayWebhookUrl = (process.env.PUSHINPAY_WEBHOOK_URL || "").trim();
const checkoutBrandName = (process.env.BRAND_NAME || "Nate Systems").trim();
const checkoutProductName = (process.env.PRODUCT_NAME || "Coleção Solilóquios para a Alma").trim();
const checkoutDeliveryUrl = (process.env.DELIVERY_URL || "https://drive.google.com/").trim();
const checkoutPixExpiresMinutes = Number(process.env.PIX_CHARGE_EXPIRES_MINUTES || 30);
const checkoutRateLimitWindowMs = Number(process.env.CHECKOUT_RATE_LIMIT_WINDOW_MS || 60000);
const checkoutRateLimitMax = Number(process.env.CHECKOUT_RATE_LIMIT_MAX || 12);
const checkoutCollectionPriceCents = Number(process.env.PRODUCT_PRICE_CENTS || 4970);
const checkoutVolumePriceCents = Number(process.env.PRODUCT_PRICE_CENTS_VOLUME || 970);
const checkoutSinglePriceCents = Number(process.env.PRODUCT_PRICE_CENTS_SINGLE || 1490);

const checkoutDataDir = path.resolve(__dirname, "..", "data");
const checkoutPaymentsFile = path.join(checkoutDataDir, "pix-payments.json");
const checkoutAuditFile = path.join(checkoutDataDir, "pix-audit.log");
const checkoutEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const checkoutPaymentsByChargeId = new Map<string, CheckoutPaymentRecord>();
const checkoutRateLimitByIp = new Map<string, number[]>();

const checkoutVolumes = [
  { volume: 1, title: "O Sussurro da Alma", subtitle: "Despertando Seu Diálogo Interior" },
  { volume: 2, title: "Mente Aliada", subtitle: "Transformando o Diálogo Interno que Sabota" },
  { volume: 3, title: "A Arte da Escuta", subtitle: "Solilóquio e Inteligência Emocional" },
  { volume: 4, title: "Cura Interior", subtitle: "Solilóquios para a Paz da Alma" },
  { volume: 5, title: "O Poder da Pausa", subtitle: "Solilóquio para uma Vida com Propósito" },
  { volume: 6, title: "Hábitos da Mente", subtitle: "Solilóquios para o Sucesso Duradouro" },
  { volume: 7, title: "Conexão Essencial", subtitle: "Solilóquio e o Impacto das Redes Sociais" },
  { volume: 8, title: "A Voz do Criador", subtitle: "Solilóquio e a Expressão Criativa" },
  { volume: 9, title: "Resiliência Interior", subtitle: "Solilóquios para Superar Desafios" },
  { volume: 10, title: "O Legado do Silêncio", subtitle: "Solilóquio e a Sabedoria Ancestral" },
] as const;

const checkoutCatalogExtras: CheckoutProduct[] = [
  {
    id: "antonio-bandeira-dialogos-do-agora",
    type: "single",
    title: "Diálogos do Agora",
    subtitle: "Reflexões para escolhas conscientes no dia a dia",
    author: "Antonio Bandeira",
    description: "Livro extra para fortalecer presença, foco e decisão com clareza emocional.",
    priceCents: checkoutSinglePriceCents,
  },
  {
    id: "beatriz-moreira-arquitetura-da-calma",
    type: "single",
    title: "Arquitetura da Calma",
    subtitle: "Como reduzir ansiedade com rituais simples",
    author: "Beatriz Moreira",
    description: "Guia prático de organização mental para uma rotina mais leve e intencional.",
    priceCents: checkoutSinglePriceCents,
  },
  {
    id: "rafael-monteiro-coragem-de-recomecar",
    type: "single",
    title: "Coragem de Recomeçar",
    subtitle: "Mentalidade e resiliencia para novos ciclos",
    author: "Rafael Monteiro",
    description: "Estratégias para superar travas, retomar energia e construir novos resultados.",
    priceCents: checkoutSinglePriceCents,
  },
];

function obterCatalogoCheckout() {
  const collectionProduct: CheckoutProduct = {
    id: "colecao-10-volumes",
    type: "collection",
    title: checkoutProductName,
    subtitle: "Coleção completa com os 10 volumes oficiais",
    author: "Antonio Bandeira",
    description:
      "Os 10 volumes que transformam o monólogo confuso em poder, clareza e cura emocional.",
    priceCents: checkoutCollectionPriceCents,
  };

  const volumeProducts: CheckoutProduct[] = checkoutVolumes.map(item => ({
    id: `vol-${String(item.volume).padStart(2, "0")}`,
    type: "volume",
    title: `Vol. ${item.volume} - ${item.title}`,
    subtitle: item.subtitle,
    author: "Antonio Bandeira",
    description: `Compra individual do volume ${item.volume}.`,
    volume: item.volume,
    priceCents: checkoutVolumePriceCents,
  }));

  return [collectionProduct, ...volumeProducts, ...checkoutCatalogExtras];
}

function garantirDiretorioCheckout() {
  if (!fs.existsSync(checkoutDataDir)) {
    fs.mkdirSync(checkoutDataDir, { recursive: true });
  }
}

function carregarPagamentosCheckout() {
  garantirDiretorioCheckout();
  if (!fs.existsSync(checkoutPaymentsFile)) return;

  try {
    const raw = fs.readFileSync(checkoutPaymentsFile, "utf8");
    const parsed = parseJsonSeguro(raw);
    if (!Array.isArray(parsed)) return;

    checkoutPaymentsByChargeId.clear();
    for (const item of parsed) {
      const registro = item as Partial<CheckoutPaymentRecord>;
      if (!registro.chargeId) continue;

      checkoutPaymentsByChargeId.set(registro.chargeId, {
        chargeId: String(registro.chargeId),
        email: String(registro.email || ""),
        productId: String(registro.productId || ""),
        productTitle: String(registro.productTitle || ""),
        amountCents: Number(registro.amountCents || 0),
        status: (registro.status as CheckoutPaymentStatus) || "pending",
        createdAt: String(registro.createdAt || new Date().toISOString()),
        updatedAt: String(registro.updatedAt || new Date().toISOString()),
        expiresAt: String(registro.expiresAt || new Date().toISOString()),
        paidAt: registro.paidAt ? String(registro.paidAt) : null,
        ip: String(registro.ip || ""),
        userAgent: registro.userAgent ? String(registro.userAgent) : null,
      });
    }
  } catch (error) {
    console.error("[CHECKOUT_LOAD_ERROR]", error);
  }
}

function salvarPagamentosCheckout() {
  garantirDiretorioCheckout();
  const payload = JSON.stringify(Array.from(checkoutPaymentsByChargeId.values()), null, 2);
  fs.writeFileSync(checkoutPaymentsFile, payload, "utf8");
}

function registrarAuditoriaCheckout(evento: string, data: Record<string, unknown>) {
  try {
    garantirDiretorioCheckout();
    const linha = JSON.stringify({
      timestamp: new Date().toISOString(),
      event: evento,
      ...data,
    });
    fs.appendFileSync(checkoutAuditFile, `${linha}\n`, "utf8");
  } catch (error) {
    console.error("[CHECKOUT_AUDIT_ERROR]", error);
  }
}

function mascararEmail(email: string) {
  const [local, dominio] = email.split("@");
  if (!local || !dominio) return email;
  if (local.length <= 2) return `**@${dominio}`;
  return `${local.slice(0, 2)}***@${dominio}`;
}

function obterIpRequisicao(req: express.Request) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map(v => v.trim())
    .find(Boolean);
  return (
    forwarded ||
    req.socket.remoteAddress ||
    String(req.headers["x-real-ip"] || "") ||
    "unknown"
  );
}

function verificarRateLimitCheckout(ip: string) {
  const agora = Date.now();
  const janela = Number.isFinite(checkoutRateLimitWindowMs) && checkoutRateLimitWindowMs > 0
    ? checkoutRateLimitWindowMs
    : 60000;
  const limite = Number.isFinite(checkoutRateLimitMax) && checkoutRateLimitMax > 0
    ? checkoutRateLimitMax
    : 12;

  const historico = checkoutRateLimitByIp.get(ip) || [];
  const atualizados = historico.filter(ts => agora - ts <= janela);

  if (atualizados.length >= limite) {
    checkoutRateLimitByIp.set(ip, atualizados);
    return { permitido: false, restantes: 0, retryAfterMs: janela - (agora - atualizados[0]) };
  }

  atualizados.push(agora);
  checkoutRateLimitByIp.set(ip, atualizados);

  return { permitido: true, restantes: limite - atualizados.length, retryAfterMs: 0 };
}

function normalizarStatusPagamento(statusRaw: unknown): CheckoutPaymentStatus {
  const status = String(statusRaw || "").toLowerCase().trim();
  if (!status) return "pending";
  if (status.includes("paid") || status.includes("approved") || status.includes("success")) {
    return "paid";
  }
  if (status.includes("expire")) return "expired";
  if (status.includes("cancel") || status.includes("refused") || status.includes("failed")) {
    return "canceled";
  }
  return "pending";
}

function extrairValorTexto(input: unknown) {
  if (typeof input !== "string") return "";
  return input.trim();
}

function toDataUrlQrCode(valor: string) {
  const trimmed = valor.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:image")) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `data:image/png;base64,${trimmed}`;
}

async function criarCobrancaPushinPay(params: {
  email: string;
  product: CheckoutProduct;
  ip: string;
}) {
  const payload: Record<string, unknown> = {
    value: params.product.priceCents,
    description: `${checkoutBrandName} - ${params.product.title}`,
    payer_email: params.email,
    payer_name: params.email.split("@")[0],
  };

  if (pushinpayWebhookUrl) {
    payload["webhook_url"] = pushinpayWebhookUrl;
  }

  const response = await fetch(`${pushinpayBaseUrl}/pix/cashIn`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pushinpayToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  const data = (parseJsonSeguro(rawText) || {}) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(data["message"] ? String(data["message"]) : rawText || "Falha na PushinPay.");
  }

  const pixDetails =
    (data["pix_details"] as Record<string, unknown> | undefined) ||
    (data["pix"] as Record<string, unknown> | undefined) ||
    {};

  const chargeId =
    extrairValorTexto(data["id"]) ||
    extrairValorTexto(data["charge_id"]) ||
    extrairValorTexto((data["transaction"] as Record<string, unknown> | undefined)?.["id"]) ||
    extrairValorTexto(pixDetails["id"]);

  const pixCode =
    extrairValorTexto(data["pix_copy_paste"]) ||
    extrairValorTexto(data["pix_code"]) ||
    extrairValorTexto(data["qr_code"]) ||
    extrairValorTexto(data["emv"]) ||
    extrairValorTexto(pixDetails["emv"]);

  const qrCodeImageRaw =
    extrairValorTexto(data["qr_code_base64"]) ||
    extrairValorTexto(data["qr_code_image"]) ||
    extrairValorTexto(pixDetails["qr_code_base64"]) ||
    extrairValorTexto(pixDetails["qr_code"]) ||
    "";

  const qrCodeImage = toDataUrlQrCode(qrCodeImageRaw);

  if (!chargeId || !pixCode) {
    throw new Error("A PushinPay nao retornou charge_id ou codigo PIX.");
  }

  registrarAuditoriaCheckout("pushinpay.charge.created", {
    ip: params.ip,
    charge_id: chargeId,
    product_id: params.product.id,
    email: mascararEmail(params.email),
  });

  return {
    chargeId,
    pixCode,
    qrCodeImage,
  };
}

async function consultarStatusPushinPay(chargeId: string) {
  const response = await fetch(`${pushinpayBaseUrl}/transaction/${chargeId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${pushinpayToken}`,
      "Content-Type": "application/json",
    },
  });

  const rawText = await response.text();
  const data = (parseJsonSeguro(rawText) || {}) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(data["message"] ? String(data["message"]) : rawText || "Erro ao consultar status.");
  }

  const statusRaw =
    data["status"] ||
    (data["transaction"] as Record<string, unknown> | undefined)?.["status"] ||
    (data["data"] as Record<string, unknown> | undefined)?.["status"] ||
    "";

  return normalizarStatusPagamento(statusRaw);
}

function validarWebhookPushinPay(req: express.Request) {
  if (!pushinpayWebhookSecret) return true;

  const authorization = String(req.header("authorization") || "");
  const authToken = authorization.replace(/^Bearer\s+/i, "").trim();
  const candidatos = [
    req.header("x-pushinpay-secret"),
    req.header("x-webhook-secret"),
    req.header("x-signature"),
    authToken,
  ]
    .filter(Boolean)
    .map(v => String(v).trim());

  return candidatos.includes(pushinpayWebhookSecret);
}

function normalizarTelefoneWhatsapp(telefone: string) {
  return telefone.replace(/\D/g, "");
}

function parseJsonSeguro(valor: Buffer | string) {
  try {
    return JSON.parse(String(valor));
  } catch {
    return null;
  }
}

function decodificarJwtSemVerificacao(token: string) {
  try {
    const partes = token.split(".");
    if (partes.length < 2) return null;
    const payload = partes[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(partes[1].length / 4) * 4, "=");
    const json = Buffer.from(payload, "base64").toString("utf8");
    return parseJsonSeguro(json) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

function mascararSegredo(valor: string) {
  const limpo = (valor || "").trim();
  if (!limpo) return "";
  if (limpo.length <= 8) return "*".repeat(limpo.length);
  return `${limpo.slice(0, 4)}...${limpo.slice(-4)}`;
}

function mensagemErroIntegracao(error: { code?: string; status?: number; message?: string }) {
  const code = String(error.code || "").toUpperCase();
  const status = Number(error.status || 0);
  const message = String(error.message || "").toLowerCase();

  if (
    code === "PGRST205" ||
    status === 404 ||
    message.includes("relation") ||
    message.includes("table")
  ) {
    return "Tabela de integrações não encontrada. Execute shared/supabase-setup-completo.sql no Supabase.";
  }

  return "Falha ao acessar integrações Meta no Supabase.";
}

async function carregarIntegracaoMetaDoUsuario(userId: string) {
  if (!supabaseAdmin) {
    if (process.env.NODE_ENV === "development") {
      return { data: (devMetaIntegrations.get(userId) as any) || null, error: null as any };
    }
    return { data: null, error: null as any };
  }

  const resp = await supabaseAdmin
    .from("integrations")
    .select("id,user_id,display_name,service_name,status,credentials,configuration,updated_at,created_at")
    .eq("user_id", userId)
    .eq("service_name", "WHATSAPP_META")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return resp;
}

async function salvarIntegracaoMetaDoUsuario(userId: string, input: MetaIntegrationInput) {
  if (!supabaseAdmin) {
    if (process.env.NODE_ENV === "development") {
      const registroDev = {
        id: `dev-meta-${userId}`,
        user_id: userId,
        service_name: "WHATSAPP_META",
        display_name: "WhatsApp Meta (DEV)",
        status: "CONNECTED",
        credentials: {
          access_token: input.accessToken,
        },
        configuration: {
          phone_number_id: input.phoneNumberId,
          waba_id: input.wabaId || null,
          system_user_id: input.systemUserId || null,
          business_id: input.businessId || null,
          config_id: input.configId || null,
          onboarding_url: input.onboardingUrl || null,
          api_version: input.apiVersion || whatsappMetaApiVersion,
          updated_by_platform_owner: true,
          saved_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      devMetaIntegrations.set(userId, registroDev);
      return {
        ok: true as const,
        status: 200,
        message: "Integração Meta salva localmente em modo desenvolvimento.",
        data: registroDev,
      };
    }

    return {
      ok: false as const,
      status: 500,
      message: "Servidor sem SUPABASE_SERVICE_ROLE_KEY.",
      data: null as any,
    };
  }

  const existente = await carregarIntegracaoMetaDoUsuario(userId);
  if (existente.error) {
    return {
      ok: false as const,
      status: 500,
      message: mensagemErroIntegracao(existente.error),
      data: null as any,
    };
  }

  const registro = {
    user_id: userId,
    service_name: "WHATSAPP_META",
    display_name: "WhatsApp Meta",
    status: "CONNECTED",
    credentials: {
      access_token: input.accessToken,
    },
    configuration: {
      phone_number_id: input.phoneNumberId,
      waba_id: input.wabaId || null,
      system_user_id: input.systemUserId || null,
      business_id: input.businessId || null,
      config_id: input.configId || null,
      onboarding_url: input.onboardingUrl || null,
      api_version: input.apiVersion || whatsappMetaApiVersion,
      updated_by_platform_owner: true,
      saved_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  };

  const persistencia = existente.data?.id
    ? await supabaseAdmin
        .from("integrations")
        .update(registro)
        .eq("id", existente.data.id)
        .select("id,user_id,display_name,service_name,status,configuration,updated_at,created_at")
        .maybeSingle()
    : await supabaseAdmin
        .from("integrations")
        .insert(registro)
        .select("id,user_id,display_name,service_name,status,configuration,updated_at,created_at")
        .maybeSingle();

  if (persistencia.error) {
    return {
      ok: false as const,
      status: 500,
      message: mensagemErroIntegracao(persistencia.error),
      data: null as any,
    };
  }

  return {
    ok: true as const,
    status: 200,
    message: "Integração Meta salva com sucesso.",
    data: persistencia.data,
  };
}

async function testarCredenciaisMeta(params: {
  accessToken: string;
  phoneNumberId: string;
  apiVersion?: string;
}) {
  const token = params.accessToken.trim();
  const phoneId = params.phoneNumberId.trim();
  const version = (params.apiVersion || whatsappMetaApiVersion || "v22.0").trim();

  if (!token || !phoneId) {
    return {
      ok: false as const,
      status: 400,
      message: "Token e Phone Number ID são obrigatórios para teste.",
      details: null as string | null,
      data: null as any,
    };
  }

  const endpoint =
    `https://graph.facebook.com/${version}/${phoneId}` +
    "?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status";
  const resp = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await resp.text();
  const json = parseJsonSeguro(text);

  if (!resp.ok) {
    return {
      ok: false as const,
      status: resp.status,
      message: "Falha ao validar credenciais Meta.",
      details: text || null,
      data: json,
    };
  }

  return {
    ok: true as const,
    status: 200,
    message: "Credenciais Meta válidas.",
    details: null as string | null,
    data: json,
  };
}

function verificarAssinaturaMeta(rawBody: Buffer, assinaturaHeader: string | undefined) {
  if (!whatsappMetaAppSecret) return true;
  if (!assinaturaHeader || !assinaturaHeader.startsWith("sha256=")) return false;

  const assinaturaRecebida = assinaturaHeader.slice("sha256=".length).trim();
  const assinaturaCalculada = crypto
    .createHmac("sha256", whatsappMetaAppSecret)
    .update(rawBody)
    .digest("hex");

  const a = Buffer.from(assinaturaRecebida, "hex");
  const b = Buffer.from(assinaturaCalculada, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function persistirConversaWhatsappExterna(evento: EventoWhatsappRecebido) {
  if (!supabaseAdmin) return;

  const upsertContato = await supabaseAdmin.from("whatsapp_contacts").upsert(
    {
      wa_id: evento.telefone,
      telefone: evento.telefone,
      nome: evento.pushName || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "wa_id" },
  );

  if (upsertContato.error) {
    return;
  }

  const contato = await supabaseAdmin
    .from("whatsapp_contacts")
    .select("id")
    .eq("wa_id", evento.telefone)
    .maybeSingle();

  if (contato.error || !contato.data?.id) return;

  const upsertConversa = await supabaseAdmin.from("whatsapp_conversations").upsert(
    {
      contact_id: contato.data.id,
      last_message_at: evento.timestamp
        ? new Date(Number(evento.timestamp) * 1000).toISOString()
        : new Date().toISOString(),
    },
    { onConflict: "contact_id" },
  );

  if (upsertConversa.error) {
    return;
  }

  const conversa = await supabaseAdmin
    .from("whatsapp_conversations")
    .select("id")
    .eq("contact_id", contato.data.id)
    .maybeSingle();

  if (conversa.error || !conversa.data?.id) return;

  await supabaseAdmin.from("whatsapp_messages").insert({
    conversation_id: conversa.data.id,
    direction: "inbound",
    body: evento.texto,
    provider: evento.provider,
    provider_message_id: evento.externalMessageId,
    raw_payload: evento.rawPayload,
    created_at: evento.timestamp
      ? new Date(Number(evento.timestamp) * 1000).toISOString()
      : new Date().toISOString(),
  });
}

async function obterAdminPadraoId() {
  if (!supabaseAdmin) return null;

  if (adminEmails.size > 0) {
    const emails = Array.from(adminEmails);
    const resp = await supabaseAdmin
      .from("profiles")
      .select("id,email")
      .in("email", emails)
      .limit(1)
      .maybeSingle();
    if (resp.data?.id) return resp.data.id as string;
  }

  const fallback = await supabaseAdmin.from("profiles").select("id").limit(1).maybeSingle();
  return (fallback.data?.id as string | undefined) ?? null;
}

async function obterConversaOuCriarEntreUsuarios(usuarioA: string, usuarioB: string) {
  if (!supabaseAdmin) return null;

  const candidatas = await supabaseAdmin
    .from("conversation_participants")
    .select("conversation_id,user_id")
    .in("user_id", [usuarioA, usuarioB]);

  if (!candidatas.error && candidatas.data) {
    const mapa = new Map<string, Set<string>>();
    for (const item of candidatas.data) {
      if (!mapa.has(item.conversation_id)) {
        mapa.set(item.conversation_id, new Set());
      }
      mapa.get(item.conversation_id)?.add(item.user_id);
    }

    const existente = Array.from(mapa.entries()).find(([, participantes]) => {
      return participantes.has(usuarioA) && participantes.has(usuarioB);
    });

    if (existente) return existente[0];
  }

  const criada = await supabaseAdmin
    .from("conversations")
    .insert({})
    .select("id")
    .maybeSingle();
  if (criada.error || !criada.data?.id) return null;

  const vinculo = await supabaseAdmin.from("conversation_participants").insert([
    { conversation_id: criada.data.id, user_id: usuarioA },
    { conversation_id: criada.data.id, user_id: usuarioB },
  ]);
  if (vinculo.error) return null;

  return criada.data.id as string;
}

async function espelharMensagemNoChatInterno(evento: EventoWhatsappRecebido) {
  if (!supabaseAdmin) return;

  const telefone = normalizarTelefoneWhatsapp(evento.telefone);
  if (!telefone) return;

  const variacoes = Array.from(
    new Set([telefone, `+${telefone}`, `55${telefone}`, `+55${telefone}`]),
  );

  const remetenteResp = await supabaseAdmin
    .from("profiles")
    .select("id,telefone,phone")
    .or(
      variacoes
        .flatMap(v => [`telefone.eq.${v}`, `phone.eq.${v}`])
        .join(","),
    )
    .limit(1)
    .maybeSingle();

  const remetenteId = remetenteResp.data?.id as string | undefined;
  if (!remetenteId) return;

  const adminId = await obterAdminPadraoId();
  if (!adminId || adminId === remetenteId) return;

  const conversationId = await obterConversaOuCriarEntreUsuarios(remetenteId, adminId);
  if (!conversationId) return;

  await supabaseAdmin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: remetenteId,
    conteudo: evento.texto,
    created_at: evento.timestamp
      ? new Date(Number(evento.timestamp) * 1000).toISOString()
      : new Date().toISOString(),
  });
}

async function processarEventoWhatsappRecebido(evento: EventoWhatsappRecebido) {
  await persistirConversaWhatsappExterna(evento);
  await espelharMensagemNoChatInterno(evento);
}

async function persistirSaidaWhatsapp(params: {
  telefone: string;
  texto: string;
  providerMessageId: string | null;
  provider: "meta" | "evolution";
}) {
  if (!supabaseAdmin) return;

  const telefone = normalizarTelefoneWhatsapp(params.telefone);
  const texto = params.texto.trim();
  if (!telefone || !texto) return;

  const upsertContato = await supabaseAdmin.from("whatsapp_contacts").upsert(
    {
      wa_id: telefone,
      telefone,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "wa_id" },
  );
  if (upsertContato.error) return;

  const contato = await supabaseAdmin
    .from("whatsapp_contacts")
    .select("id")
    .eq("wa_id", telefone)
    .maybeSingle();
  if (contato.error || !contato.data?.id) return;

  const upsertConversa = await supabaseAdmin.from("whatsapp_conversations").upsert(
    {
      contact_id: contato.data.id,
      last_message_at: new Date().toISOString(),
    },
    { onConflict: "contact_id" },
  );
  if (upsertConversa.error) return;

  const conversa = await supabaseAdmin
    .from("whatsapp_conversations")
    .select("id")
    .eq("contact_id", contato.data.id)
    .maybeSingle();
  if (conversa.error || !conversa.data?.id) return;

  await supabaseAdmin.from("whatsapp_messages").insert({
    conversation_id: conversa.data.id,
    direction: "outbound",
    provider: params.provider,
    body: texto,
    provider_message_id: params.providerMessageId,
    raw_payload: {},
  });
}

function extrairEventosMeta(payload: any): EventoWhatsappRecebido[] {
  const eventos: EventoWhatsappRecebido[] = [];
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value;
      const mensagens = Array.isArray(value?.messages) ? value.messages : [];
      const contatos = Array.isArray(value?.contacts) ? value.contacts : [];

      for (const msg of mensagens) {
        if (msg?.type !== "text") continue;
        const texto = String(msg?.text?.body || "").trim();
        const from = normalizarTelefoneWhatsapp(String(msg?.from || ""));
        const id = String(msg?.id || "");
        const timestamp = String(msg?.timestamp || "");
        if (!texto || !from || !id) continue;

        const contato = contatos.find((c: any) => String(c?.wa_id || "") === String(msg?.from || ""));
        const pushName = String(contato?.profile?.name || "").trim() || null;

        eventos.push({
          provider: "meta",
          telefone: from,
          texto,
          externalMessageId: id,
          pushName,
          timestamp: timestamp || null,
          rawPayload: msg,
        });
      }
    }
  }

  return eventos;
}

function extrairEventosEvolution(payload: any): EventoWhatsappRecebido[] {
  const fromMe = payload?.key?.fromMe === true;
  if (fromMe) return [];

  const remoteJid = String(payload?.key?.remoteJid || "");
  const telefone = normalizarTelefoneWhatsapp(remoteJid.split("@")[0] || remoteJid);
  const texto = String(payload?.message?.conversation || payload?.message?.extendedTextMessage?.text || "").trim();
  const externalMessageId = String(payload?.key?.id || "");
  const timestamp = payload?.messageTimestamp ? String(payload.messageTimestamp) : null;
  const pushName = String(payload?.pushName || "").trim() || null;

  if (!telefone || !texto || !externalMessageId) return [];

  return [
    {
      provider: "evolution",
      telefone,
      texto,
      externalMessageId,
      pushName,
      timestamp,
      rawPayload: payload,
    },
  ];
}

async function enviarWhatsapp(params: {
  telefone: string;
  mensagem: string;
  origem: string;
  remetenteId: string;
}) {
  const telefone = normalizarTelefoneWhatsapp(params.telefone);
  const mensagem = params.mensagem.trim();

  if (!telefone || !mensagem) {
    return {
      ok: false as const,
      status: 400,
      message: "Telefone e mensagem são obrigatórios para envio WhatsApp.",
      details: null as string | null,
      providerMessageId: null as string | null,
    };
  }

  if (whatsappProvider === "none") {
    return {
      ok: false as const,
      status: 501,
      message:
        "Integração WhatsApp não configurada. Defina WHATSAPP_PROVIDER e credenciais no .env.",
      details: null as string | null,
      providerMessageId: null as string | null,
    };
  }

  if (whatsappProvider === "evolution") {
    if (!whatsappEvolutionUrl || !whatsappEvolutionApiKey || !whatsappEvolutionInstance) {
      return {
        ok: false as const,
        status: 500,
        message:
          "Evolution API não configurada. Defina WHATSAPP_EVOLUTION_URL, WHATSAPP_EVOLUTION_API_KEY e WHATSAPP_EVOLUTION_INSTANCE.",
        details: null as string | null,
        providerMessageId: null as string | null,
      };
    }

    const endpoint = `${whatsappEvolutionUrl.replace(/\/+$/, "")}/message/sendText/${whatsappEvolutionInstance}`;
    const resposta = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: whatsappEvolutionApiKey,
        "x-origem-app": params.origem,
        "x-remetente-id": params.remetenteId,
      },
      body: JSON.stringify({
        number: telefone,
        text: mensagem,
      }),
    });

    const detalhe = await resposta.text();
    const json = parseJsonSeguro(detalhe) as any;
    if (!resposta.ok) {
      return {
        ok: false as const,
        status: resposta.status,
        message: "Falha ao enviar mensagem via Evolution API.",
        details: detalhe || null,
        providerMessageId: null as string | null,
      };
    }

    return {
      ok: true as const,
      status: 200,
      message: "Mensagem enviada via Evolution API.",
      details: detalhe || null,
      providerMessageId: String(json?.key?.id || "") || null,
    };
  }

  if (whatsappProvider === "meta" || whatsappProvider === "official") {
    if (!whatsappMetaToken || !whatsappMetaPhoneNumberId) {
      return {
        ok: false as const,
        status: 500,
        message:
          "WhatsApp oficial não configurado. Defina WHATSAPP_META_TOKEN e WHATSAPP_META_PHONE_NUMBER_ID.",
        details: null as string | null,
        providerMessageId: null as string | null,
      };
    }

    const endpoint = `https://graph.facebook.com/${whatsappMetaApiVersion}/${whatsappMetaPhoneNumberId}/messages`;
    const resposta = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${whatsappMetaToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefone,
        type: "text",
        text: { body: mensagem },
      }),
    });

    const detalhe = await resposta.text();
    const json = parseJsonSeguro(detalhe) as any;
    if (!resposta.ok) {
      return {
        ok: false as const,
        status: resposta.status,
        message: "Falha ao enviar mensagem via WhatsApp oficial.",
        details: detalhe || null,
        providerMessageId: null as string | null,
      };
    }

    return {
      ok: true as const,
      status: 200,
      message: "Mensagem enviada via WhatsApp oficial.",
      details: detalhe || null,
      providerMessageId: String(json?.messages?.[0]?.id || "") || null,
    };
  }

  return {
    ok: false as const,
    status: 400,
    message: `Provedor WhatsApp inválido: ${whatsappProvider}. Use none, evolution ou meta.`,
    details: null as string | null,
    providerMessageId: null as string | null,
  };
}

function isAdminUser(usuario: UsuarioAutenticado) {
  const userRole = String(
    (usuario.userMetadata?.role as string | undefined) ||
      (usuario.appMetadata?.role as string | undefined) ||
      "",
  ).toLowerCase();
  const userIsAdminFlag =
    usuario.userMetadata?.is_admin === true || usuario.appMetadata?.is_admin === true;
  const email = (usuario.email || "").toLowerCase();
  const adminPorEmail = !!email && adminEmails.has(email);

  return userRole === "admin" || userIsAdminFlag || adminPorEmail;
}

async function autenticarUsuario(req: express.Request) {
  if (!supabaseAdmin) {
    if (process.env.NODE_ENV === "development") {
      const authHeader = req.header("authorization") || "";
      if (!authHeader.toLowerCase().startsWith("bearer ")) {
        return { ok: false as const, status: 401, erro: "Token de acesso ausente." };
      }
      const token = authHeader.slice("Bearer ".length).trim();
      const payload = decodificarJwtSemVerificacao(token);
      const sub = String(payload?.sub || "");
      const email = String(payload?.email || "");
      if (!sub) {
        return {
          ok: false as const,
          status: 401,
          erro: "Token inválido no modo desenvolvimento.",
        };
      }

      const usuario: UsuarioAutenticado = {
        id: sub,
        email: email || null,
        userMetadata: (payload?.user_metadata as Record<string, unknown>) || null,
        appMetadata: (payload?.app_metadata as Record<string, unknown>) || null,
      };
      return { ok: true as const, usuario };
    }

    return {
      ok: false as const,
      status: 500,
      erro: "Servidor sem SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  const authHeader = req.header("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return { ok: false as const, status: 401, erro: "Token de acesso ausente." };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { ok: false as const, status: 401, erro: "Token de acesso inválido." };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false as const, status: 401, erro: "Sessão inválida ou expirada." };
  }

  const usuario: UsuarioAutenticado = {
    id: data.user.id,
    email: data.user.email ?? null,
    userMetadata: data.user.user_metadata ?? null,
    appMetadata: data.user.app_metadata ?? null,
  };

  return { ok: true as const, usuario };
}

async function encaminharMultipartParaWebhook(params: {
  req: express.Request;
  webhookUrl: string;
  headersExtras?: Record<string, string>;
}) {
  const { req, webhookUrl, headersExtras = {} } = params;
  const contentType = req.header("content-type");
  if (!contentType || !contentType.includes("multipart/form-data")) {
    return {
      ok: false as const,
      status: 400,
      message: "Formato inválido. Envie os dados como multipart/form-data.",
      details: null as string | null,
    };
  }

  try {
    const webhookResponse = await fetch(
      webhookUrl,
      {
        method: "POST",
        headers: {
          "content-type": contentType,
          ...headersExtras,
        },
        body: req as unknown as BodyInit,
        duplex: "half",
      } as RequestInit & { duplex: "half" },
    );

    const respostaWebhook = await webhookResponse.text();

    if (!webhookResponse.ok) {
      return {
        ok: false as const,
        status: webhookResponse.status,
        message: "Webhook retornou erro.",
        details: respostaWebhook || null,
      };
    }

    return {
      ok: true as const,
      status: 200,
      message: "Envio concluído com sucesso.",
      details: respostaWebhook || null,
    };
  } catch (error) {
    return {
      ok: false as const,
      status: 502,
      message: "Falha ao encaminhar para o webhook.",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  carregarPagamentosCheckout();

  app.get("/api/catalog", (_req, res) => {
    const products = obterCatalogoCheckout();
    return res.status(200).json({
      brand_name: checkoutBrandName,
      product_name: checkoutProductName,
      currency: "BRL",
      products: products.map(product => ({
        id: product.id,
        type: product.type,
        title: product.title,
        subtitle: product.subtitle,
        author: product.author,
        description: product.description,
        volume: product.volume || null,
        price_cents: product.priceCents,
      })),
    });
  });

  app.post("/api/create-payment", express.json(), async (req, res) => {
    const ip = obterIpRequisicao(req);
    const rateLimit = verificarRateLimitCheckout(ip);
    if (!rateLimit.permitido) {
      const retryAfterSeconds = Math.ceil(rateLimit.retryAfterMs / 1000);
      return res.status(429).json({
        ok: false,
        message: "Muitas tentativas em pouco tempo. Aguarde e tente novamente.",
        retry_after_seconds: retryAfterSeconds,
      });
    }

    const body = (req.body || {}) as {
      email?: string;
      product_id?: string;
    };

    const email = String(body.email || "").trim().toLowerCase();
    const productId = String(body.product_id || "").trim();

    if (!checkoutEmailRegex.test(email)) {
      return res.status(400).json({ ok: false, message: "E-mail invalido." });
    }

    const catalog = obterCatalogoCheckout();
    const product = catalog.find(item => item.id === productId);
    if (!product) {
      return res.status(400).json({ ok: false, message: "Produto selecionado nao encontrado." });
    }

    if (!pushinpayToken) {
      return res.status(500).json({
        ok: false,
        message: "Pagamento PIX indisponivel. Configure PUSHINPAY_TOKEN no backend.",
      });
    }

    try {
      const created = await criarCobrancaPushinPay({ email, product, ip });
      const agora = new Date();
      const expiresAt = new Date(
        agora.getTime() +
          (Number.isFinite(checkoutPixExpiresMinutes) && checkoutPixExpiresMinutes > 0
            ? checkoutPixExpiresMinutes
            : 30) *
            60 *
            1000,
      );

      const registro: CheckoutPaymentRecord = {
        chargeId: created.chargeId,
        email,
        productId: product.id,
        productTitle: product.title,
        amountCents: product.priceCents,
        status: "pending",
        createdAt: agora.toISOString(),
        updatedAt: agora.toISOString(),
        expiresAt: expiresAt.toISOString(),
        paidAt: null,
        ip,
        userAgent: String(req.header("user-agent") || "") || null,
      };

      checkoutPaymentsByChargeId.set(created.chargeId, registro);
      salvarPagamentosCheckout();
      registrarAuditoriaCheckout("checkout.payment.created", {
        charge_id: created.chargeId,
        product_id: product.id,
        amount_cents: product.priceCents,
        email: mascararEmail(email),
        ip,
      });

      return res.status(200).json({
        ok: true,
        charge_id: created.chargeId,
        qr_code_image: created.qrCodeImage || null,
        pix_copy_paste: created.pixCode,
        status: "pending",
        expires_at: registro.expiresAt,
        brand_name: checkoutBrandName,
        product: {
          id: product.id,
          title: product.title,
          subtitle: product.subtitle,
          author: product.author,
          price_cents: product.priceCents,
        },
      });
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Erro ao criar cobranca PIX.";
      registrarAuditoriaCheckout("checkout.payment.create_failed", {
        product_id: productId,
        email: mascararEmail(email),
        ip,
        error: mensagem,
      });
      return res.status(502).json({ ok: false, message: mensagem });
    }
  });

  app.get("/api/payment-status", async (req, res) => {
    const chargeId = String(req.query.charge_id || "").trim();
    if (!chargeId) {
      return res.status(400).json({ ok: false, message: "charge_id obrigatorio." });
    }

    const registro = checkoutPaymentsByChargeId.get(chargeId);
    if (!registro) {
      return res.status(404).json({ ok: false, message: "Cobranca nao encontrada." });
    }

    const agora = Date.now();
    const expirou = (timestampMs: number) => timestampMs > new Date(registro.expiresAt).getTime();
    let statusAtual = registro.status;

    if (statusAtual === "pending" && expirou(agora)) {
      statusAtual = "expired";
      registro.status = "expired";
      registro.updatedAt = new Date().toISOString();
      checkoutPaymentsByChargeId.set(chargeId, registro);
      salvarPagamentosCheckout();
      registrarAuditoriaCheckout("checkout.payment.expired", { charge_id: chargeId });
    }

    if (statusAtual === "pending" && pushinpayToken) {
      try {
        const statusRemoto = await consultarStatusPushinPay(chargeId);
        if (statusRemoto !== statusAtual) {
          statusAtual = statusRemoto;
          registro.status = statusRemoto;
          registro.updatedAt = new Date().toISOString();
          if (statusRemoto === "paid") {
            registro.paidAt = new Date().toISOString();
          }
          checkoutPaymentsByChargeId.set(chargeId, registro);
          salvarPagamentosCheckout();
          registrarAuditoriaCheckout("checkout.payment.status_updated", {
            charge_id: chargeId,
            status: statusRemoto,
          });
        }
      } catch (error) {
        registrarAuditoriaCheckout("checkout.payment.status_error", {
          charge_id: chargeId,
          error: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    }

    return res.status(200).json({
      ok: true,
      charge_id: chargeId,
      status: statusAtual,
      paid: statusAtual === "paid",
      expires_at: registro.expiresAt,
      delivery_url: statusAtual === "paid" ? checkoutDeliveryUrl : null,
      product_title: registro.productTitle,
      amount_cents: registro.amountCents,
    });
  });

  app.post("/api/webhook/pushinpay", express.json(), (req, res) => {
    if (!validarWebhookPushinPay(req)) {
      return res.status(403).json({ ok: false, message: "Webhook nao autorizado." });
    }

    const payload = (req.body || {}) as Record<string, unknown>;
    const chargeId =
      extrairValorTexto(payload["id"]) ||
      extrairValorTexto(payload["charge_id"]) ||
      extrairValorTexto((payload["transaction"] as Record<string, unknown> | undefined)?.["id"]) ||
      extrairValorTexto((payload["data"] as Record<string, unknown> | undefined)?.["id"]);
    const statusRaw =
      payload["status"] ||
      (payload["transaction"] as Record<string, unknown> | undefined)?.["status"] ||
      (payload["data"] as Record<string, unknown> | undefined)?.["status"] ||
      "";

    if (!chargeId) {
      return res.status(400).json({ ok: false, message: "Webhook sem charge_id." });
    }

    const registro = checkoutPaymentsByChargeId.get(chargeId);
    const novoStatus = normalizarStatusPagamento(statusRaw);

    if (!registro) {
      registrarAuditoriaCheckout("checkout.webhook.unknown_charge", {
        charge_id: chargeId,
        status: novoStatus,
      });
      return res.status(202).json({ ok: true, message: "Webhook recebido para charge desconhecida." });
    }

    registro.status = novoStatus;
    registro.updatedAt = new Date().toISOString();
    if (novoStatus === "paid") {
      registro.paidAt = new Date().toISOString();
    }

    checkoutPaymentsByChargeId.set(chargeId, registro);
    salvarPagamentosCheckout();
    registrarAuditoriaCheckout("checkout.webhook.applied", {
      charge_id: chargeId,
      status: novoStatus,
    });

    return res.status(200).json({ ok: true });
  });

  app.get("/api/whatsapp/webhook", (req, res) => {
    const mode = String(req.query["hub.mode"] || "");
    const token = String(req.query["hub.verify_token"] || "");
    const challenge = String(req.query["hub.challenge"] || "");

    if (mode !== "subscribe") {
      return res.status(400).send("Modo inválido.");
    }
    if (!whatsappWebhookVerifyToken) {
      return res.status(500).send("WHATSAPP_WEBHOOK_VERIFY_TOKEN não configurado no servidor.");
    }
    if (token !== whatsappWebhookVerifyToken) {
      return res.status(403).send("Verify token inválido.");
    }

    return res.status(200).send(challenge);
  });

  app.post("/api/whatsapp/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const rawBody = req.body as Buffer;
    const payload = parseJsonSeguro(rawBody);
    if (!payload) {
      return res.status(400).json({ ok: false, message: "Payload JSON inválido." });
    }

    try {
      if (whatsappProvider === "meta" || whatsappProvider === "official") {
        const assinatura = req.header("x-hub-signature-256");
        const assinaturaValida = verificarAssinaturaMeta(rawBody, assinatura);
        if (!assinaturaValida) {
          return res.status(403).json({ ok: false, message: "Assinatura do webhook inválida." });
        }

        const eventos = extrairEventosMeta(payload);
        for (const evento of eventos) {
          await processarEventoWhatsappRecebido(evento);
        }

        return res.status(200).json({ ok: true, received: eventos.length });
      }

      if (whatsappProvider === "evolution") {
        const eventos = extrairEventosEvolution(payload);
        for (const evento of eventos) {
          await processarEventoWhatsappRecebido(evento);
        }

        return res.status(200).json({ ok: true, received: eventos.length });
      }

      return res.status(200).json({
        ok: true,
        message: "Webhook recebido, mas WHATSAPP_PROVIDER está como none.",
      });
    } catch (error) {
      console.error("[WHATSAPP_WEBHOOK_ERROR]", error);
      return res.status(500).json({ ok: false, message: "Erro ao processar webhook." });
    }
  });

  app.get("/api/admin/status", async (req, res) => {
    const auth = await autenticarUsuario(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ admin: false, message: auth.erro });
    }

    return res.json({ admin: isAdminUser(auth.usuario) });
  });

  app.get("/api/meta/integration/status", async (req, res) => {
    const auth = await autenticarUsuario(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.erro });
    }
    if (!isAdminUser(auth.usuario)) {
      return res.status(403).json({ message: "Somente administradores podem acessar integração Meta." });
    }

    const integração = await carregarIntegracaoMetaDoUsuario(auth.usuario.id);
    if (integração.error) {
      return res.status(500).json({ message: mensagemErroIntegracao(integração.error) });
    }

    const cfg = (integração.data?.configuration || {}) as Record<string, unknown>;
    const creds = (integração.data?.credentials || {}) as Record<string, unknown>;

    return res.status(200).json({
      connected: !!integração.data,
      integration: integração.data
        ? {
            id: integração.data.id,
            service_name: integração.data.service_name,
            display_name: integração.data.display_name,
            status: integração.data.status,
            updated_at: integração.data.updated_at,
            created_at: integração.data.created_at,
            configuration: cfg,
            token_preview: mascararSegredo(String(creds["access_token"] || "")),
          }
        : null,
    });
  });

  app.post("/api/meta/integration/testar", express.json(), async (req, res) => {
    const auth = await autenticarUsuario(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.erro });
    }
    if (!isAdminUser(auth.usuario)) {
      return res.status(403).json({ message: "Somente administradores podem testar integração Meta." });
    }

    const body = (req.body || {}) as Partial<MetaIntegrationInput>;
    let accessToken = (body.accessToken || "").trim();
    let phoneNumberId = (body.phoneNumberId || "").trim();
    let apiVersion = (body.apiVersion || "").trim();

    if (!accessToken || !phoneNumberId) {
      const integração = await carregarIntegracaoMetaDoUsuario(auth.usuario.id);
      if (!integração.error && integração.data) {
        const cfg = (integração.data.configuration || {}) as Record<string, unknown>;
        const creds = (integração.data.credentials || {}) as Record<string, unknown>;
        accessToken = accessToken || String(creds["access_token"] || "");
        phoneNumberId = phoneNumberId || String(cfg["phone_number_id"] || "");
        apiVersion = apiVersion || String(cfg["api_version"] || "");
      }
    }

    const teste = await testarCredenciaisMeta({
      accessToken,
      phoneNumberId,
      apiVersion,
    });

    return res.status(teste.status).json({
      ok: teste.ok,
      message: teste.message,
      details: teste.details,
      data: teste.data,
    });
  });

  app.post("/api/meta/integration/salvar", express.json(), async (req, res) => {
    const auth = await autenticarUsuario(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.erro });
    }
    if (!isAdminUser(auth.usuario)) {
      return res.status(403).json({ message: "Somente administradores podem salvar integração Meta." });
    }

    const body = (req.body || {}) as Partial<MetaIntegrationInput>;
    const input: MetaIntegrationInput = {
      accessToken: String(body.accessToken || "").trim(),
      phoneNumberId: String(body.phoneNumberId || "").trim(),
      wabaId: String(body.wabaId || "").trim() || undefined,
      systemUserId: String(body.systemUserId || "").trim() || undefined,
      businessId: String(body.businessId || "").trim() || undefined,
      configId: String(body.configId || "").trim() || undefined,
      onboardingUrl: String(body.onboardingUrl || "").trim() || undefined,
      apiVersion: String(body.apiVersion || "").trim() || undefined,
    };

    if (!input.accessToken || !input.phoneNumberId) {
      return res.status(400).json({
        message: "Preencha Access Token e Phone Number ID para concluir o cadastro Meta.",
      });
    }

    const teste = await testarCredenciaisMeta({
      accessToken: input.accessToken,
      phoneNumberId: input.phoneNumberId,
      apiVersion: input.apiVersion,
    });
    if (!teste.ok) {
      return res.status(teste.status).json({
        message: "Não foi possível validar as credenciais Meta antes de salvar.",
        details: teste.details,
        data: teste.data,
      });
    }

    const salvo = await salvarIntegracaoMetaDoUsuario(auth.usuario.id, input);
    if (!salvo.ok) {
      return res.status(salvo.status).json({ message: salvo.message });
    }

    return res.status(200).json({
      ok: true,
      message: salvo.message,
      integration: salvo.data,
    });
  });

  app.post("/api/admin/documentos/enviar", async (req, res) => {
    const auth = await autenticarUsuario(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.erro });
    }

    if (!isAdminUser(auth.usuario)) {
      return res
        .status(403)
        .json({ message: "Apenas administradores podem enviar materiais para clientes." });
    }

    if (!docsWebhookUrl) {
      return res.status(500).json({
        message: "Configure DOCS_WEBHOOK_URL no servidor para encaminhar os documentos.",
      });
    }
    const resultado = await encaminharMultipartParaWebhook({
      req,
      webhookUrl: docsWebhookUrl,
      headersExtras: {
        "x-origem-app": "app-conversa-admin",
        "x-admin-id": auth.usuario.id,
        "x-admin-email": auth.usuario.email || "",
      },
    });

    if (!resultado.ok) {
      return res.status(resultado.status).json({
        message: "Falha ao enviar materiais para o cliente.",
        details: resultado.details,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Materiais e links de acesso enviados com sucesso ao cliente.",
      details: resultado.details,
    });
  });

  app.post("/api/comprovantes/enviar", async (req, res) => {
    const auth = await autenticarUsuario(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.erro });
    }

    if (!comprovantesWebhookUrl) {
      return res.status(500).json({
        message:
          "Configure COMPROVANTES_WEBHOOK_URL no servidor para receber comprovantes.",
      });
    }

    const resultado = await encaminharMultipartParaWebhook({
      req,
      webhookUrl: comprovantesWebhookUrl,
      headersExtras: {
        "x-origem-app": "app-conversa-cliente",
        "x-cliente-id": auth.usuario.id,
        "x-cliente-email": auth.usuario.email || "",
      },
    });

    if (!resultado.ok) {
      return res.status(resultado.status).json({
        message: "Falha ao enviar comprovante de pagamento.",
        details: resultado.details,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Comprovante enviado com sucesso. Aguarde confirmação por e-mail ou WhatsApp.",
      details: resultado.details,
    });
  });

  app.post("/api/whatsapp/enviar", express.json(), async (req, res) => {
    const auth = await autenticarUsuario(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.erro });
    }

    const body = req.body as {
      telefone?: string;
      mensagem?: string;
      origem?: string;
    };

    const resultado = await enviarWhatsapp({
      telefone: body.telefone || "",
      mensagem: body.mensagem || "",
      origem: body.origem || "app-conversa",
      remetenteId: auth.usuario.id,
    });

    if (!resultado.ok) {
      return res.status(resultado.status).json({
        ok: false,
        message: resultado.message,
        details: resultado.details,
      });
    }

    await persistirSaidaWhatsapp({
      telefone: body.telefone || "",
      texto: body.mensagem || "",
      providerMessageId: resultado.providerMessageId,
      provider: whatsappProvider === "evolution" ? "evolution" : "meta",
    });

    return res.status(200).json({
      ok: true,
      message: resultado.message,
      details: resultado.details,
    });
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
