import express from "express";
import { createServer } from "http";
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
