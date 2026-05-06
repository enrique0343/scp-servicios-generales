import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import type { Rol } from '../api/client';

interface NavItem {
  to: string;
  label: string;
  rolesPermitidos: Rol[];
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', rolesPermitidos: ['admin', 'jefatura', 'supervisor', 'lectura'] },
  { to: '/plantilla', label: 'Plantilla', rolesPermitidos: ['admin', 'jefatura', 'supervisor', 'lectura'] },
  { to: '/plan', label: 'Plan Mensual', rolesPermitidos: ['admin', 'jefatura', 'supervisor', 'lectura'] },
  { to: '/asistencia', label: 'Asistencia Diaria', rolesPermitidos: ['admin', 'jefatura', 'supervisor'] },
  { to: '/excepciones', label: 'Excepciones', rolesPermitidos: ['admin', 'jefatura', 'supervisor'] },
  { to: '/usuarios', label: 'Usuarios', rolesPermitidos: ['admin'] },
  { to: '/turnos', label: 'Turnos', rolesPermitidos: ['admin', 'jefatura'] },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, rol } = useAuth();

  const etiquetaRol: Record<Rol, string> = {
    admin: 'Administrador',
    jefatura: 'Jefatura',
    supervisor: 'Supervisor',
    lectura: 'Solo lectura',
  };

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-40 w-56 bg-primario text-white flex flex-col
        transform transition-transform duration-200 ease-in-out
        md:relative md:translate-x-0 md:flex md:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
    >
      {/* Logo / título */}
      <div className="px-5 py-6 border-b border-white/10 flex items-center justify-between">
        <div>
          <div className="text-xs text-white/50 uppercase tracking-widest mb-1">Avante</div>
          <div className="font-semibold text-sm leading-tight">Control de Personal</div>
          <div className="text-xs text-white/60 mt-0.5">Servicios Generales</div>
        </div>
        {/* Botón cerrar — solo móvil */}
        <button
          onClick={onClose}
          className="md:hidden p-1 rounded hover:bg-white/10 transition-colors"
          aria-label="Cerrar menú"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems
          .filter((item) => !rol || item.rolesPermitidos.includes(rol))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `block px-3 py-2.5 rounded text-sm transition-colors ${
                  isActive
                    ? 'bg-white/15 font-medium'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
      </nav>

      {/* Usuario */}
      {user && (
        <div className="px-5 py-4 border-t border-white/10 text-xs text-white/60">
          <div className="truncate">{user.email}</div>
          <div className="mt-0.5 text-white/40">{etiquetaRol[user.rol]}</div>
        </div>
      )}
    </aside>
  );
}
