import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Copy, Send } from "lucide-react";
import { useLocation } from "wouter";
import {
  PASTOR_CHATBOT_PROMPT,
  montarMensagensPersonalizadasPastor,
} from "@/lib/pastor-chatbot";

type AbaLateral = "usuarios" | "conversas" | "docs" | "meta";

interface PerfilUsuario {
  id: string;
  nome: string;
  email: string;
  telefone?: string | null;
}

interface PerfilUsuarioRaw {
  id: string;
  nome?: string | null;
  name?: string | null;
  email?: string | null;
  telefone?: string | null;
  phone?: string | null;
}

interface Mensagem {
  id: string;
  conversation_id: string;
  sender_id: string;
  conteudo: string;
  created_at: string;
}

interface ConversaResumo {
  id: string;
  participante: PerfilUsuario | null;
  ultimaMensagem: string;
  atualizadoEm: string | null;
}

interface MetaStatusResponse {
  connected?: boolean;
  integration?: {
    id: string;
    status?: string;
    token_preview?: string;
    configuration?: Record<string, unknown>;
  } | null;
}

type SupabaseErroBasico = {
  code?: string;
  status?: number;
  message?: string;
};

function formatarDataHora(valor: string | null) {
  if (!valor) return "";
  return new Date(valor).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarTelefone(telefone: string) {
  return telefone.replace(/\D/g, "");
}

function normalizarPerfil(raw: PerfilUsuarioRaw): PerfilUsuario {
  const nome = (raw.nome || raw.name || "").trim();
  const email = (raw.email || "").trim();
  const telefone = (raw.telefone || raw.phone || "").trim();

  return {
    id: raw.id,
    nome: nome || email.split("@")[0] || "Usuário",
    email: email || "sem-email@nao-informado.local",
    telefone: telefone || null,
  };
}

function mensagemErroChat(error: SupabaseErroBasico | null | undefined, fallback: string) {
  if (!error) return fallback;

  const code = String(error.code || "").toUpperCase();
  const mensagem = String(error.message || "").toLowerCase();
  const status = Number(error.status || 0);

  if (
    code === "PGRST205" ||
    status === 404 ||
    mensagem.includes("relation") ||
    mensagem.includes("table")
  ) {
    return "Banco de dados não configurado. No Supabase, abra o SQL Editor, execute `shared/supabase-setup-completo.sql`, aguarde concluir sem erro e recarregue esta página.";
  }

  return fallback;
}

function erroEhSetupBanco(mensagem: string) {
  return mensagem.toLowerCase().includes("banco de dados não configurado");
}

function gerarMensagemConfirmacaoPagamento(params: {
  nome: string;
  canal: "email" | "whatsapp";
}) {
  const nomeLimpo = params.nome.trim() || "cliente";

  if (params.canal === "whatsapp") {
    return `Olá, ${nomeLimpo}! Recebemos seu comprovante de pagamento ✅ Em breve confirmaremos por aqui no WhatsApp e liberaremos seu material (livros/cursos) com os links de acesso.`;
  }

  return `Olá, ${nomeLimpo}! Recebemos seu comprovante de pagamento ✅ Em breve você receberá a confirmação por e-mail e o envio do seu material (livros/cursos) com os links de acesso.`;
}

const META_ONBOARDING_URL_PADRAO =
  import.meta.env.VITE_META_EMBEDDED_SIGNUP_URL ||
  "https://business.facebook.com/messaging/whatsapp/onboard/?app_id=3728761024095089&config_id=734603033019116&extras=%7B%22sessionInfoVersion%22%3A%223%22%2C%22version%22%3A%22v3%22%7D";
const META_CONFIG_ID_PADRAO = import.meta.env.VITE_META_EMBEDDED_SIGNUP_CONFIG_ID || "734603033019116";
const META_API_VERSION_PADRAO = import.meta.env.VITE_META_API_VERSION || "v22.0";

export default function Chat() {
  const { usuario, sair } = useAuth();
  const [, navigate] = useLocation();
  const [abaLateral, setAbaLateral] = useState<AbaLateral>("usuarios");
  const [usuarios, setUsuarios] = useState<PerfilUsuario[]>([]);
  const [usuariosOnline, setUsuariosOnline] = useState<Set<string>>(new Set());
  const [conversas, setConversas] = useState<ConversaResumo[]>([]);
  const [conversaAtivaId, setConversaAtivaId] = useState<string | null>(null);
  const [contatoAtivo, setContatoAtivo] = useState<PerfilUsuario | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [carregandoTela, setCarregandoTela] = useState(true);
  const [enviandoMensagem, setEnviandoMensagem] = useState(false);
  const [erro, setErro] = useState("");

  const [docNome, setDocNome] = useState("");
  const [docEmail, setDocEmail] = useState("");
  const [docTelefone, setDocTelefone] = useState("");
  const [docArquivo, setDocArquivo] = useState<File | null>(null);
  const [docLinkAcesso, setDocLinkAcesso] = useState("");
  const [docObservacoes, setDocObservacoes] = useState("");
  const [docEnviando, setDocEnviando] = useState(false);
  const [docFeedback, setDocFeedback] = useState("");
  const [comprovanteCanal, setComprovanteCanal] = useState<"email" | "whatsapp">("email");
  const [comprovanteMensagem, setComprovanteMensagem] = useState("");
  const [previewNome, setPreviewNome] = useState("");
  const [previewLocalidade, setPreviewLocalidade] = useState("");
  const [promptCopiado, setPromptCopiado] = useState(false);
  const [metaOnboardingUrl, setMetaOnboardingUrl] = useState(META_ONBOARDING_URL_PADRAO);
  const [metaConfigId, setMetaConfigId] = useState(META_CONFIG_ID_PADRAO);
  const [metaApiVersion, setMetaApiVersion] = useState(META_API_VERSION_PADRAO);
  const [metaBusinessId, setMetaBusinessId] = useState("");
  const [metaSystemUserId, setMetaSystemUserId] = useState("");
  const [metaWabaId, setMetaWabaId] = useState("");
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaTokenPreview, setMetaTokenPreview] = useState("");
  const [metaConectado, setMetaConectado] = useState(false);
  const [metaCarregando, setMetaCarregando] = useState(false);
  const [metaTestando, setMetaTestando] = useState(false);
  const [metaSalvando, setMetaSalvando] = useState(false);
  const [metaFeedback, setMetaFeedback] = useState("");

  const canalMensagensRef = useRef<RealtimeChannel | null>(null);
  const canalPresencaRef = useRef<RealtimeChannel | null>(null);
  const canalPerfisRef = useRef<RealtimeChannel | null>(null);
  const recarregarUsuariosTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [carregandoPermissaoAdmin, setCarregandoPermissaoAdmin] = useState(true);
  const quantidadeOnline = usuarios.filter(item => usuariosOnline.has(item.id)).length;

  const usuariosOrdenados = useMemo(() => {
    return [...usuarios].sort((a, b) => {
      const aOnline = usuariosOnline.has(a.id);
      const bOnline = usuariosOnline.has(b.id);
      if (aOnline !== bOnline) return aOnline ? -1 : 1;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [usuarios, usuariosOnline]);

  const conversasOrdenadas = useMemo(
    () =>
      [...conversas].sort((a, b) => {
        const dataA = a.atualizadoEm ? new Date(a.atualizadoEm).getTime() : 0;
        const dataB = b.atualizadoEm ? new Date(b.atualizadoEm).getTime() : 0;
        return dataB - dataA;
      }),
    [conversas],
  );

  useEffect(() => {
    if (!usuario) return;

    setDocNome(usuario.nome ?? "");
    setDocEmail(usuario.email ?? "");
    setPreviewNome(usuario.nome ?? "");
  }, [usuario]);

  useEffect(() => {
    if (abaLateral !== "meta") return;
    void carregarStatusMeta();
  }, [abaLateral, isAdmin]);

  useEffect(() => {
    if (!usuario) return;

    let ativo = true;

    const carregarPermissaoAdmin = async () => {
      setCarregandoPermissaoAdmin(true);
      try {
        const token = await obterAccessToken();
        if (!token) {
          if (ativo) setIsAdmin(false);
          return;
        }

        const resp = await fetch("/api/admin/status", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!ativo) return;

        if (resp.status === 401) {
          setIsAdmin(false);
          return;
        }

        if (!resp.ok) {
          setIsAdmin(false);
          return;
        }

        const data = (await resp.json()) as { admin?: boolean };
        setIsAdmin(data.admin === true);
      } catch {
        if (ativo) setIsAdmin(false);
      } finally {
        if (ativo) setCarregandoPermissaoAdmin(false);
      }
    };

    void carregarPermissaoAdmin();

    return () => {
      ativo = false;
    };
  }, [usuario]);

  useEffect(() => {
    if (!usuario) return;

    let ativo = true;

    const inicializar = async () => {
      await sincronizarPerfilAtual();
      await Promise.all([carregarUsuarios(), carregarConversas()]);

      if (!ativo) return;
      setCarregandoTela(false);
    };

    const iniciarPresenca = () => {
      const canal = supabase.channel("presenca-usuarios", {
        config: {
          presence: {
            key: usuario.id,
          },
        },
      });

      canalPresencaRef.current = canal;

      canal
        .on("presence", { event: "sync" }, () => {
          atualizarUsuariosOnlinePorPresenca();
        })
        .on("presence", { event: "join" }, () => {
          atualizarUsuariosOnlinePorPresenca();
        })
        .on("presence", { event: "leave" }, () => {
          atualizarUsuariosOnlinePorPresenca();
        })
        .subscribe(async status => {
          if (status === "SUBSCRIBED") {
            await canal.track({
              id: usuario.id,
              nome: usuario.nome,
              email: usuario.email,
              onlineEm: new Date().toISOString(),
            });
          }
        });
    };

    const iniciarTempoRealPerfis = () => {
      const canal = supabase
        .channel("profiles-updates")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "profiles" },
          () => {
            agendarRecarregarUsuarios();
          },
        )
        .subscribe();

      canalPerfisRef.current = canal;
    };

    void inicializar();
    iniciarPresenca();
    iniciarTempoRealPerfis();

    return () => {
      ativo = false;

      if (recarregarUsuariosTimeoutRef.current) {
        clearTimeout(recarregarUsuariosTimeoutRef.current);
        recarregarUsuariosTimeoutRef.current = null;
      }

      if (canalPresencaRef.current) {
        void supabase.removeChannel(canalPresencaRef.current);
        canalPresencaRef.current = null;
      }
      if (canalPerfisRef.current) {
        void supabase.removeChannel(canalPerfisRef.current);
        canalPerfisRef.current = null;
      }
      if (canalMensagensRef.current) {
        void supabase.removeChannel(canalMensagensRef.current);
        canalMensagensRef.current = null;
      }
    };
  }, [usuario]);

  useEffect(() => {
    if (!conversaAtivaId) return;
    void carregarMensagensDaConversa(conversaAtivaId);
  }, [conversaAtivaId]);

  useEffect(() => {
    if (conversaAtivaId || !conversasOrdenadas.length) return;

    const primeiraConversa = conversasOrdenadas[0];
    setConversaAtivaId(primeiraConversa.id);
    setContatoAtivo(primeiraConversa.participante);
  }, [conversaAtivaId, conversasOrdenadas]);

  const sincronizarPerfilAtual = async () => {
    if (!usuario) return;

    const agora = new Date().toISOString();
    const tentativaPadrao = await supabase.from("profiles").upsert(
      {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        telefone: null,
        updated_at: agora,
      },
      { onConflict: "id" },
    );

    if (!tentativaPadrao.error) return;

    const mensagemPadrao = String(tentativaPadrao.error.message || "").toLowerCase();
    const precisaFallbackLegacy =
      mensagemPadrao.includes("user_id") ||
      mensagemPadrao.includes("name") ||
      mensagemPadrao.includes("phone");

    if (!precisaFallbackLegacy) {
      setErro(mensagemErroChat(tentativaPadrao.error, "Não foi possível sincronizar seu perfil."));
      return;
    }

    const tentativaComUserId = await supabase.from("profiles").upsert(
      {
        user_id: usuario.id,
        name: usuario.nome,
        email: usuario.email,
        phone: null,
        updated_at: agora,
      },
      { onConflict: "user_id" },
    );

    if (tentativaComUserId.error) {
      setErro(mensagemErroChat(tentativaComUserId.error, "Não foi possível sincronizar seu perfil."));
    }
  };

  const obterAccessToken = async () => {
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? null;
      if (token) return token;

      if (tentativa === 0) {
        await new Promise(resolve => setTimeout(resolve, 120));
      }
    }

    return null;
  };

  const redirecionarParaLoginPorSessaoExpirada = async () => {
    await sair();
    navigate("/login?next=%2Fapp", { replace: true });
  };

  const enviarMensagemWhatsappOpcional = async (mensagem: string, telefone?: string | null) => {
    const telefoneLimpo = formatarTelefone(telefone || "");
    if (!telefoneLimpo) return;

    const token = await obterAccessToken();
    if (!token) return;

    const resposta = await fetch("/api/whatsapp/enviar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        telefone: telefoneLimpo,
        mensagem,
        nome: contatoAtivo?.nome || "",
        origem: "chat_interno",
      }),
    });

    if (!resposta.ok && resposta.status !== 501) {
      const payload = (await resposta.json().catch(() => ({}))) as { message?: string };
      setErro(
        payload.message ||
          `Mensagem salva no chat, mas falhou no envio para WhatsApp (${resposta.status}).`,
      );
    }
  };

  const atualizarUsuariosOnlinePorPresenca = () => {
    const estado = canalPresencaRef.current?.presenceState() ?? {};
    const onlineIds = Object.entries(estado)
      .filter(([, metas]) => Array.isArray(metas) && metas.length > 0)
      .map(([userId]) => userId);
    setUsuariosOnline(new Set(onlineIds));
  };

  const agendarRecarregarUsuarios = () => {
    if (recarregarUsuariosTimeoutRef.current) {
      clearTimeout(recarregarUsuariosTimeoutRef.current);
    }
    recarregarUsuariosTimeoutRef.current = setTimeout(() => {
      void carregarUsuarios();
      recarregarUsuariosTimeoutRef.current = null;
    }, 250);
  };

  const carregarUsuarios = async () => {
    if (!usuario) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("id,nome,email,telefone")
      .neq("id", usuario.id)
      .order("nome", { ascending: true });

    if (!error) {
      setUsuarios(((data ?? []) as PerfilUsuarioRaw[]).map(normalizarPerfil));
      return;
    }

    const mensagem = String(error.message || "").toLowerCase();
    if (!mensagem.includes("column") && !mensagem.includes("nome") && !mensagem.includes("telefone")) {
      setErro(mensagemErroChat(error, "Não foi possível carregar os usuários."));
      return;
    }

    const fallback = await supabase
      .from("profiles")
      .select("id,name,email,phone")
      .neq("id", usuario.id)
      .order("name", { ascending: true });

    if (fallback.error) {
      setErro(mensagemErroChat(fallback.error, "Não foi possível carregar os usuários."));
      return;
    }

    setUsuarios(((fallback.data ?? []) as PerfilUsuarioRaw[]).map(normalizarPerfil));
  };

  const carregarConversas = async () => {
    if (!usuario) return;

    const { data: minhasParticipacoes, error: participacoesErro } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", usuario.id);

    if (participacoesErro) {
      setErro(mensagemErroChat(participacoesErro, "Não foi possível carregar suas conversas."));
      return;
    }

    const conversationIds = Array.from(
      new Set((minhasParticipacoes ?? []).map(item => item.conversation_id)),
    );

    if (!conversationIds.length) {
      setConversas([]);
      return;
    }

    const { data: participantes, error: participantesErro } = await supabase
      .from("conversation_participants")
      .select("conversation_id,user_id")
      .in("conversation_id", conversationIds);

    if (participantesErro) {
      setErro(
        mensagemErroChat(
          participantesErro,
          "Não foi possível carregar os participantes das conversas.",
        ),
      );
      return;
    }

    const outrosIds = Array.from(
      new Set(
        (participantes ?? [])
          .map(item => item.user_id)
          .filter(userId => userId !== usuario.id),
      ),
    );

    const { data: outrosPerfis, error: perfisErro } = await supabase
      .from("profiles")
      .select("id,nome,email,telefone")
      .in("id", outrosIds);

    let perfisNormalizados: PerfilUsuario[] = [];
    if (!perfisErro) {
      perfisNormalizados = ((outrosPerfis ?? []) as PerfilUsuarioRaw[]).map(normalizarPerfil);
    } else {
      const mensagemPerfis = String(perfisErro.message || "").toLowerCase();
      if (
        mensagemPerfis.includes("column") &&
        (mensagemPerfis.includes("nome") || mensagemPerfis.includes("telefone"))
      ) {
        const fallbackPerfis = await supabase
          .from("profiles")
          .select("id,name,email,phone")
          .in("id", outrosIds);

        if (fallbackPerfis.error) {
          setErro(
            mensagemErroChat(
              fallbackPerfis.error,
              "Não foi possível carregar os perfis das conversas.",
            ),
          );
          return;
        }

        perfisNormalizados = ((fallbackPerfis.data ?? []) as PerfilUsuarioRaw[]).map(
          normalizarPerfil,
        );
      } else {
        setErro(mensagemErroChat(perfisErro, "Não foi possível carregar os perfis das conversas."));
        return;
      }
    }

    if (perfisErro && !perfisNormalizados.length && outrosIds.length) {
      setErro(mensagemErroChat(perfisErro, "Não foi possível carregar os perfis das conversas."));
      return;
    }

    const { data: mensagensData, error: mensagensErro } = await supabase
      .from("messages")
      .select("conversation_id,conteudo,created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false });

    if (mensagensErro) {
      setErro(mensagemErroChat(mensagensErro, "Não foi possível carregar as últimas mensagens."));
      return;
    }

    const perfilMap = new Map(perfisNormalizados.map(perfil => [perfil.id, perfil]));
    const ultimaMensagemPorConversa = new Map<
      string,
      { conteudo: string; created_at: string | null }
    >();

    (mensagensData ?? []).forEach(item => {
      if (!ultimaMensagemPorConversa.has(item.conversation_id)) {
        ultimaMensagemPorConversa.set(item.conversation_id, {
          conteudo: item.conteudo,
          created_at: item.created_at,
        });
      }
    });

    const lista: ConversaResumo[] = conversationIds.map(conversationId => {
      const outroParticipante = (participantes ?? []).find(
        item => item.conversation_id === conversationId && item.user_id !== usuario.id,
      );
      const participante =
        (outroParticipante ? perfilMap.get(outroParticipante.user_id) : null) ?? null;
      const ultima = ultimaMensagemPorConversa.get(conversationId);

      return {
        id: conversationId,
        participante: participante as PerfilUsuario | null,
        ultimaMensagem: ultima?.conteudo ?? "Conversa iniciada",
        atualizadoEm: ultima?.created_at ?? null,
      };
    });

    setConversas(lista);
  };

  const carregarMensagensDaConversa = async (conversationId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("id,conversation_id,sender_id,conteudo,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      setErro(mensagemErroChat(error, "Não foi possível carregar as mensagens da conversa."));
      return;
    }

    setMensagens((data ?? []) as Mensagem[]);
    inscreverTempoRealMensagens(conversationId);
  };

  const inscreverTempoRealMensagens = (conversationId: string) => {
    if (canalMensagensRef.current) {
      void supabase.removeChannel(canalMensagensRef.current);
      canalMensagensRef.current = null;
    }

    const canal = supabase
      .channel(`mensagens:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        payload => {
          const nova = payload.new as Mensagem;
          setMensagens(atual => [...atual, nova]);
          void carregarConversas();
        },
      )
      .subscribe();

    canalMensagensRef.current = canal;
  };

  const obterOuCriarConversa = async (outroUsuarioId: string) => {
    if (!usuario) throw new Error("Usuário não autenticado.");

    const { data: candidatas, error: candidatasErro } = await supabase
      .from("conversation_participants")
      .select("conversation_id,user_id")
      .in("user_id", [usuario.id, outroUsuarioId]);

    if (candidatasErro) {
      throw new Error("Não foi possível verificar conversas existentes.");
    }

    const mapa = new Map<string, Set<string>>();
    (candidatas ?? []).forEach(item => {
      if (!mapa.has(item.conversation_id)) {
        mapa.set(item.conversation_id, new Set());
      }
      mapa.get(item.conversation_id)?.add(item.user_id);
    });

    const conversaExistente = Array.from(mapa.entries()).find(([, participantes]) => {
      return participantes.has(usuario.id) && participantes.has(outroUsuarioId);
    });

    if (conversaExistente) {
      return conversaExistente[0];
    }

    const { data: novaConversa, error: criarErro } = await supabase
      .from("conversations")
      .insert({})
      .select("id")
      .single();

    if (criarErro || !novaConversa) {
      throw new Error("Não foi possível iniciar a conversa.");
    }

    const { error: vincularErro } = await supabase.from("conversation_participants").insert([
      { conversation_id: novaConversa.id, user_id: usuario.id },
      { conversation_id: novaConversa.id, user_id: outroUsuarioId },
    ]);

    if (vincularErro) {
      throw new Error("Não foi possível vincular os participantes.");
    }

    return novaConversa.id;
  };

  const iniciarConversa = async (destino: PerfilUsuario) => {
    try {
      setErro("");
      const conversationId = await obterOuCriarConversa(destino.id);
      setContatoAtivo(destino);
      setConversaAtivaId(conversationId);
      setAbaLateral("conversas");
      await carregarConversas();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao iniciar conversa.");
    }
  };

  const abrirConversa = async (conversa: ConversaResumo) => {
    setContatoAtivo(conversa.participante);
    setConversaAtivaId(conversa.id);
    await carregarMensagensDaConversa(conversa.id);
  };

  const enviarMensagem = async () => {
    if (!usuario || !novaMensagem.trim()) return;

    let conversationId = conversaAtivaId;

    if (!conversationId && contatoAtivo) {
      try {
        conversationId = await obterOuCriarConversa(contatoAtivo.id);
        setConversaAtivaId(conversationId);
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Não foi possível iniciar a conversa.");
        return;
      }
    }

    if (!conversationId) {
      setErro("Selecione um usuário para iniciar a conversa.");
      return;
    }

    setEnviandoMensagem(true);
    setErro("");

    const conteudo = novaMensagem.trim();
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: usuario.id,
      conteudo,
    });

    setEnviandoMensagem(false);

    if (error) {
      setErro(mensagemErroChat(error, "Não foi possível enviar a mensagem."));
      return;
    }

    setNovaMensagem("");
    await enviarMensagemWhatsappOpcional(conteudo, contatoAtivo?.telefone);
    await carregarConversas();
  };

  const enviarDocsParaWebhook = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAdmin) {
      setDocFeedback("Apenas administradores podem enviar materiais para clientes.");
      return;
    }

    if (!docArquivo && !docLinkAcesso.trim()) {
      setDocFeedback("Anexe um arquivo de material ou informe um link de acesso ao produto.");
      return;
    }

    setDocEnviando(true);
    setDocFeedback("");

    const token = await obterAccessToken();
    if (!token) {
      setDocEnviando(false);
      setDocFeedback("Sessão expirada. Redirecionando para login...");
      await redirecionarParaLoginPorSessaoExpirada();
      return;
    }

    const dados = new FormData();
    dados.append("nome", docNome);
    dados.append("email", docEmail);
    dados.append("telefone", formatarTelefone(docTelefone));
    dados.append("tipo_envio", "material_admin");
    dados.append("observacoes", docObservacoes);
    dados.append("link_acesso", docLinkAcesso.trim());

    if (docArquivo) {
      dados.append("arquivo", docArquivo);
    }

    if (contatoAtivo) {
      dados.append("cliente_id", contatoAtivo.id);
      dados.append("cliente_nome", contatoAtivo.nome);
    }

    if (conversaAtivaId) {
      dados.append("conversation_id", conversaAtivaId);
    }

    try {
      const resposta = await fetch("/api/admin/documentos/enviar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: dados,
      });

      if (resposta.status === 401) {
        setDocFeedback("Sessão inválida ou expirada. Redirecionando para login...");
        await redirecionarParaLoginPorSessaoExpirada();
        return;
      }

      if (!resposta.ok) {
        const erro = (await resposta.json().catch(() => ({}))) as {
          message?: string;
          details?: string | null;
        };
        throw new Error(erro.message || `Falha no envio (${resposta.status}).`);
      }

      setDocFeedback("Documento enviado com sucesso.");
      setDocArquivo(null);
      setDocTelefone("");
      setDocLinkAcesso("");
      setDocObservacoes("");
    } catch (err) {
      setDocFeedback(
        err instanceof Error ? err.message : "Não foi possível enviar o documento.",
      );
    } finally {
      setDocEnviando(false);
    }
  };

  const enviarComprovantePagamento = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isAdmin) {
      setDocFeedback("Administradores devem usar o formulário de envio de materiais.");
      return;
    }

    if (!docArquivo) {
      setDocFeedback("Anexe o comprovante de pagamento para prosseguir.");
      return;
    }

    const extensao = docArquivo.name.toLowerCase();
    const valido =
      extensao.endsWith(".pdf") ||
      extensao.endsWith(".png") ||
      extensao.endsWith(".jpg") ||
      extensao.endsWith(".jpeg") ||
      extensao.endsWith(".webp");

    if (!valido) {
      setDocFeedback("Envie o comprovante em PDF ou imagem (PNG/JPG/WEBP).");
      return;
    }

    setDocEnviando(true);
    setDocFeedback("");

    const token = await obterAccessToken();
    if (!token) {
      setDocEnviando(false);
      setDocFeedback("Sessão expirada. Redirecionando para login...");
      await redirecionarParaLoginPorSessaoExpirada();
      return;
    }

    const dados = new FormData();
    dados.append("tipo_envio", "comprovante_cliente");
    dados.append("nome", docNome);
    dados.append("email", docEmail);
    dados.append("telefone", formatarTelefone(docTelefone));
    dados.append("canal_confirmacao", comprovanteCanal);
    dados.append("mensagem_cliente", comprovanteMensagem.trim());
    dados.append("mensagem_confirmacao_padrao", mensagemConfirmacaoPadrao);
    dados.append("comprovante", docArquivo);

    if (conversaAtivaId) {
      dados.append("conversation_id", conversaAtivaId);
    }

    try {
      const resposta = await fetch("/api/comprovantes/enviar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: dados,
      });

      if (resposta.status === 401) {
        setDocFeedback("Sessão inválida ou expirada. Redirecionando para login...");
        await redirecionarParaLoginPorSessaoExpirada();
        return;
      }

      if (!resposta.ok) {
        const erro = (await resposta.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(erro.message || `Falha no envio (${resposta.status}).`);
      }

      setDocFeedback(
        `Comprovante enviado com sucesso. Mensagem automática de confirmação preparada para ${
          comprovanteCanal === "whatsapp" ? "WhatsApp" : "e-mail"
        }.`,
      );
      setDocArquivo(null);
      setComprovanteMensagem("");
    } catch (err) {
      setDocFeedback(
        err instanceof Error ? err.message : "Não foi possível enviar o comprovante.",
      );
    } finally {
      setDocEnviando(false);
    }
  };

  const abrirOnboardingMeta = () => {
    const url = metaOnboardingUrl.trim() || META_ONBOARDING_URL_PADRAO;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const carregarStatusMeta = async () => {
    setMetaCarregando(true);
    setMetaFeedback("");
    try {
      const token = await obterAccessToken();
      if (!token) {
        setMetaFeedback("Sessão expirada. Faça login novamente.");
        return;
      }

      const resp = await fetch("/api/meta/integration/status", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (resp.status === 401) {
        setMetaFeedback("Sessão inválida. Faça login novamente.");
        return;
      }
      if (!resp.ok) {
        const payload = (await resp.json().catch(() => ({}))) as { message?: string };
        setMetaFeedback(payload.message || "Não foi possível carregar status da integração Meta.");
        return;
      }

      const data = (await resp.json()) as MetaStatusResponse;
      setMetaConectado(data.connected === true);
      setMetaTokenPreview(data.integration?.token_preview || "");

      const cfg = (data.integration?.configuration || {}) as Record<string, unknown>;
      setMetaOnboardingUrl(String(cfg.onboarding_url || metaOnboardingUrl || META_ONBOARDING_URL_PADRAO));
      setMetaConfigId(String(cfg.config_id || metaConfigId || META_CONFIG_ID_PADRAO));
      setMetaApiVersion(String(cfg.api_version || metaApiVersion || META_API_VERSION_PADRAO));
      setMetaBusinessId(String(cfg.business_id || ""));
      setMetaSystemUserId(String(cfg.system_user_id || ""));
      setMetaWabaId(String(cfg.waba_id || ""));
      setMetaPhoneNumberId(String(cfg.phone_number_id || ""));
    } catch {
      setMetaFeedback("Falha de comunicação ao carregar integração Meta.");
    } finally {
      setMetaCarregando(false);
    }
  };

  const testarCadastroMeta = async () => {
    if (!isAdmin) return;

    setMetaTestando(true);
    setMetaFeedback("");
    try {
      const token = await obterAccessToken();
      if (!token) {
        setMetaFeedback("Sessão expirada. Faça login novamente.");
        return;
      }

      const resp = await fetch("/api/meta/integration/testar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accessToken: metaAccessToken.trim(),
          phoneNumberId: metaPhoneNumberId.trim(),
          apiVersion: metaApiVersion.trim() || META_API_VERSION_PADRAO,
        }),
      });

      const payload = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        data?: Record<string, unknown>;
        details?: string;
      };

      if (!resp.ok || payload.ok === false) {
        setMetaFeedback(payload.message || "Falha no teste da integração Meta.");
        return;
      }

      const nome = String(payload.data?.verified_name || "");
      const numero = String(payload.data?.display_phone_number || "");
      setMetaFeedback(
        `Conexão Meta validada com sucesso${nome ? ` (${nome})` : ""}${numero ? ` - ${numero}` : ""}.`,
      );
    } catch {
      setMetaFeedback("Erro ao testar integração Meta.");
    } finally {
      setMetaTestando(false);
    }
  };

  const salvarCadastroMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!metaAccessToken.trim()) {
      setMetaFeedback("Informe o Access Token da Meta para salvar.");
      return;
    }
    if (!metaPhoneNumberId.trim()) {
      setMetaFeedback("Informe o Phone Number ID para salvar.");
      return;
    }

    setMetaSalvando(true);
    setMetaFeedback("");
    try {
      const token = await obterAccessToken();
      if (!token) {
        setMetaFeedback("Sessão expirada. Faça login novamente.");
        return;
      }

      const resp = await fetch("/api/meta/integration/salvar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accessToken: metaAccessToken.trim(),
          phoneNumberId: metaPhoneNumberId.trim(),
          wabaId: metaWabaId.trim(),
          systemUserId: metaSystemUserId.trim(),
          businessId: metaBusinessId.trim(),
          configId: metaConfigId.trim(),
          onboardingUrl: metaOnboardingUrl.trim(),
          apiVersion: metaApiVersion.trim() || META_API_VERSION_PADRAO,
        }),
      });

      const payload = (await resp.json().catch(() => ({}))) as { message?: string };

      if (!resp.ok) {
        setMetaFeedback(payload.message || "Não foi possível salvar integração Meta.");
        return;
      }

      setMetaConectado(true);
      setMetaAccessToken("");
      setMetaFeedback(payload.message || "Cadastro Meta salvo com sucesso.");
      await carregarStatusMeta();
    } catch {
      setMetaFeedback("Erro ao salvar integração Meta.");
    } finally {
      setMetaSalvando(false);
    }
  };

  const copiarPromptPastor = async () => {
    await navigator.clipboard.writeText(PASTOR_CHATBOT_PROMPT);
    setPromptCopiado(true);
    setTimeout(() => setPromptCopiado(false), 1500);
  };

  const mensagensPersonalizadasPastor = useMemo(
    () => montarMensagensPersonalizadasPastor(previewNome, previewLocalidade),
    [previewLocalidade, previewNome],
  );
  const mensagemConfirmacaoPadrao = useMemo(
    () => gerarMensagemConfirmacaoPagamento({ nome: docNome, canal: comprovanteCanal }),
    [comprovanteCanal, docNome],
  );
  const podeInteragirNoChat = Boolean(conversaAtivaId || contatoAtivo);

  return (
    <main className="min-h-screen bg-zinc-950 p-3 md:p-6">
      <div className="mx-auto max-w-6xl space-y-3 md:space-y-4">
        <header className="rounded-xl bg-black/70 px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-zinc-100 md:text-2xl">
                App de Conversa
              </h1>
              <p className="text-sm text-zinc-400">
                Você está logado como {usuario?.nome} ({usuario?.email})
              </p>
            </div>
            <button
              onClick={() => void sair()}
              className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              Sair
            </button>
          </div>
        </header>

        {erro && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <p>{erro}</p>
            {erroEhSetupBanco(erro) && (
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-rose-800">
                <li>Acesse Supabase Dashboard do projeto.</li>
                <li>Abra SQL Editor e cole o conteúdo de `shared/supabase-setup-completo.sql`.</li>
                <li>Execute e confirme que não houve erro.</li>
                <li>Volte para o app e recarregue (`Ctrl+F5`).</li>
              </ol>
            )}
          </div>
        )}

        {carregandoTela ? (
          <div className="flex min-h-[50vh] items-center justify-center rounded-xl bg-black/70">
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4af37]/30 border-t-slate-700" />
              Carregando dados...
            </div>
          </div>
        ) : (
          <section className="grid gap-3 md:grid-cols-[320px_1fr] md:gap-4">
            <aside className="rounded-xl bg-black/70 p-3 shadow-sm md:p-4">
              <div className="mb-4 grid grid-cols-4 gap-2">
                <button
                  onClick={() => setAbaLateral("usuarios")}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    abaLateral === "usuarios"
                      ? "bg-[#d4af37] text-black"
                      : "bg-zinc-950 text-zinc-300"
                  }`}
                >
                  Usuários ativos
                </button>
                <button
                  onClick={() => setAbaLateral("conversas")}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    abaLateral === "conversas"
                      ? "bg-[#d4af37] text-black"
                      : "bg-zinc-950 text-zinc-300"
                  }`}
                >
                  Conversas
                </button>
                <button
                  onClick={() => setAbaLateral("docs")}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    abaLateral === "docs"
                      ? "bg-[#d4af37] text-black"
                      : "bg-zinc-950 text-zinc-300"
                  }`}
                >
                  {carregandoPermissaoAdmin
                    ? "Carregando..."
                    : isAdmin
                      ? "Materiais"
                      : "Comprovante"}
                </button>
                <button
                  onClick={() => setAbaLateral("meta")}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    abaLateral === "meta"
                      ? "bg-[#d4af37] text-black"
                      : "bg-zinc-950 text-zinc-300"
                  }`}
                >
                  Meta
                </button>
              </div>

              {abaLateral === "usuarios" && (
                <div className="space-y-2">
                  <p className="px-1 text-xs font-medium text-zinc-500">
                    {quantidadeOnline} online de {usuarios.length} usuários
                  </p>
                  {!usuarios.length && (
                    <p className="text-sm text-zinc-500">
                      Nenhum usuário encontrado.
                    </p>
                  )}
                  {usuariosOrdenados.map(item => {
                    const online = usuariosOnline.has(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => void iniciarConversa(item)}
                        className="w-full rounded-lg border border-[#d4af37]/20 px-3 py-2 text-left hover:border-[#d4af37]/40 hover:bg-[#d4af37]/10"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-zinc-200">
                            {item.nome}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              online
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-zinc-950 text-zinc-500"
                            }`}
                          >
                            {online ? "Online" : "Offline"}
                          </span>
                        </div>
                        <p className="truncate text-xs text-zinc-500">{item.email}</p>
                      </button>
                    );
                  })}
                </div>
              )}

              {abaLateral === "conversas" && (
                <div className="space-y-2">
                  {!conversasOrdenadas.length && (
                    <p className="text-sm text-zinc-500">
                      Você ainda não possui conversas.
                    </p>
                  )}
                  {conversasOrdenadas.map(conversa => (
                    <button
                      key={conversa.id}
                      onClick={() => void abrirConversa(conversa)}
                      className={`w-full rounded-lg border px-3 py-2 text-left ${
                        conversaAtivaId === conversa.id
                          ? "border-[#d4af37]/40 bg-[#d4af37]/10"
                          : "border-[#d4af37]/20 hover:border-[#d4af37]/40 hover:bg-[#d4af37]/10"
                      }`}
                    >
                      <p className="truncate font-medium text-zinc-200">
                        {conversa.participante?.nome ?? "Participante"}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {conversa.ultimaMensagem}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-600">
                        {formatarDataHora(conversa.atualizadoEm)}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {abaLateral === "docs" && isAdmin && (
                <div className="space-y-4">
                  <form onSubmit={enviarDocsParaWebhook} className="space-y-3">
                    <p className="text-sm text-zinc-400">
                      Área do administrador: envie materiais do produto comprado (PDF, mídia e
                      links de acesso) para o cliente.
                    </p>
                    <input
                      type="text"
                      value={docNome}
                      onChange={e => setDocNome(e.target.value)}
                      placeholder="Nome do cliente"
                      className="w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 caret-slate-900 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                      required
                    />
                    <input
                      type="email"
                      value={docEmail}
                      onChange={e => setDocEmail(e.target.value)}
                      placeholder="E-mail do cliente"
                      className="w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 caret-slate-900 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                      required
                    />
                    <input
                      type="tel"
                      value={docTelefone}
                      onChange={e => setDocTelefone(e.target.value)}
                      placeholder="WhatsApp do cliente"
                      className="w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 caret-slate-900 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                      required
                    />
                    <input
                      type="url"
                      value={docLinkAcesso}
                      onChange={e => setDocLinkAcesso(e.target.value)}
                      placeholder="Link de acesso ao produto (opcional)"
                      className="w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 caret-slate-900 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                    />
                    <textarea
                      value={docObservacoes}
                      onChange={e => setDocObservacoes(e.target.value)}
                      placeholder="Observações (ex.: curso liberado, prazo, instruções de acesso)"
                      className="min-h-20 w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 caret-slate-900 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                    />
                    <input
                      type="file"
                      accept="application/pdf,image/*,video/*,audio/*,.zip,.rar,.doc,.docx"
                      onChange={e => setDocArquivo(e.target.files?.[0] ?? null)}
                      className="w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                    />
                    {contatoAtivo && (
                      <p className="text-xs text-zinc-500">
                        Cliente vinculado na conversa: {contatoAtivo.nome}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={docEnviando}
                      className="w-full rounded-md bg-[#d4af37] px-4 py-2 text-sm font-semibold text-black hover:bg-[#c6a230] disabled:opacity-60"
                    >
                      {docEnviando ? "Enviando..." : "Enviar materiais e acesso"}
                    </button>
                    {docFeedback && (
                      <div className="rounded-md bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
                        {docFeedback}
                      </div>
                    )}
                  </form>

                  <div className="rounded-lg border border-[#d4af37]/20 bg-zinc-900 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-zinc-300">
                        Prompt do chatbot do pastor
                      </h3>
                      <button
                        type="button"
                        onClick={() => void copiarPromptPastor()}
                        className="inline-flex items-center gap-1 rounded-md border border-[#d4af37]/30 bg-black/70 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-950"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {promptCopiado ? "Copiado!" : "Copiar prompt"}
                      </button>
                    </div>

                    <textarea
                      readOnly
                      value={PASTOR_CHATBOT_PROMPT}
                      className="min-h-44 w-full rounded-md border border-[#d4af37]/30 bg-black/70 p-2 text-xs text-zinc-300"
                    />

                    <div className="mt-3 grid gap-2">
                      <p className="text-xs font-semibold text-zinc-400">
                        Pré-visualização com variáveis
                      </p>
                      <input
                        type="text"
                        value={previewNome}
                        onChange={e => setPreviewNome(e.target.value)}
                        placeholder="Nome para teste"
                        className="w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 caret-slate-900 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                      />
                      <input
                        type="text"
                        value={previewLocalidade}
                        onChange={e => setPreviewLocalidade(e.target.value)}
                        placeholder="Localidade para teste"
                        className="w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 caret-slate-900 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                      />
                      <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border border-[#d4af37]/20 bg-black/70 p-2">
                        {mensagensPersonalizadasPastor.map((mensagem, idx) => (
                          <p key={idx} className="text-xs text-zinc-300">
                            {mensagem}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {abaLateral === "meta" && (
                <form onSubmit={salvarCadastroMeta} className="space-y-3">
                  {!isAdmin && !carregandoPermissaoAdmin && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Esta área é exclusiva para administradores. Peça acesso de administrador para concluir o cadastro Meta.
                    </div>
                  )}
                  <p className="text-sm text-zinc-400">
                    Cadastro do dono da plataforma com a conta Meta/WhatsApp Business.
                    Conclua o onboarding incorporado e salve os dados abaixo.
                  </p>

                  <button
                    type="button"
                    onClick={abrirOnboardingMeta}
                    className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    disabled={!isAdmin}
                  >
                    Abrir cadastro incorporado da Meta
                  </button>

                  <input
                    type="url"
                    value={metaOnboardingUrl}
                    onChange={e => setMetaOnboardingUrl(e.target.value)}
                    placeholder="URL do cadastro incorporado (Embedded Signup)"
                    className="w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                    required
                    disabled={!isAdmin}
                  />

                  <input
                    type="text"
                    value={metaConfigId}
                    onChange={e => setMetaConfigId(e.target.value)}
                    placeholder="Config ID da Meta"
                    className="w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                    disabled={!isAdmin}
                  />

                  <input
                    type="text"
                    value={metaBusinessId}
                    onChange={e => setMetaBusinessId(e.target.value)}
                    placeholder="Business ID (opcional)"
                    className="w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                    disabled={!isAdmin}
                  />

                  <input
                    type="text"
                    value={metaSystemUserId}
                    onChange={e => setMetaSystemUserId(e.target.value)}
                    placeholder="System User ID (opcional)"
                    className="w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                    disabled={!isAdmin}
                  />

                  <input
                    type="text"
                    value={metaWabaId}
                    onChange={e => setMetaWabaId(e.target.value)}
                    placeholder="WABA ID (opcional)"
                    className="w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                    disabled={!isAdmin}
                  />

                  <input
                    type="text"
                    value={metaPhoneNumberId}
                    onChange={e => setMetaPhoneNumberId(e.target.value)}
                    placeholder="Phone Number ID (obrigatório)"
                    className="w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                    required
                    disabled={!isAdmin}
                  />

                  <input
                    type="text"
                    value={metaApiVersion}
                    onChange={e => setMetaApiVersion(e.target.value)}
                    placeholder="Versão da API (ex.: v22.0)"
                    className="w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                    disabled={!isAdmin}
                  />

                  <textarea
                    value={metaAccessToken}
                    onChange={e => setMetaAccessToken(e.target.value)}
                    placeholder="Access Token permanente (obrigatório para salvar)"
                    className="min-h-20 w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                    required
                    disabled={!isAdmin}
                  />

                  {metaTokenPreview && (
                    <p className="text-xs text-zinc-500">
                      Token atual salvo (mascarado): {metaTokenPreview}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void testarCadastroMeta()}
                      disabled={metaTestando || metaSalvando || !isAdmin}
                      className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-60"
                    >
                      {metaTestando ? "Testando..." : "Testar conexão"}
                    </button>
                    <button
                      type="submit"
                      disabled={metaSalvando || metaTestando || !isAdmin}
                      className="rounded-md bg-[#d4af37] px-4 py-2 text-sm font-semibold text-black hover:bg-[#c6a230] disabled:opacity-60"
                    >
                      {metaSalvando ? "Salvando..." : "Salvar cadastro Meta"}
                    </button>
                  </div>

                  <div className="rounded-md border border-[#d4af37]/20 bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
                    Status atual:{" "}
                    <span className={metaConectado ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                      {metaConectado ? "Conectado" : "Não conectado"}
                    </span>
                    {metaCarregando && <span className="ml-2">Atualizando...</span>}
                  </div>

                  {metaFeedback && (
                    <div className="rounded-md bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
                      {metaFeedback}
                    </div>
                  )}
                </form>
              )}

              {abaLateral === "docs" && !isAdmin && !carregandoPermissaoAdmin && (
                <form onSubmit={enviarComprovantePagamento} className="space-y-3">
                  <p className="text-sm text-zinc-400">
                    Envie seu comprovante de pagamento para validação. Após a confirmação,
                    você receberá o material por e-mail ou WhatsApp.
                  </p>
                  <input
                    type="text"
                    value={docNome}
                    onChange={e => setDocNome(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 caret-slate-900 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                    required
                  />
                  <input
                    type="email"
                    value={docEmail}
                    onChange={e => setDocEmail(e.target.value)}
                    placeholder="Seu e-mail"
                    className="w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 caret-slate-900 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                    required
                  />
                  <input
                    type="tel"
                    value={docTelefone}
                    onChange={e => setDocTelefone(e.target.value)}
                    placeholder="Seu WhatsApp"
                    className="w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 caret-slate-900 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                    required
                  />
                  <select
                    value={comprovanteCanal}
                    onChange={e => setComprovanteCanal(e.target.value as "email" | "whatsapp")}
                    className="w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                  >
                    <option value="email">Prefiro confirmação por e-mail</option>
                    <option value="whatsapp">Prefiro confirmação por WhatsApp</option>
                  </select>
                  <textarea
                    value={comprovanteMensagem}
                    onChange={e => setComprovanteMensagem(e.target.value)}
                    placeholder="Mensagem opcional (ex.: data do pagamento, observações)"
                    className="min-h-20 w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 caret-slate-900 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                  />
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                      Mensagem automática de confirmação
                    </p>
                    <p className="mt-1 text-xs text-emerald-800">{mensagemConfirmacaoPadrao}</p>
                  </div>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={e => setDocArquivo(e.target.files?.[0] ?? null)}
                    className="w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                    required
                  />
                  <button
                    type="submit"
                    disabled={docEnviando}
                    className="w-full rounded-md bg-[#d4af37] px-4 py-2 text-sm font-semibold text-black hover:bg-[#c6a230] disabled:opacity-60"
                  >
                    {docEnviando ? "Enviando..." : "Enviar comprovante"}
                  </button>
                  {docFeedback && (
                    <div className="rounded-md bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
                      {docFeedback}
                    </div>
                  )}
                </form>
              )}
            </aside>

            <section className="flex min-h-[60vh] flex-col rounded-xl bg-black/70 shadow-sm">
              <div className="border-b border-[#d4af37]/20 px-4 py-3">
                <p className="text-sm text-zinc-400">Conversa ativa</p>
                <h2 className="text-lg font-semibold text-zinc-100">
                  {contatoAtivo?.nome ?? "Selecione um usuário para conversar"}
                </h2>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
                {!mensagens.length && (
                  <p className="text-sm text-zinc-500">
                    Nenhuma mensagem ainda. Inicie a conversa.
                  </p>
                )}

                {mensagens.map(msg => {
                  const minhaMensagem = msg.sender_id === usuario?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${minhaMensagem ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm md:max-w-[70%] ${
                          minhaMensagem
                            ? "bg-[#d4af37] text-black"
                            : "bg-zinc-950 text-zinc-200"
                        }`}
                      >
                        <p>{msg.conteudo}</p>
                        <p
                          className={`mt-1 text-[11px] ${
                            minhaMensagem ? "text-black/80" : "text-zinc-500"
                          }`}
                        >
                          {formatarDataHora(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-[#d4af37]/20 p-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={novaMensagem}
                    onChange={e => setNovaMensagem(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void enviarMensagem();
                      }
                    }}
                    placeholder={
                      podeInteragirNoChat
                        ? "Digite sua mensagem..."
                        : "Selecione um usuário na aba \"Usuários ativos\""
                    }
                    className="w-full rounded-md border border-[#d4af37]/30 bg-black/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 caret-slate-900 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                    disabled={!podeInteragirNoChat || enviandoMensagem}
                  />
                  <button
                    onClick={() => void enviarMensagem()}
                    disabled={!podeInteragirNoChat || enviandoMensagem}
                    className="rounded-md bg-[#d4af37] px-4 py-2 text-black hover:bg-[#c6a230] disabled:opacity-60"
                  >
                    {enviandoMensagem ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </section>
          </section>
        )}
      </div>
    </main>
  );
}


