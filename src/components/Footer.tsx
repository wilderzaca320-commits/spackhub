import React from 'react';

interface FooterProps {
  onSelectTab: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab }) => {
  return (
    <footer className="bg-white/80 backdrop-blur-md border-t border-purple-100 text-slate-600 text-xs">
      {/* Top micro status bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 border-b border-purple-50 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono-code text-[11px]">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-700 to-indigo-600 flex items-center justify-center text-white font-space font-bold text-xs">
            S
          </div>
          <span className="font-space font-bold text-slate-900 tracking-tight text-sm">
            SPARKHUB
          </span>
          <span className="text-slate-400">ETHEREAL HYPERGALLERY // SYS_NODE</span>
        </div>

        <div className="flex items-center gap-4 text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
            SFX: AMBIENT LIVE
          </span>
          <span className="text-slate-300">•</span>
          <span>INDEX 0.84 // KÔBÔ</span>
        </div>
      </div>

      {/* Main navigation columns */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div>
          <div className="font-mono-code text-[10px] uppercase tracking-wider text-purple-900 font-bold mb-3">
            MODELOS IA
          </div>
          <ul className="space-y-2 text-slate-500">
            <li><button onClick={() => onSelectTab('explore')} className="hover:text-purple-700 transition">Midjourney v6.1</button></li>
            <li><button onClick={() => onSelectTab('explore')} className="hover:text-purple-700 transition">Flux.1 Schnell & Dev</button></li>
            <li><button onClick={() => onSelectTab('explore')} className="hover:text-purple-700 transition">Claude 3.5 Sonnet</button></li>
            <li><button onClick={() => onSelectTab('explore')} className="hover:text-purple-700 transition">ChatGPT / GPT-4o</button></li>
            <li><button onClick={() => onSelectTab('explore')} className="hover:text-purple-700 transition">Stable Diffusion XL</button></li>
          </ul>
        </div>

        <div>
          <div className="font-mono-code text-[10px] uppercase tracking-wider text-purple-900 font-bold mb-3">
            PLATAFORMA
          </div>
          <ul className="space-y-2 text-slate-500">
            <li><button onClick={() => onSelectTab('explore')} className="hover:text-purple-700 transition">Explorar Catálogo</button></li>
            <li><button onClick={() => onSelectTab('generator')} className="hover:text-purple-700 transition">Generador IA Sandbox</button></li>
            <li><button onClick={() => onSelectTab('sell')} className="hover:text-purple-700 transition">Vender mis Prompts (90%)</button></li>
            <li><button onClick={() => onSelectTab('hire')} className="hover:text-purple-700 transition">Directorio de Creadores</button></li>
            <li><button onClick={() => onSelectTab('enterprise')} className="hover:text-purple-700 transition">API & Webhooks</button></li>
          </ul>
        </div>

        <div>
          <div className="font-mono-code text-[10px] uppercase tracking-wider text-purple-900 font-bold mb-3">
            CALIDAD & AUDITORÍA
          </div>
          <ul className="space-y-2 text-slate-500">
            <li><button onClick={() => onSelectTab('admin-qa')} className="hover:text-purple-700 transition">Matriz de 3 Requisitos</button></li>
            <li><button onClick={() => onSelectTab('enterprise')} className="hover:text-purple-700 transition">Certificados de IP SHA-256</button></li>
            <li><button onClick={() => onSelectTab('library')} className="hover:text-purple-700 transition">Garantía de Devolución 48h</button></li>
            <li><button onClick={() => onSelectTab('admin-qa')} className="hover:text-purple-700 transition">Estado de Servidores GPU</button></li>
          </ul>
        </div>

        <div>
          <div className="font-mono-code text-[10px] uppercase tracking-wider text-purple-900 font-bold mb-3">
            LEGAL & EMPRESA
          </div>
          <ul className="space-y-2 text-slate-500">
            <li><button onClick={() => onSelectTab('pricing')} className="hover:text-purple-700 transition">Planes y Precios</button></li>
            <li><button onClick={() => onSelectTab('enterprise')} className="hover:text-purple-700 transition">Facturación B2B e IVA</button></li>
            <li><a href="#terminos" className="hover:text-purple-700 transition">Términos de Servicio</a></li>
            <li><a href="#privacidad" className="hover:text-purple-700 transition">Política de Privacidad</a></li>
          </ul>
        </div>
      </div>

      {/* Bottom copyright */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 border-t border-purple-50 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono-code text-[11px] text-slate-400">
        <div>
          © 2026 SPARKHUB KÔBÔ EDITION. TODOS LOS DERECHOS RESERVADOS. • SAN FRANCISCO // TOKYO
        </div>
        <div className="flex items-center gap-4">
          <a href="#seguridad" className="hover:text-purple-700">Seguridad</a>
          <a href="#cookies" className="hover:text-purple-700">Cookies</a>
          <a href="#contacto" className="hover:text-purple-700">Contacto</a>
        </div>
      </div>
    </footer>
  );
};
