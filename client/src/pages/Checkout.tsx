import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, Copy, Loader2, QrCode, ShieldCheck } from "lucide-react";

type CatalogProduct = {
  id: string;
  type: "collection" | "volume" | "single";
  title: string;
  subtitle: string;
  author: string;
  description: string;
  volume: number | null;
  price_cents: number;
};

type CatalogResponse = {
  brand_name: string;
  product_name: string;
  currency: string;
  products: CatalogProduct[];
};

type PaymentSession = {
  charge_id: string;
  qr_code_image: string | null;
  pix_copy_paste: string;
  status: "pending" | "paid" | "expired" | "canceled";
  expires_at: string;
  delivery_url: string | null;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDateTime(dateIso: string) {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function Checkout() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | "collection" | "volume" | "single">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [email, setEmail] = useState("");
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [checkout, setCheckout] = useState<PaymentSession | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastStatusMessage, setLastStatusMessage] = useState("Aguardando pagamento...");

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        setCatalogLoading(true);
        setCatalogError("");

        const response = await fetch("/api/catalog");
        const data = (await response.json()) as CatalogResponse & { message?: string };

        if (!response.ok) {
          throw new Error(data.message || "Não foi possível carregar o catálogo.");
        }

        setCatalog(data);
        if (!selectedProductId && data.products.length > 0) {
          const collection = data.products.find(item => item.type === "collection");
          setSelectedProductId(collection?.id || data.products[0].id);
        }
      } catch (error) {
        setCatalogError(error instanceof Error ? error.message : "Erro ao carregar catálogo.");
      } finally {
        setCatalogLoading(false);
      }
    };

    loadCatalog();
  }, [selectedProductId]);

  const filteredProducts = useMemo(() => {
    const products = catalog?.products || [];
    return products
      .filter(product => (selectedType === "all" ? true : product.type === selectedType))
      .filter(product => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        return (
          product.title.toLowerCase().includes(term) ||
          product.subtitle.toLowerCase().includes(term) ||
          product.author.toLowerCase().includes(term)
        );
      });
  }, [catalog?.products, searchTerm, selectedType]);

  const selectedProduct = useMemo(
    () => catalog?.products.find(item => item.id === selectedProductId) || null,
    [catalog?.products, selectedProductId],
  );

  const collectionVolumes = useMemo(
    () =>
      (catalog?.products || [])
        .filter(item => item.type === "volume" && item.volume)
        .sort((a, b) => Number(a.volume) - Number(b.volume)),
    [catalog?.products],
  );

  useEffect(() => {
    if (!checkout?.charge_id || checkout.status !== "pending") return;

    let cancelled = false;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/payment-status?charge_id=${encodeURIComponent(checkout.charge_id)}`,
        );
        const data = (await response.json()) as {
          status?: "pending" | "paid" | "expired" | "canceled";
          delivery_url?: string | null;
          message?: string;
        };
        if (cancelled || !response.ok) return;

        const nextStatus = data.status || "pending";
        setCheckout(prev =>
          prev
            ? {
                ...prev,
                status: nextStatus,
                delivery_url: data.delivery_url || prev.delivery_url,
              }
            : prev,
        );

        if (nextStatus === "paid") {
          setLastStatusMessage("Pagamento confirmado. Acesso liberado.");
        } else if (nextStatus === "expired") {
          setLastStatusMessage("PIX expirado. Gere um novo para concluir.");
        } else if (nextStatus === "canceled") {
          setLastStatusMessage("Pagamento cancelado. Gere um novo PIX.");
        } else {
          setLastStatusMessage("Aguardando pagamento...");
        }
      } catch {
        // silencioso: polling resiliente
      }
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [checkout?.charge_id, checkout?.status]);

  const handleCreatePayment = async () => {
    setErrorMessage("");
    if (!selectedProduct) {
      setErrorMessage("Selecione um produto para continuar.");
      return;
    }

    if (!emailRegex.test(email.trim())) {
      setErrorMessage("Informe um e-mail válido para gerar o PIX.");
      return;
    }

    try {
      setProcessing(true);
      setCopied(false);
      setLastStatusMessage("Aguardando pagamento...");

      const response = await fetch("/api/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          product_id: selectedProduct.id,
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        charge_id?: string;
        qr_code_image?: string | null;
        pix_copy_paste?: string;
        status?: "pending" | "paid" | "expired" | "canceled";
        expires_at?: string;
      };

      if (!response.ok || !data.charge_id || !data.pix_copy_paste) {
        throw new Error(data.message || "Falha ao gerar cobrança PIX.");
      }

      setCheckout({
        charge_id: data.charge_id,
        qr_code_image: data.qr_code_image || null,
        pix_copy_paste: data.pix_copy_paste,
        status: data.status || "pending",
        expires_at: data.expires_at || new Date().toISOString(),
        delivery_url: null,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao criar pagamento.");
    } finally {
      setProcessing(false);
    }
  };

  const handleCopyPix = async () => {
    if (!checkout?.pix_copy_paste) return;
    try {
      await navigator.clipboard.writeText(checkout.pix_copy_paste);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const qrImageFallbackUrl = checkout?.pix_copy_paste
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(checkout.pix_copy_paste)}`
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.22),transparent_45%)]">
        <header className="container py-6 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-accent transition">
            <ArrowLeft size={16} />
            Voltar para Home
          </Link>
          <a
            href="https://www.bcb.gov.br/estabilidadefinanceira/pix"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-gray-400 hover:text-accent"
          >
            PIX oficial Banco Central
          </a>
        </header>

        <section className="container pb-8 pt-4">
          <p className="text-accent tracking-[0.2em] text-xs uppercase mb-3">Checkout direto via PIX</p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4" style={{ fontFamily: "Playfair Display" }}>
            Garanta Sua Coleção Completa
          </h1>
          <p className="text-lg text-gray-200 max-w-4xl">
            Os 10 volumes que transformam o monólogo confuso em poder, clareza e cura emocional.
            Você também pode comprar por volume ou por nome do livro, incluindo títulos de outros autores.
          </p>
        </section>
      </div>

      <section className="container py-10 grid lg:grid-cols-[1.5fr_1fr] gap-8">
        <div className="space-y-8">
          <div className="rounded-2xl border border-border bg-card/70 p-6">
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: "Playfair Display" }}>
              Como funciona
            </h2>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="rounded-xl border border-border p-4 bg-background/50">
                <p className="text-accent font-semibold mb-1">1. Informe seu e-mail</p>
                <p className="text-gray-300">E-mail obrigatório para liberar sua entrega automaticamente.</p>
              </div>
              <div className="rounded-xl border border-border p-4 bg-background/50">
                <p className="text-accent font-semibold mb-1">2. Pague via PIX</p>
                <p className="text-gray-300">QR Code e copia e cola disponíveis na hora, sem redirecionamento confuso.</p>
              </div>
              <div className="rounded-xl border border-border p-4 bg-background/50">
                <p className="text-accent font-semibold mb-1">3. Acesso imediato</p>
                <p className="text-gray-300">Pagamento confirmado, botão de download liberado na própria página.</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/70 p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
              <h2 className="text-2xl font-bold" style={{ fontFamily: "Playfair Display" }}>
                Escolha seu formato de compra
              </h2>
              <input
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Buscar por volume, título ou autor"
                className="w-full md:w-80 rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/60"
              />
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              {[
                { id: "all", label: "Todos" },
                { id: "collection", label: "Coleção completa" },
                { id: "volume", label: "Por volume" },
                { id: "single", label: "Por título/autor" },
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedType(item.id as "all" | "collection" | "volume" | "single")}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    selectedType === item.id
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-background text-gray-300 hover:border-accent hover:text-accent"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {catalogLoading ? (
              <div className="rounded-xl border border-border p-6 text-gray-300 text-sm">
                Carregando catálogo...
              </div>
            ) : catalogError ? (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300 text-sm">
                {catalogError}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredProducts.map(product => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setSelectedProductId(product.id)}
                    className={`text-left rounded-xl border p-4 transition ${
                      selectedProductId === product.id
                        ? "border-accent bg-accent/10"
                        : "border-border bg-background/50 hover:border-accent/50"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">
                      {product.type === "collection"
                        ? "Coleção"
                        : product.type === "volume"
                          ? "Volume individual"
                          : "Livro avulso"}
                    </p>
                    <h3 className="font-semibold mb-1">{product.title}</h3>
                    <p className="text-sm text-gray-400 mb-2">{product.subtitle}</p>
                    <p className="text-xs text-gray-500 mb-3">{product.author}</p>
                    <p className="text-accent font-semibold">{formatCurrency(product.price_cents)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card/70 p-6">
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: "Playfair Display" }}>
              Os 10 volumes da coleção
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {collectionVolumes.map(item => (
                <div key={item.id} className="rounded-lg border border-border bg-background/50 p-3">
                  <p className="text-accent text-sm font-semibold">
                    Vol. {String(item.volume || "").padStart(2, "0")}
                  </p>
                  <p className="font-medium">{item.title.replace(/^Vol\.\s\d+\s-\s/, "")}</p>
                  <p className="text-xs text-gray-400">{item.subtitle}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 h-fit space-y-4">
          <div className="rounded-2xl border border-accent/40 bg-card p-6">
            <p className="text-xs uppercase tracking-widest text-accent mb-2">Oferta principal</p>
            <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "Playfair Display" }}>
              {selectedProduct?.title || "Selecione um produto"}
            </h2>
            <p className="text-sm text-gray-300 mb-4">{selectedProduct?.description || "--"}</p>
            <div className="text-3xl font-bold text-accent mb-4">
              {selectedProduct ? formatCurrency(selectedProduct.price_cents) : "--"}
            </div>
            <ul className="space-y-2 text-sm text-gray-300 mb-5">
              <li className="flex gap-2">
                <CheckCircle2 className="text-accent mt-0.5" size={16} />
                Acesso imediato após confirmação
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="text-accent mt-0.5" size={16} />
                Pagamento via PIX com confirmação automática
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="text-accent mt-0.5" size={16} />
                E-mail obrigatório para liberar entrega segura
              </li>
            </ul>

            <label className="text-sm text-gray-300 block mb-2">Seu e-mail</label>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="voce@exemplo.com"
              className="w-full rounded-lg bg-background border border-border px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/60 mb-3"
            />

            <button
              type="button"
              onClick={handleCreatePayment}
              disabled={processing || !selectedProduct}
              className="w-full rounded-lg bg-accent text-accent-foreground px-4 py-3 font-semibold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} />
                  Gerando PIX...
                </span>
              ) : (
                "Gerar PIX e Comprar"
              )}
            </button>

            {errorMessage && (
              <p className="text-sm text-red-300 mt-3">{errorMessage}</p>
            )}

            <p className="text-xs text-gray-400 mt-3">
              Pagamento via PIX. Confirmação automática e liberação sem login.
            </p>
          </div>

          {checkout && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-sm text-gray-300 mb-3">
                Seu e-mail: <span className="text-accent">{email.trim().toLowerCase()}</span>
              </p>

              <div className="rounded-xl border border-border bg-background/60 p-4 mb-4">
                {checkout.qr_code_image || qrImageFallbackUrl ? (
                  <img
                    src={checkout.qr_code_image || qrImageFallbackUrl || ""}
                    alt="QR Code PIX"
                    className="w-full max-w-[280px] mx-auto rounded-md"
                  />
                ) : (
                  <div className="h-52 rounded-lg border border-dashed border-border flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <QrCode className="mx-auto mb-2" size={28} />
                      QR Code indisponível. Use o copia e cola abaixo.
                    </div>
                  </div>
                )}
              </div>

              <label className="text-xs text-gray-400 block mb-1">Código PIX copia e cola</label>
              <textarea
                value={checkout.pix_copy_paste}
                readOnly
                className="w-full h-24 rounded-lg bg-background border border-border p-3 text-xs text-gray-200"
              />

              <button
                type="button"
                onClick={handleCopyPix}
                className="mt-3 w-full rounded-lg border border-accent text-accent px-4 py-2 text-sm font-medium hover:bg-accent/10"
              >
                <span className="inline-flex items-center gap-2">
                  <Copy size={14} />
                  {copied ? "Código copiado" : "Copiar código PIX"}
                </span>
              </button>

              <div className="mt-4 text-sm">
                <p
                  className={`font-medium ${
                    checkout.status === "paid"
                      ? "text-green-300"
                      : checkout.status === "pending"
                        ? "text-yellow-300"
                        : "text-red-300"
                  }`}
                >
                  {checkout.status === "paid"
                    ? "Pagamento confirmado."
                    : checkout.status === "pending"
                      ? "Aguardando pagamento..."
                      : checkout.status === "expired"
                        ? "PIX expirado."
                        : "Pagamento cancelado."}
                </p>
                <p className="text-xs text-gray-400 mt-1">{lastStatusMessage}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Expira em: {formatDateTime(checkout.expires_at)}
                </p>
              </div>

              {checkout.status === "paid" && (
                <a
                  href={checkout.delivery_url || "https://drive.google.com/"}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 block text-center rounded-lg bg-accent text-accent-foreground px-4 py-3 font-semibold hover:bg-accent/90"
                >
                  Baixar PDF ou Colecao
                </a>
              )}

              {checkout.status !== "pending" && (
                <button
                  type="button"
                  onClick={() => {
                    setCheckout(null);
                    setLastStatusMessage("Aguardando pagamento...");
                  }}
                  className="mt-3 w-full rounded-lg border border-border px-4 py-2 text-sm text-gray-300 hover:border-accent hover:text-accent"
                >
                  Gerar novo PIX
                </button>
              )}
            </div>
          )}
        </aside>
      </section>

      <section className="container pb-16">
        <div className="rounded-2xl border border-border bg-card/60 p-6">
          <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: "Playfair Display" }}>
            Perguntas frequentes
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
            <div><p className="font-semibold text-accent mb-1">Quando recebo acesso?</p><p>Assim que o pagamento for confirmado automaticamente.</p></div>
            <div><p className="font-semibold text-accent mb-1">Preciso criar conta?</p><p>Não. Compra direta, sem login e sem cadastro.</p></div>
            <div><p className="font-semibold text-accent mb-1">Posso comprar só um volume?</p><p>Sim. Selecione o volume individual antes de gerar o PIX.</p></div>
            <div><p className="font-semibold text-accent mb-1">Posso comprar por título ou autor?</p><p>Sim. Use a busca por nome para localizar rapidamente.</p></div>
            <div><p className="font-semibold text-accent mb-1">Onde recebo o link?</p><p>O botão de download aparece na mesma página após o pagamento.</p></div>
            <div><p className="font-semibold text-accent mb-1">O e-mail é obrigatório?</p><p>Sim, para validação de entrega e suporte da compra.</p></div>
            <div><p className="font-semibold text-accent mb-1">Tem suporte?</p><p>Sim, suporte por e-mail em horário comercial.</p></div>
            <div><p className="font-semibold text-accent mb-1">Como funciona o PIX oficial?</p><p>Seguimos o padrão oficial de pagamento instantâneo do Banco Central.</p></div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-card/80">
        <div className="container py-8 text-sm text-gray-400 space-y-2">
          <p className="text-accent font-semibold">Desenvolvido por</p>
          <p>© Automações Comerciais Integradas! 2026 ⚙️ Todos os direitos reservados.</p>
          <p>
            <a href="mailto:contato@automacoescomerciais.com.br" className="hover:text-accent transition">
              contato@automacoescomerciais.com.br
            </a>
          </p>
          <p>
            Francisco Queiroz 📱 WhatsApp:{" "}
            <a
              href="https://wa.me/558894227586"
              target="_blank"
              rel="noreferrer"
              className="hover:text-accent transition"
            >
              https://wa.me/558894227586
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
