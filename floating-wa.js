// Script de Injeção de Botão Whatsapp PREMIUM - Antigravity Agent
(function() {
    const waConfig = {
        phone: '5511999999999',
        message: 'Olá! Vim através da Landing Page Antigravity e gostaria de saber mais sobre a Consultoria de IA.',
        color: '#25D366'
    };

    // Remover botão antigo se existir
    const oldBtn = document.querySelector('.wa-float');
    if (oldBtn) oldBtn.remove();
    const oldStyle = document.querySelector('#wa-style');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'wa-style';
    style.innerHTML = `
        .wa-float {
            position: fixed;
            bottom: 40px;
            right: 40px;
            background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
            color: #FFF;
            border-radius: 50%;
            text-align: center;
            box-shadow: 0 10px 25px rgba(18, 140, 126, 0.4);
            z-index: 1000;
            width: 70px;
            height: 70px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            animation: wa-pulse 2s infinite;
        }

        .wa-float:hover {
            transform: scale(1.1) translateY(-5px);
            box-shadow: 0 15px 35px rgba(18, 140, 126, 0.6);
        }

        .wa-float svg {
            width: 35px;
            height: 35px;
            fill: white;
        }

        @keyframes wa-pulse {
            0% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.7); }
            70% { box-shadow: 0 0 0 20px rgba(37, 211, 102, 0); }
            100% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0); }
        }

        .wa-tooltip {
            position: absolute;
            right: 85px;
            background: white;
            color: #333;
            padding: 10px 20px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            opacity: 0;
            transform: translateX(10px);
            transition: 0.3s;
            pointer-events: none;
        }

        .wa-float:hover .wa-tooltip {
            opacity: 1;
            transform: translateX(0);
        }
    `;
    document.head.appendChild(style);

    const waLink = document.createElement('a');
    waLink.href = `https://wa.me/${waConfig.phone}?text=${encodeURIComponent(waConfig.message)}`;
    waLink.className = 'wa-float';
    waLink.target = '_blank';
    
    // SVG do WhatsApp
    waLink.innerHTML = `
        <div class="wa-tooltip">Fale com um Especialista</div>
        <svg viewBox="0 0 448 512">
            <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-5.5-2.8-23.2-8.5-44.2-27.1-16.4-14.6-27.4-32.7-30.6-38.2-3.2-5.6-.3-8.6 2.5-11.3 2.5-2.5 5.5-6.5 8.3-9.7 2.8-3.3 3.7-5.6 5.5-9.2 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
        </svg>
    `;
    
    document.body.appendChild(waLink);
    console.log('✨ WhatsApp Button Upgraded to PREMIUM Design');
})();
