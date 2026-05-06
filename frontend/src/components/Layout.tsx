import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="flex min-h-screen bg-white">
      {/* Backdrop móvil */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={close}
        />
      )}

      {/* Sidebar */}
      <Sidebar isOpen={open} onClose={close} />

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Cabecera móvil */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-primario text-white">
          <button
            onClick={() => setOpen(true)}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            aria-label="Abrir menú"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-sm">Control de Personal</span>
        </header>

        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
