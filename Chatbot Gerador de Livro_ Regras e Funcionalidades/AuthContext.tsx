import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

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
  sair: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    // Verificar se o usuário está logado
    const token = localStorage.getItem("token");
    if (token) {
      verificarToken();
    } else {
      setCarregando(false);
    }
  }, []);

  const verificarToken = async () => {
    try {
      const response = await axios.get("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setUsuario(response.data.usuario);
    } catch (erro) {
      localStorage.removeItem("token");
    } finally {
      setCarregando(false);
    }
  };

  const entrar = async (email: string, senha: string) => {
    try {
      const response = await axios.post("/api/auth/entrar", {
        email,
        senha,
      });
      localStorage.setItem("token", response.data.token);
      setUsuario(response.data.usuario);
    } catch (erro) {
      throw new Error("Falha ao entrar. Verifique suas credenciais.");
    }
  };

  const registrar = async (email: string, nome: string, senha: string) => {
    try {
      const response = await axios.post("/api/auth/registrar", {
        email,
        nome,
        senha,
      });
      localStorage.setItem("token", response.data.token);
      setUsuario(response.data.usuario);
    } catch (erro) {
      throw new Error("Falha ao registrar. Tente novamente.");
    }
  };

  const sair = () => {
    localStorage.removeItem("token");
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
