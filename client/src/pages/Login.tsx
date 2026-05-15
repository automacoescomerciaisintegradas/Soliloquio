import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Lock, Mail } from "lucide-react";

function obterDestinoSeguroDepoisDoLogin() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");

  if (!next) return "/app";
  if (!next.startsWith("/")) return "/app";
  if (next.startsWith("//")) return "/app";
  if (next.startsWith("/login")) return "/app";
  if (next.startsWith("/entrar")) return "/app";

  return next;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [modo, setModo] = useState<"entrar" | "registrar">("entrar");
  const [nome, setNome] = useState("");
  const { entrar, registrar, usuario, carregando: carregandoAuth } = useAuth();
  const [, navigate] = useLocation();
  const destinoDepoisDoLogin = useMemo(obterDestinoSeguroDepoisDoLogin, []);

  useEffect(() => {
    if (!carregandoAuth && usuario) {
      navigate(destinoDepoisDoLogin, { replace: true });
    }
  }, [carregandoAuth, destinoDepoisDoLogin, navigate, usuario]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    try {
      if (modo === "entrar") {
        await entrar(email, senha);
      } else {
        await registrar(email, nome, senha);
      }
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : "Ocorreu um erro inesperado.";
      if (modo === "registrar" && mensagem.toLowerCase().includes("já está cadastrado")) {
        setModo("entrar");
      }
      setErro(mensagem);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">App Conversa</h1>
        <p className="text-center text-gray-600 mb-8">
          {modo === "entrar" ? "Faça login na sua conta" : "Crie uma nova conta"}
        </p>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {modo === "registrar" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Seu nome completo"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-500 caret-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 placeholder:text-gray-500 caret-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 placeholder:text-gray-500 caret-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {carregando && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {modo === "entrar" ? "Entrar" : "Registrar"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            {modo === "entrar" ? "Não tem uma conta?" : "Já tem uma conta?"}{" "}
            <button
              onClick={() => {
                setModo(modo === "entrar" ? "registrar" : "entrar");
                setErro("");
              }}
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              {modo === "entrar" ? "Registre-se" : "Faça login"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
