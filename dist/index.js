// server/index.ts
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var supabaseUrl = process.env.SUPABASE_URL;
var supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
var docsWebhookUrl = process.env.DOCS_WEBHOOK_URL;
var comprovantesWebhookUrl = process.env.COMPROVANTES_WEBHOOK_URL || process.env.DOCS_WEBHOOK_URL;
var whatsappProvider = (process.env.WHATSAPP_PROVIDER || "none").toLowerCase();
var whatsappEvolutionUrl = process.env.WHATSAPP_EVOLUTION_URL;
var whatsappEvolutionApiKey = process.env.WHATSAPP_EVOLUTION_API_KEY;
var whatsappEvolutionInstance = process.env.WHATSAPP_EVOLUTION_INSTANCE;
var whatsappMetaToken = process.env.WHATSAPP_META_TOKEN || process.env.META_CLI_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
var whatsappMetaPhoneNumberId = process.env.WHATSAPP_META_PHONE_NUMBER_ID || process.env.META_CLI_WABA_PHONE_ID || process.env.META_WABA_PHONE_ID;
var whatsappMetaApiVersion = process.env.WHATSAPP_META_API_VERSION || process.env.META_API_VERSION || "v22.0";
var whatsappWebhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || "";
var whatsappMetaAppSecret = process.env.WHATSAPP_META_APP_SECRET || process.env.META_APP_SECRET || "";
var adminEmails = new Set(
  (process.env.ADMIN_EMAILS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean)
);
var supabaseAdmin = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
}) : null;
function normalizarTelefoneWhatsapp(telefone) {
  return telefone.replace(/\D/g, "");
}
function parseJsonSeguro(valor) {
  try {
    return JSON.parse(String(valor));
  } catch {
    return null;
  }
}
function mascararSegredo(valor) {
  const limpo = (valor || "").trim();
  if (!limpo) return "";
  if (limpo.length <= 8) return "*".repeat(limpo.length);
  return `${limpo.slice(0, 4)}...${limpo.slice(-4)}`;
}
function mensagemErroIntegracao(error) {
  const code = String(error.code || "").toUpperCase();
  const status = Number(error.status || 0);
  const message = String(error.message || "").toLowerCase();
  if (code === "PGRST205" || status === 404 || message.includes("relation") || message.includes("table")) {
    return "Tabela de integra\xE7\xF5es n\xE3o encontrada. Execute shared/supabase-setup-completo.sql no Supabase.";
  }
  return "Falha ao acessar integra\xE7\xF5es Meta no Supabase.";
}
async function carregarIntegracaoMetaDoUsuario(userId) {
  if (!supabaseAdmin) return { data: null, error: null };
  const resp = await supabaseAdmin.from("integrations").select("id,user_id,display_name,service_name,status,credentials,configuration,updated_at,created_at").eq("user_id", userId).eq("service_name", "WHATSAPP_META").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return resp;
}
async function salvarIntegracaoMetaDoUsuario(userId, input) {
  if (!supabaseAdmin) {
    return {
      ok: false,
      status: 500,
      message: "Servidor sem SUPABASE_SERVICE_ROLE_KEY.",
      data: null
    };
  }
  const existente = await carregarIntegracaoMetaDoUsuario(userId);
  if (existente.error) {
    return {
      ok: false,
      status: 500,
      message: mensagemErroIntegracao(existente.error),
      data: null
    };
  }
  const registro = {
    user_id: userId,
    service_name: "WHATSAPP_META",
    display_name: "WhatsApp Meta",
    status: "CONNECTED",
    credentials: {
      access_token: input.accessToken
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
      saved_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  const persistencia = existente.data?.id ? await supabaseAdmin.from("integrations").update(registro).eq("id", existente.data.id).select("id,user_id,display_name,service_name,status,configuration,updated_at,created_at").maybeSingle() : await supabaseAdmin.from("integrations").insert(registro).select("id,user_id,display_name,service_name,status,configuration,updated_at,created_at").maybeSingle();
  if (persistencia.error) {
    return {
      ok: false,
      status: 500,
      message: mensagemErroIntegracao(persistencia.error),
      data: null
    };
  }
  return {
    ok: true,
    status: 200,
    message: "Integra\xE7\xE3o Meta salva com sucesso.",
    data: persistencia.data
  };
}
async function testarCredenciaisMeta(params) {
  const token = params.accessToken.trim();
  const phoneId = params.phoneNumberId.trim();
  const version = (params.apiVersion || whatsappMetaApiVersion || "v22.0").trim();
  if (!token || !phoneId) {
    return {
      ok: false,
      status: 400,
      message: "Token e Phone Number ID s\xE3o obrigat\xF3rios para teste.",
      details: null,
      data: null
    };
  }
  const endpoint = `https://graph.facebook.com/${version}/${phoneId}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`;
  const resp = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const text = await resp.text();
  const json = parseJsonSeguro(text);
  if (!resp.ok) {
    return {
      ok: false,
      status: resp.status,
      message: "Falha ao validar credenciais Meta.",
      details: text || null,
      data: json
    };
  }
  return {
    ok: true,
    status: 200,
    message: "Credenciais Meta v\xE1lidas.",
    details: null,
    data: json
  };
}
function verificarAssinaturaMeta(rawBody, assinaturaHeader) {
  if (!whatsappMetaAppSecret) return true;
  if (!assinaturaHeader || !assinaturaHeader.startsWith("sha256=")) return false;
  const assinaturaRecebida = assinaturaHeader.slice("sha256=".length).trim();
  const assinaturaCalculada = crypto.createHmac("sha256", whatsappMetaAppSecret).update(rawBody).digest("hex");
  const a = Buffer.from(assinaturaRecebida, "hex");
  const b = Buffer.from(assinaturaCalculada, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
async function persistirConversaWhatsappExterna(evento) {
  if (!supabaseAdmin) return;
  const upsertContato = await supabaseAdmin.from("whatsapp_contacts").upsert(
    {
      wa_id: evento.telefone,
      telefone: evento.telefone,
      nome: evento.pushName || null,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    { onConflict: "wa_id" }
  );
  if (upsertContato.error) {
    return;
  }
  const contato = await supabaseAdmin.from("whatsapp_contacts").select("id").eq("wa_id", evento.telefone).maybeSingle();
  if (contato.error || !contato.data?.id) return;
  const upsertConversa = await supabaseAdmin.from("whatsapp_conversations").upsert(
    {
      contact_id: contato.data.id,
      last_message_at: evento.timestamp ? new Date(Number(evento.timestamp) * 1e3).toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    },
    { onConflict: "contact_id" }
  );
  if (upsertConversa.error) {
    return;
  }
  const conversa = await supabaseAdmin.from("whatsapp_conversations").select("id").eq("contact_id", contato.data.id).maybeSingle();
  if (conversa.error || !conversa.data?.id) return;
  await supabaseAdmin.from("whatsapp_messages").insert({
    conversation_id: conversa.data.id,
    direction: "inbound",
    body: evento.texto,
    provider: evento.provider,
    provider_message_id: evento.externalMessageId,
    raw_payload: evento.rawPayload,
    created_at: evento.timestamp ? new Date(Number(evento.timestamp) * 1e3).toISOString() : (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function obterAdminPadraoId() {
  if (!supabaseAdmin) return null;
  if (adminEmails.size > 0) {
    const emails = Array.from(adminEmails);
    const resp = await supabaseAdmin.from("profiles").select("id,email").in("email", emails).limit(1).maybeSingle();
    if (resp.data?.id) return resp.data.id;
  }
  const fallback = await supabaseAdmin.from("profiles").select("id").limit(1).maybeSingle();
  return fallback.data?.id ?? null;
}
async function obterConversaOuCriarEntreUsuarios(usuarioA, usuarioB) {
  if (!supabaseAdmin) return null;
  const candidatas = await supabaseAdmin.from("conversation_participants").select("conversation_id,user_id").in("user_id", [usuarioA, usuarioB]);
  if (!candidatas.error && candidatas.data) {
    const mapa = /* @__PURE__ */ new Map();
    for (const item of candidatas.data) {
      if (!mapa.has(item.conversation_id)) {
        mapa.set(item.conversation_id, /* @__PURE__ */ new Set());
      }
      mapa.get(item.conversation_id)?.add(item.user_id);
    }
    const existente = Array.from(mapa.entries()).find(([, participantes]) => {
      return participantes.has(usuarioA) && participantes.has(usuarioB);
    });
    if (existente) return existente[0];
  }
  const criada = await supabaseAdmin.from("conversations").insert({}).select("id").maybeSingle();
  if (criada.error || !criada.data?.id) return null;
  const vinculo = await supabaseAdmin.from("conversation_participants").insert([
    { conversation_id: criada.data.id, user_id: usuarioA },
    { conversation_id: criada.data.id, user_id: usuarioB }
  ]);
  if (vinculo.error) return null;
  return criada.data.id;
}
async function espelharMensagemNoChatInterno(evento) {
  if (!supabaseAdmin) return;
  const telefone = normalizarTelefoneWhatsapp(evento.telefone);
  if (!telefone) return;
  const variacoes = Array.from(
    /* @__PURE__ */ new Set([telefone, `+${telefone}`, `55${telefone}`, `+55${telefone}`])
  );
  const remetenteResp = await supabaseAdmin.from("profiles").select("id,telefone,phone").or(
    variacoes.flatMap((v) => [`telefone.eq.${v}`, `phone.eq.${v}`]).join(",")
  ).limit(1).maybeSingle();
  const remetenteId = remetenteResp.data?.id;
  if (!remetenteId) return;
  const adminId = await obterAdminPadraoId();
  if (!adminId || adminId === remetenteId) return;
  const conversationId = await obterConversaOuCriarEntreUsuarios(remetenteId, adminId);
  if (!conversationId) return;
  await supabaseAdmin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: remetenteId,
    conteudo: evento.texto,
    created_at: evento.timestamp ? new Date(Number(evento.timestamp) * 1e3).toISOString() : (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function processarEventoWhatsappRecebido(evento) {
  await persistirConversaWhatsappExterna(evento);
  await espelharMensagemNoChatInterno(evento);
}
async function persistirSaidaWhatsapp(params) {
  if (!supabaseAdmin) return;
  const telefone = normalizarTelefoneWhatsapp(params.telefone);
  const texto = params.texto.trim();
  if (!telefone || !texto) return;
  const upsertContato = await supabaseAdmin.from("whatsapp_contacts").upsert(
    {
      wa_id: telefone,
      telefone,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    { onConflict: "wa_id" }
  );
  if (upsertContato.error) return;
  const contato = await supabaseAdmin.from("whatsapp_contacts").select("id").eq("wa_id", telefone).maybeSingle();
  if (contato.error || !contato.data?.id) return;
  const upsertConversa = await supabaseAdmin.from("whatsapp_conversations").upsert(
    {
      contact_id: contato.data.id,
      last_message_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    { onConflict: "contact_id" }
  );
  if (upsertConversa.error) return;
  const conversa = await supabaseAdmin.from("whatsapp_conversations").select("id").eq("contact_id", contato.data.id).maybeSingle();
  if (conversa.error || !conversa.data?.id) return;
  await supabaseAdmin.from("whatsapp_messages").insert({
    conversation_id: conversa.data.id,
    direction: "outbound",
    provider: params.provider,
    body: texto,
    provider_message_id: params.providerMessageId,
    raw_payload: {}
  });
}
function extrairEventosMeta(payload) {
  const eventos = [];
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
        const contato = contatos.find((c) => String(c?.wa_id || "") === String(msg?.from || ""));
        const pushName = String(contato?.profile?.name || "").trim() || null;
        eventos.push({
          provider: "meta",
          telefone: from,
          texto,
          externalMessageId: id,
          pushName,
          timestamp: timestamp || null,
          rawPayload: msg
        });
      }
    }
  }
  return eventos;
}
function extrairEventosEvolution(payload) {
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
      rawPayload: payload
    }
  ];
}
async function enviarWhatsapp(params) {
  const telefone = normalizarTelefoneWhatsapp(params.telefone);
  const mensagem = params.mensagem.trim();
  if (!telefone || !mensagem) {
    return {
      ok: false,
      status: 400,
      message: "Telefone e mensagem s\xE3o obrigat\xF3rios para envio WhatsApp.",
      details: null,
      providerMessageId: null
    };
  }
  if (whatsappProvider === "none") {
    return {
      ok: false,
      status: 501,
      message: "Integra\xE7\xE3o WhatsApp n\xE3o configurada. Defina WHATSAPP_PROVIDER e credenciais no .env.",
      details: null,
      providerMessageId: null
    };
  }
  if (whatsappProvider === "evolution") {
    if (!whatsappEvolutionUrl || !whatsappEvolutionApiKey || !whatsappEvolutionInstance) {
      return {
        ok: false,
        status: 500,
        message: "Evolution API n\xE3o configurada. Defina WHATSAPP_EVOLUTION_URL, WHATSAPP_EVOLUTION_API_KEY e WHATSAPP_EVOLUTION_INSTANCE.",
        details: null,
        providerMessageId: null
      };
    }
    const endpoint = `${whatsappEvolutionUrl.replace(/\/+$/, "")}/message/sendText/${whatsappEvolutionInstance}`;
    const resposta = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: whatsappEvolutionApiKey,
        "x-origem-app": params.origem,
        "x-remetente-id": params.remetenteId
      },
      body: JSON.stringify({
        number: telefone,
        text: mensagem
      })
    });
    const detalhe = await resposta.text();
    const json = parseJsonSeguro(detalhe);
    if (!resposta.ok) {
      return {
        ok: false,
        status: resposta.status,
        message: "Falha ao enviar mensagem via Evolution API.",
        details: detalhe || null,
        providerMessageId: null
      };
    }
    return {
      ok: true,
      status: 200,
      message: "Mensagem enviada via Evolution API.",
      details: detalhe || null,
      providerMessageId: String(json?.key?.id || "") || null
    };
  }
  if (whatsappProvider === "meta" || whatsappProvider === "official") {
    if (!whatsappMetaToken || !whatsappMetaPhoneNumberId) {
      return {
        ok: false,
        status: 500,
        message: "WhatsApp oficial n\xE3o configurado. Defina WHATSAPP_META_TOKEN e WHATSAPP_META_PHONE_NUMBER_ID.",
        details: null,
        providerMessageId: null
      };
    }
    const endpoint = `https://graph.facebook.com/${whatsappMetaApiVersion}/${whatsappMetaPhoneNumberId}/messages`;
    const resposta = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${whatsappMetaToken}`
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefone,
        type: "text",
        text: { body: mensagem }
      })
    });
    const detalhe = await resposta.text();
    const json = parseJsonSeguro(detalhe);
    if (!resposta.ok) {
      return {
        ok: false,
        status: resposta.status,
        message: "Falha ao enviar mensagem via WhatsApp oficial.",
        details: detalhe || null,
        providerMessageId: null
      };
    }
    return {
      ok: true,
      status: 200,
      message: "Mensagem enviada via WhatsApp oficial.",
      details: detalhe || null,
      providerMessageId: String(json?.messages?.[0]?.id || "") || null
    };
  }
  return {
    ok: false,
    status: 400,
    message: `Provedor WhatsApp inv\xE1lido: ${whatsappProvider}. Use none, evolution ou meta.`,
    details: null,
    providerMessageId: null
  };
}
function isAdminUser(usuario) {
  const userRole = String(
    usuario.userMetadata?.role || usuario.appMetadata?.role || ""
  ).toLowerCase();
  const userIsAdminFlag = usuario.userMetadata?.is_admin === true || usuario.appMetadata?.is_admin === true;
  const email = (usuario.email || "").toLowerCase();
  const adminPorEmail = !!email && adminEmails.has(email);
  return userRole === "admin" || userIsAdminFlag || adminPorEmail;
}
async function autenticarUsuario(req) {
  if (!supabaseAdmin) {
    return { ok: false, status: 500, erro: "Servidor sem SUPABASE_SERVICE_ROLE_KEY." };
  }
  const authHeader = req.header("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return { ok: false, status: 401, erro: "Token de acesso ausente." };
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { ok: false, status: 401, erro: "Token de acesso inv\xE1lido." };
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, status: 401, erro: "Sess\xE3o inv\xE1lida ou expirada." };
  }
  const usuario = {
    id: data.user.id,
    email: data.user.email ?? null,
    userMetadata: data.user.user_metadata ?? null,
    appMetadata: data.user.app_metadata ?? null
  };
  return { ok: true, usuario };
}
async function encaminharMultipartParaWebhook(params) {
  const { req, webhookUrl, headersExtras = {} } = params;
  const contentType = req.header("content-type");
  if (!contentType || !contentType.includes("multipart/form-data")) {
    return {
      ok: false,
      status: 400,
      message: "Formato inv\xE1lido. Envie os dados como multipart/form-data.",
      details: null
    };
  }
  try {
    const webhookResponse = await fetch(
      webhookUrl,
      {
        method: "POST",
        headers: {
          "content-type": contentType,
          ...headersExtras
        },
        body: req,
        duplex: "half"
      }
    );
    const respostaWebhook = await webhookResponse.text();
    if (!webhookResponse.ok) {
      return {
        ok: false,
        status: webhookResponse.status,
        message: "Webhook retornou erro.",
        details: respostaWebhook || null
      };
    }
    return {
      ok: true,
      status: 200,
      message: "Envio conclu\xEDdo com sucesso.",
      details: respostaWebhook || null
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      message: "Falha ao encaminhar para o webhook.",
      details: error instanceof Error ? error.message : "Erro desconhecido"
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
      return res.status(400).send("Modo inv\xE1lido.");
    }
    if (!whatsappWebhookVerifyToken) {
      return res.status(500).send("WHATSAPP_WEBHOOK_VERIFY_TOKEN n\xE3o configurado no servidor.");
    }
    if (token !== whatsappWebhookVerifyToken) {
      return res.status(403).send("Verify token inv\xE1lido.");
    }
    return res.status(200).send(challenge);
  });
  app.post("/api/whatsapp/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const rawBody = req.body;
    const payload = parseJsonSeguro(rawBody);
    if (!payload) {
      return res.status(400).json({ ok: false, message: "Payload JSON inv\xE1lido." });
    }
    try {
      if (whatsappProvider === "meta" || whatsappProvider === "official") {
        const assinatura = req.header("x-hub-signature-256");
        const assinaturaValida = verificarAssinaturaMeta(rawBody, assinatura);
        if (!assinaturaValida) {
          return res.status(403).json({ ok: false, message: "Assinatura do webhook inv\xE1lida." });
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
        message: "Webhook recebido, mas WHATSAPP_PROVIDER est\xE1 como none."
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
      return res.status(403).json({ message: "Somente administradores podem acessar integra\xE7\xE3o Meta." });
    }
    const integra\u00E7\u00E3o = await carregarIntegracaoMetaDoUsuario(auth.usuario.id);
    if (integra\u00E7\u00E3o.error) {
      return res.status(500).json({ message: mensagemErroIntegracao(integra\u00E7\u00E3o.error) });
    }
    const cfg = integra\u00E7\u00E3o.data?.configuration || {};
    const creds = integra\u00E7\u00E3o.data?.credentials || {};
    return res.status(200).json({
      connected: !!integra\u00E7\u00E3o.data,
      integration: integra\u00E7\u00E3o.data ? {
        id: integra\u00E7\u00E3o.data.id,
        service_name: integra\u00E7\u00E3o.data.service_name,
        display_name: integra\u00E7\u00E3o.data.display_name,
        status: integra\u00E7\u00E3o.data.status,
        updated_at: integra\u00E7\u00E3o.data.updated_at,
        created_at: integra\u00E7\u00E3o.data.created_at,
        configuration: cfg,
        token_preview: mascararSegredo(String(creds["access_token"] || ""))
      } : null
    });
  });
  app.post("/api/meta/integration/testar", express.json(), async (req, res) => {
    const auth = await autenticarUsuario(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.erro });
    }
    if (!isAdminUser(auth.usuario)) {
      return res.status(403).json({ message: "Somente administradores podem testar integra\xE7\xE3o Meta." });
    }
    const body = req.body || {};
    let accessToken = (body.accessToken || "").trim();
    let phoneNumberId = (body.phoneNumberId || "").trim();
    let apiVersion = (body.apiVersion || "").trim();
    if (!accessToken || !phoneNumberId) {
      const integra\u00E7\u00E3o = await carregarIntegracaoMetaDoUsuario(auth.usuario.id);
      if (!integra\u00E7\u00E3o.error && integra\u00E7\u00E3o.data) {
        const cfg = integra\u00E7\u00E3o.data.configuration || {};
        const creds = integra\u00E7\u00E3o.data.credentials || {};
        accessToken = accessToken || String(creds["access_token"] || "");
        phoneNumberId = phoneNumberId || String(cfg["phone_number_id"] || "");
        apiVersion = apiVersion || String(cfg["api_version"] || "");
      }
    }
    const teste = await testarCredenciaisMeta({
      accessToken,
      phoneNumberId,
      apiVersion
    });
    return res.status(teste.status).json({
      ok: teste.ok,
      message: teste.message,
      details: teste.details,
      data: teste.data
    });
  });
  app.post("/api/meta/integration/salvar", express.json(), async (req, res) => {
    const auth = await autenticarUsuario(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.erro });
    }
    if (!isAdminUser(auth.usuario)) {
      return res.status(403).json({ message: "Somente administradores podem salvar integra\xE7\xE3o Meta." });
    }
    const body = req.body || {};
    const input = {
      accessToken: String(body.accessToken || "").trim(),
      phoneNumberId: String(body.phoneNumberId || "").trim(),
      wabaId: String(body.wabaId || "").trim() || void 0,
      systemUserId: String(body.systemUserId || "").trim() || void 0,
      businessId: String(body.businessId || "").trim() || void 0,
      configId: String(body.configId || "").trim() || void 0,
      onboardingUrl: String(body.onboardingUrl || "").trim() || void 0,
      apiVersion: String(body.apiVersion || "").trim() || void 0
    };
    if (!input.accessToken || !input.phoneNumberId) {
      return res.status(400).json({
        message: "Preencha Access Token e Phone Number ID para concluir o cadastro Meta."
      });
    }
    const teste = await testarCredenciaisMeta({
      accessToken: input.accessToken,
      phoneNumberId: input.phoneNumberId,
      apiVersion: input.apiVersion
    });
    if (!teste.ok) {
      return res.status(teste.status).json({
        message: "N\xE3o foi poss\xEDvel validar as credenciais Meta antes de salvar.",
        details: teste.details,
        data: teste.data
      });
    }
    const salvo = await salvarIntegracaoMetaDoUsuario(auth.usuario.id, input);
    if (!salvo.ok) {
      return res.status(salvo.status).json({ message: salvo.message });
    }
    return res.status(200).json({
      ok: true,
      message: salvo.message,
      integration: salvo.data
    });
  });
  app.post("/api/admin/documentos/enviar", async (req, res) => {
    const auth = await autenticarUsuario(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.erro });
    }
    if (!isAdminUser(auth.usuario)) {
      return res.status(403).json({ message: "Apenas administradores podem enviar materiais para clientes." });
    }
    if (!docsWebhookUrl) {
      return res.status(500).json({
        message: "Configure DOCS_WEBHOOK_URL no servidor para encaminhar os documentos."
      });
    }
    const resultado = await encaminharMultipartParaWebhook({
      req,
      webhookUrl: docsWebhookUrl,
      headersExtras: {
        "x-origem-app": "app-conversa-admin",
        "x-admin-id": auth.usuario.id,
        "x-admin-email": auth.usuario.email || ""
      }
    });
    if (!resultado.ok) {
      return res.status(resultado.status).json({
        message: "Falha ao enviar materiais para o cliente.",
        details: resultado.details
      });
    }
    return res.status(200).json({
      ok: true,
      message: "Materiais e links de acesso enviados com sucesso ao cliente.",
      details: resultado.details
    });
  });
  app.post("/api/comprovantes/enviar", async (req, res) => {
    const auth = await autenticarUsuario(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.erro });
    }
    if (!comprovantesWebhookUrl) {
      return res.status(500).json({
        message: "Configure COMPROVANTES_WEBHOOK_URL no servidor para receber comprovantes."
      });
    }
    const resultado = await encaminharMultipartParaWebhook({
      req,
      webhookUrl: comprovantesWebhookUrl,
      headersExtras: {
        "x-origem-app": "app-conversa-cliente",
        "x-cliente-id": auth.usuario.id,
        "x-cliente-email": auth.usuario.email || ""
      }
    });
    if (!resultado.ok) {
      return res.status(resultado.status).json({
        message: "Falha ao enviar comprovante de pagamento.",
        details: resultado.details
      });
    }
    return res.status(200).json({
      ok: true,
      message: "Comprovante enviado com sucesso. Aguarde confirma\xE7\xE3o por e-mail ou WhatsApp.",
      details: resultado.details
    });
  });
  app.post("/api/whatsapp/enviar", express.json(), async (req, res) => {
    const auth = await autenticarUsuario(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.erro });
    }
    const body = req.body;
    const resultado = await enviarWhatsapp({
      telefone: body.telefone || "",
      mensagem: body.mensagem || "",
      origem: body.origem || "app-conversa",
      remetenteId: auth.usuario.id
    });
    if (!resultado.ok) {
      return res.status(resultado.status).json({
        ok: false,
        message: resultado.message,
        details: resultado.details
      });
    }
    await persistirSaidaWhatsapp({
      telefone: body.telefone || "",
      texto: body.mensagem || "",
      providerMessageId: resultado.providerMessageId,
      provider: whatsappProvider === "evolution" ? "evolution" : "meta"
    });
    return res.status(200).json({
      ok: true,
      message: resultado.message,
      details: resultado.details
    });
  });
  const staticPath = process.env.NODE_ENV === "production" ? path.resolve(__dirname, "public") : path.resolve(__dirname, "..", "dist", "public");
  app.use(express.static(staticPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });
  const port = process.env.PORT || 3e3;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
