import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Star } from "lucide-react";
import { useEffect, useState } from "react";
import NewsletterForm from "@/components/NewsletterForm";

/**
 * Landing Page: Solilóquios para a Alma
 * Design: Minimalismo Cinematográfico com Foco Narrativo
 * Paleta: Preto profundo (#0a0a0a) + Ouro (#d4af37) + Branco (#ffffff)
 * Tipografia: Playfair Display (títulos) + Inter (corpo)
 */

export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const books = [
    { number: 1, title: "O Sussurro da Alma", subtitle: "Despertando Seu Diálogo Interior" },
    { number: 2, title: "Mente Aliada", subtitle: "Transformando o Diálogo Interno que Sabota" },
    { number: 3, title: "A Arte da Escuta", subtitle: "Solilóquio e Inteligência Emocional" },
    { number: 4, title: "Cura Interior", subtitle: "Solilóquios para a Paz da Alma" },
    { number: 5, title: "O Poder da Pausa", subtitle: "Solilóquio para uma Vida com Propósito" },
    { number: 6, title: "Hábitos da Mente", subtitle: "Solilóquios para o Sucesso Duradouro" },
    { number: 7, title: "Conexão Essencial", subtitle: "Solilóquio e o Impacto das Redes Sociais" },
    { number: 8, title: "A Voz do Criador", subtitle: "Solilóquio e a Expressão Criativa" },
    { number: 9, title: "Resiliência Interior", subtitle: "Solilóquios para Superar Desafios" },
    { number: 10, title: "O Legado do Silêncio", subtitle: "Solilóquio e a Sabedoria Ancestral" },
  ];

  const benefits = [
    { icon: "🧠", title: "Clareza Mental", description: "Transforme o ruído interno em sabedoria prática" },
    { icon: "💎", title: "Autoconhecimento", description: "Descubra as verdades escondidas dentro de você" },
    { icon: "🔥", title: "Resiliência", description: "Construa uma força inabalável para enfrentar desafios" },
    { icon: "✨", title: "Propósito", description: "Encontre o significado real da sua jornada" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          isScrolled ? "bg-background/95 backdrop-blur border-b border-border" : "bg-transparent"
        }`}
      >
        <div className="container flex items-center justify-between h-16">
          <div className="text-2xl font-bold" style={{ fontFamily: "Playfair Display" }}>
            <span className="text-accent">Solilóquios</span>
          </div>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
            Garantir Acesso
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('https://d2xsxph8kpxj0f.cloudfront.net/310519663079504772/XKA39DEtKWhMNu9q56qiGT/hero_background-3ChqDpwMSZypxgrA5MGGZC.webp')",
            backgroundAttachment: "fixed",
          }}
        >
          <div className="absolute inset-0 bg-black/60"></div>
        </div>

        <div className="relative z-10 container max-w-4xl text-center">
          <h1
            className="text-6xl md:text-7xl font-bold mb-6 leading-tight"
            style={{ fontFamily: "Playfair Display" }}
          >
            Descubra a Voz que Fala <span className="text-accent">Só com Você</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Uma coleção de 10 livros que transformam o monólogo confuso em uma ferramenta de poder, clareza e cura emocional.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-8"
            >
              Garantir Minha Coleção <ArrowRight className="ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-accent text-accent hover:bg-accent/10 text-lg px-8"
            >
              Saber Mais
            </Button>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10 animate-bounce">
          <div className="w-6 h-10 border-2 border-accent rounded-full flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-accent rounded-full animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-1 bg-gradient-to-r from-transparent via-accent to-transparent"></div>

      {/* Problem Section */}
      <section className="py-20 bg-secondary/30">
        <div className="container max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2
                className="text-5xl font-bold mb-6 text-accent"
                style={{ fontFamily: "Playfair Display" }}
              >
                O Problema do Improviso
              </h2>
              <p className="text-lg text-gray-300 mb-4">
                Vivemos no automático. Correndo atrás de respostas externas, enquanto o nosso maior conselheiro — o nosso diálogo interno — está em silêncio.
              </p>
              <p className="text-lg text-gray-300 mb-6">
                Sem um solilóquio consciente, a vida vira um improviso constante. Decisões baseadas no medo, relacionamentos superficiais, e uma sensação permanente de estar perdido.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Check className="text-accent mt-1 flex-shrink-0" />
                  <span>Autossabotagem constante</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="text-accent mt-1 flex-shrink-0" />
                  <span>Ansiedade e indecisão</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="text-accent mt-1 flex-shrink-0" />
                  <span>Falta de propósito</span>
                </div>
              </div>
            </div>
            <div className="relative h-96 rounded-lg overflow-hidden">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663079504772/XKA39DEtKWhMNu9q56qiGT/hero_background-3ChqDpwMSZypxgrA5MGGZC.webp"
                alt="O Problema"
                className="w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-1 bg-gradient-to-r from-transparent via-accent to-transparent"></div>

      {/* Solution Section */}
      <section className="py-20">
        <div className="container max-w-4xl">
          <h2
            className="text-5xl font-bold mb-12 text-center text-accent"
            style={{ fontFamily: "Playfair Display" }}
          >
            A Solução: Solilóquios para a Alma
          </h2>

          <div className="grid md:grid-cols-2 gap-12 items-center mb-12">
            <div className="relative h-96 rounded-lg overflow-hidden order-2 md:order-1">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663079504772/XKA39DEtKWhMNu9q56qiGT/books_collection_visual-9SfL24hpFWHLXrpU5GuwKw.webp"
                alt="Coleção de Livros"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="order-1 md:order-2">
              <p className="text-lg text-gray-300 mb-6">
                Uma coleção de 10 volumes desenhados para transformar o seu monólogo confuso em uma ferramenta de poder e clareza.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, idx) => (
                  <div key={idx} className="flex gap-4">
                    <span className="text-3xl">{benefit.icon}</span>
                    <div>
                      <h3 className="font-bold text-accent mb-1">{benefit.title}</h3>
                      <p className="text-gray-400">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-1 bg-gradient-to-r from-transparent via-accent to-transparent"></div>

      {/* Books Collection */}
      <section className="py-20 bg-secondary/30">
        <div className="container">
          <h2
            className="text-5xl font-bold mb-12 text-center text-accent"
            style={{ fontFamily: "Playfair Display" }}
          >
            Os 10 Volumes da Coleção
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            {books.map((book) => (
              <div
                key={book.number}
                className="bg-card border border-border rounded-lg p-6 hover:border-accent transition-all duration-300 hover:shadow-lg hover:shadow-accent/20"
              >
                <div className="text-4xl font-bold text-accent mb-3" style={{ fontFamily: "Playfair Display" }}>
                  Vol. {book.number}
                </div>
                <h3 className="font-bold text-lg mb-2">{book.title}</h3>
                <p className="text-sm text-gray-400">{book.subtitle}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-1 bg-gradient-to-r from-transparent via-accent to-transparent"></div>

      {/* About Author */}
      <section className="py-20">
        <div className="container max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="relative h-96 rounded-lg overflow-hidden">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663079504772/XKA39DEtKWhMNu9q56qiGT/author_portrait-GSkGgKA7Y6xm4Ngc4TVory.webp"
                alt="Antonio Bandeira"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h2
                className="text-5xl font-bold mb-6 text-accent"
                style={{ fontFamily: "Playfair Display" }}
              >
                Antonio Bandeira
              </h2>
              <p className="text-lg text-gray-300 mb-4">
                Escritor contemporâneo especializado em saúde emocional e desenvolvimento humano. Integra ciência, sensibilidade e técnicas atualizadas para ajudar pessoas a encontrarem a si mesmas.
              </p>
              <p className="text-lg text-gray-300 mb-6">
                Suas obras são ricas em detalhes e monólogos que funcionam como um espelho, refletindo a busca incessante de si mesmo. Uma voz autêntica na literatura contemporânea brasileira.
              </p>
              <div className="flex gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="text-accent fill-accent" size={20} />
                ))}
              </div>
              <p className="text-sm text-gray-400 italic">
                "Uma obra fenomenal onde o autor faz a gente grudar os olhos em cada frase e capítulo."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-1 bg-gradient-to-r from-transparent via-accent to-transparent"></div>

      {/* CTA Section */}
      <section className="py-20 bg-secondary/30">
        <div className="container max-w-2xl text-center">
          <h2
            className="text-5xl font-bold mb-6 text-accent"
            style={{ fontFamily: "Playfair Display" }}
          >
            Transforme Seu Silêncio em Sabedoria
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Chegou a hora de parar de improvisar e começar a liderar a sua própria vida. Garanta o acesso à coleção completa agora mesmo.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-8"
            >
              Garantir Minha Coleção <ArrowRight className="ml-2" />
            </Button>
          </div>
          <p className="text-sm text-gray-400 mt-6">
            ✓ Acesso imediato aos 10 volumes | ✓ Suporte exclusivo | ✓ Garantia de satisfação
          </p>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="bg-secondary/50 py-16 border-t border-border">
        <div className="container max-w-2xl">
          <h2
            className="text-4xl font-bold mb-4 text-center text-accent"
            style={{ fontFamily: "Playfair Display" }}
          >
            Receba Insights Exclusivos
          </h2>
          <p className="text-center text-gray-300 mb-8">
            Inscreva-se na nossa newsletter e receba dicas, reflexões e ofertas exclusivas sobre o mundo do solilóquio e autoconhecimento.
          </p>
          <NewsletterForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-accent mb-4">Sobre</h3>
              <p className="text-sm text-gray-400">
                Solilóquios para a Alma é uma coleção dedicada ao autoconhecimento e transformação pessoal.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-accent mb-4">Links</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-accent transition">Home</a></li>
                <li><a href="#" className="hover:text-accent transition">Coleção</a></li>
                <li><a href="#" className="hover:text-accent transition">Autor</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-accent mb-4">Contato</h3>
              <p className="text-sm text-gray-400">
                <a href="mailto:jornalista0013093@gmail.com" className="hover:text-accent transition">
                  jornalista0013093@gmail.com
                </a>
              </p>
              <p className="text-sm text-gray-400 mt-2">
                <a href="tel:+554192062238" className="hover:text-accent transition">
                  (41) 92062-238
                </a>
              </p>
            </div>
            <div>
              <h3 className="font-bold text-accent mb-4">Redes Sociais</h3>
              <p className="text-sm text-gray-400">
                <a href="https://instagram.com/jornalista.escritor" className="hover:text-accent transition">
                  @jornalista.escritor
                </a>
              </p>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2026 Solilóquios para a Alma. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
