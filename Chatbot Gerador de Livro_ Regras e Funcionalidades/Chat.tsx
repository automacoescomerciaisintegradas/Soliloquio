import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import axios from "axios";
import { Send, LogOut, MessageSquare, Users, FileText } from "lucide-react";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
}

interface Mensagem {
  id: string;
  conteudo: string;
  remetenteId: string;
  remetente: Usuario;
  criadoEm: string;
}

interface Conversa {
  id: string;
  nome?: string;
  participantes: Usuario[];
  ultimaMensagem?: Mensagem;
}

export default function Chat() {
  const { usuario, sair } = useAuth();
  const [, navigate] = useLocation();
  const [aba, setAba] = useState<"usuarios" | "conversas">("usuarios");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<Usuario | null>(null);
  const [conversaSelecionada, setConversaSelecionada] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!usuario) {
      navigate("/login");
      return;
    }
    carregarUsuarios();
    carregarConversas();
    const intervalo = setInterval(() => {
      carregarUsuarios();
      carregarConversas();
    }, 3000);
    return () => clearInterval(intervalo);
  }, [usuario]);

  useEffect(() => {
    scrollParaBaixo();
  }, [mensagens]);

  const scrollParaBaixo = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const carregarUsuarios = async () => {
    try {
      const response = await axios.get("/api/usuarios", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setUsuarios(response.data.usuarios.filter((u: Usuario) => u.id !== usuario?.id));
    } catch (erro) {
      console.error("Erro ao carregar usuários:", erro);
    }
  };

  const carregarConversas = async () => {
    try {
      const response = await axios.get("/api/conversas", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setConversas(response.data.conversas);
    } catch (erro) {
      console.error("Erro ao carregar conversas:", erro);
    }
  };

  const iniciarConversa = async (usuarioId: string) => {
    try {
      const response = await axios.post(
        "/api/conversas",
        { usuarioId },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      setConversaSelecionada(response.data.conversa);
      setUsuarioSelecionado(null);
      carregarMensagens(response.data.conversa.id);
      setAba("conversas");
    } catch (erro) {
      console.error("Erro ao iniciar conversa:", erro);
    }
  };

  const carregarMensagens = async (conversaId: string) => {
    try {
      const response = await axios.get(`/api/conversas/${conversaId}/mensagens`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setMensagens(response.data.mensagens);
    } catch (erro) {
      console.error("Erro ao carregar mensagens:", erro);
    }
  };

  const enviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaMensagem.trim() || !conversaSelecionada) return;

    try {
      setCarregando(true);
      const response = await axios.post(
        `/api/conversas/${conversaSelecionada.id}/mensagens`,
        { conteudo: novaMensagem },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      setMensagens([...mensagens, response.data.mensagem]);
      setNovaMensagem("");
    } catch (erro) {
      console.error("Erro ao enviar mensagem:", erro);
    } finally {
      setCarregando(false);
    }
  };

  const handleSair = () => {
    sair();
    navigate("/login");
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">App Conversa</h1>
            <p className="text-blue-100 text-sm">Bem-vindo, {usuario?.nome}</p>
          </div>
          <button
            onClick={handleSair}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg"
          >
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setAba("usuarios")}
              className={`flex-1 py-3 px-4 font-semibold flex items-center justify-center gap-2 ${
                aba === "usuarios"
                  ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Users size={20} />
              <span className="hidden sm:inline">Usuários</span>
            </button>
            <button
              onClick={() => setAba("conversas")}
              className={`flex-1 py-3 px-4 font-semibold flex items-center justify-center gap-2 ${
                aba === "conversas"
                  ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <MessageSquare size={20} />
              <span className="hidden sm:inline">Conversas</span>
            </button>
          </div>

          {/* Lista de Usuários */}
          {aba === "usuarios" && (
            <div className="flex-1 overflow-y-auto">
              {usuarios.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  Nenhum usuário disponível
                </div>
              ) : (
                usuarios.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setUsuarioSelecionado(u)}
                    className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition ${
                      usuarioSelecionado?.id === u.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold">
                        {u.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{u.nome}</p>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      </div>
                      {u.ativo && (
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Lista de Conversas */}
          {aba === "conversas" && (
            <div className="flex-1 overflow-y-auto">
              {conversas.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  Nenhuma conversa ainda
                </div>
              ) : (
                conversas.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setConversaSelecionada(c);
                      carregarMensagens(c.id);
                    }}
                    className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition ${
                      conversaSelecionada?.id === c.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold">
                        {c.participantes[0]?.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">
                          {c.participantes.map((p) => p.nome).join(", ")}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {c.ultimaMensagem?.conteudo || "Sem mensagens"}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="hidden md:flex flex-1 flex-col bg-white">
          {usuarioSelecionado ? (
            <>
              {/* Header do Chat */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold">
                    {usuarioSelecionado.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{usuarioSelecionado.nome}</p>
                    <p className="text-xs text-gray-500">{usuarioSelecionado.email}</p>
                  </div>
                  <button
                    onClick={() => iniciarConversa(usuarioSelecionado.id)}
                    className="ml-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                  >
                    Iniciar Conversa
                  </button>
                </div>
              </div>
              {/* Mensagem de Seleção */}
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-500">Clique em "Iniciar Conversa" para começar</p>
              </div>
            </>
          ) : conversaSelecionada ? (
            <>
              {/* Header do Chat */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold">
                    {conversaSelecionada.participantes[0]?.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      {conversaSelecionada.participantes.map((p) => p.nome).join(", ")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {mensagens.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.remetenteId === usuario?.id ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg ${
                        msg.remetenteId === usuario?.id
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      <p className="text-sm">{msg.conteudo}</p>
                      <p
                        className={`text-xs mt-1 ${
                          msg.remetenteId === usuario?.id
                            ? "text-blue-100"
                            : "text-gray-500"
                        }`}
                      >
                        {new Date(msg.criadoEm).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input de Mensagem */}
              <form
                onSubmit={enviarMensagem}
                className="p-4 border-t border-gray-200 bg-gray-50"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={novaMensagem}
                    onChange={(e) => setNovaMensagem(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={carregando}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-500">Selecione um usuário ou conversa para começar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
