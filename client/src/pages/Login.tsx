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
  const titulo = modo === "entrar" ? "Acesse Sua Jornada" : "Crie Sua Conta";

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
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0a] p-4 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(212,175,55,0.15),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(212,175,55,0.08),transparent_40%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-[#d4af37]/35 bg-black/70 p-8 shadow-[0_16px_60px_rgba(0,0,0,0.45)] backdrop-blur">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.24em] text-[#d4af37]">
            Solilóquios
          </p>
          <h1 className="mb-2 text-center text-4xl font-bold text-[#f5e7bb]" style={{ fontFamily: "Playfair Display" }}>
            {titulo}
          </h1>
          <p className="mb-8 text-center text-sm text-zinc-300">
          {modo === "entrar" ? "Faça login na sua conta" : "Crie uma nova conta"}
          </p>

          {erro && (
            <div className="mb-6 rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {erro}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {modo === "registrar" && (
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-200">Nome</label>
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full rounded-lg border border-[#d4af37]/30 bg-zinc-950/80 px-4 py-2 text-zinc-100 placeholder:text-zinc-500 caret-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/45"
                  required
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-200">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-zinc-500" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full rounded-lg border border-[#d4af37]/30 bg-zinc-950/80 py-2 pl-10 pr-4 text-zinc-100 placeholder:text-zinc-500 caret-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/45"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-200">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-zinc-500" size={20} />
                <input
                  type="password"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-[#d4af37]/30 bg-zinc-950/80 py-2 pl-10 pr-4 text-zinc-100 placeholder:text-zinc-500 caret-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/45"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#d4af37] py-2 font-semibold text-black transition hover:bg-[#c6a230] disabled:opacity-50"
            >
              {carregando && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              )}
              {modo === "entrar" ? "Entrar" : "Registrar"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-zinc-300">
              {modo === "entrar" ? "Não tem uma conta?" : "Já tem uma conta?"}{" "}
              <button
                onClick={() => {
                  setModo(modo === "entrar" ? "registrar" : "entrar");
                  setErro("");
                }}
                className="font-semibold text-[#d4af37] hover:text-[#e8cc70]"
              >
                {modo === "entrar" ? "Registre-se" : "Faça login"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
