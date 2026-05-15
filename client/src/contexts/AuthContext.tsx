import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface Usuario {
  id: string;
  email: string;
  nome: string;
}

interface AuthContextType {
  usuario: Usuario | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  registrar: (email: string, nome: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function traduzirErroAuth(mensagem: string) {
  const msg = mensagem.toLowerCase();

  if (msg.includes("invalid api key")) {
    return "Chave do Supabase inválida. Verifique VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env.";
  }
  if (msg.includes("email not confirmed")) {
    return "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.";
  }
  if (msg.includes("invalid login credentials")) {
    return "E-mail ou senha inválidos.";
  }
  if (msg.includes("user already registered")) {
    return "Este e-mail já está cadastrado. Faça login para continuar.";
  }
  if (msg.includes("password")) {
    return "Senha inválida. Use uma senha mais forte.";
  }

  return mensagem;
}

function mapearUsuario(user: User | null): Usuario | null {
  if (!user || !user.email) return null;

  const nomeMetadata = user.user_metadata?.nome || user.user_metadata?.name;
  return {
    id: user.id,
    email: user.email,
    nome: typeof nomeMetadata === "string" && nomeMetadata.trim()
      ? nomeMetadata
      : user.email.split("@")[0],
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    const carregarSessao = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        if (ativo) setUsuario(null);
      } else if (ativo) {
        setUsuario(mapearUsuario(data.user));
      }

      if (ativo) setCarregando(false);
    };

    carregarSessao();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuario(mapearUsuario(session?.user ?? null));
      setCarregando(false);
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  const entrar = async (email: string, senha: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      throw new Error(traduzirErroAuth(error.message));
    }

    setUsuario(mapearUsuario(data.user));
  };

  const registrar = async (email: string, nome: string, senha: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome },
      },
    });

    if (error) {
      const mensagem = error.message.toLowerCase();
      if (mensagem.includes("user already registered")) {
        const tentativaLogin = await supabase.auth.signInWithPassword({
          email,
          password: senha,
        });

        if (tentativaLogin.error) {
          throw new Error(
            "Este e-mail já está cadastrado. Clique em \"Faça login\" e entre com sua senha.",
          );
        }

        setUsuario(mapearUsuario(tentativaLogin.data.user));
        return;
      }

      throw new Error(traduzirErroAuth(error.message));
    }

    setUsuario(mapearUsuario(data.user));
  };

  const sair = async () => {
    await supabase.auth.signOut();
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, carregando, entrar, registrar, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
