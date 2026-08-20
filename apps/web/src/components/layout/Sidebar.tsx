import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BedDouble,
  CalendarDays,
  Users,
  ClipboardList,
  Wrench,
  Receipt,
  Settings,
  BarChart3,
  FileText,
  Sparkles,
  Compass,
  ChevronLeft,
  ChevronRight,
  LogOut,
  SlidersHorizontal,
  MessageSquareText,
  Tag,
  ConciergeBell,
} from 'lucide-react';
import { HotelBranding } from '@/components/branding/HotelBranding';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/features/auth/useAuth';
import { useAuthStore } from '@/features/auth/auth.store';
import { useAiChatStore } from '@/features/ai-assistant/ai-chat.store';
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed';

// ─── Nav item definition ──────────────────────────────────────────────────────

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  roles?: string[];
}

// Section structure — partitioned inline, no change to routes/roles
interface NavSection {
  heading: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'PRINCIPAL',
    items: [
      { to: '/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
      { to: '/reservations', label: 'Reservas',   icon: CalendarDays },
      { to: '/guests',     label: 'Huéspedes',    icon: Users },
    ],
  },
  {
    heading: 'OPERACIÓN',
    items: [
      { to: '/front-desk',  label: 'Recepción',     icon: ConciergeBell },
      { to: '/housekeeping', label: 'Housekeeping', icon: ClipboardList },
      { to: '/rooms',        label: 'Habitaciones', icon: BedDouble },
      { to: '/room-types',   label: 'Tipos de hab.', icon: Wrench },
    ],
  },
  {
    heading: 'ADMINISTRACIÓN',
    items: [
      { to: '/pricing/rate-plans', label: 'Tarifas',     icon: Receipt,   roles: ['ADMIN', 'MANAGER'] },
      { to: '/pricing/seasons',    label: 'Temporadas',  icon: BarChart3, roles: ['ADMIN', 'MANAGER'] },
      { to: '/reportes',           label: 'Reportes',    icon: FileText,  roles: ['ADMIN', 'MANAGER'] },
      { to: '/reviews',            label: 'Reseñas',     icon: MessageSquareText },
      { to: '/offers',             label: 'Ofertas',     icon: Tag,                roles: ['ADMIN'] },
      { to: '/users',              label: 'Usuarios',       icon: Settings,           roles: ['ADMIN'] },
      { to: '/settings/hotel',    label: 'Configuración',  icon: SlidersHorizontal,  roles: ['ADMIN'] },
      { to: '/admin/concierge/venues', label: 'Concierge', icon: Compass,            roles: ['ADMIN'] },
    ],
  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

/**
 * Sidebar — left nav for the staff PMS.
 *
 * Features:
 * - Collapse toggle (240px ↔ 64px) persisted in localStorage via useSidebarCollapsed
 * - 200ms width transition for smooth collapse animation
 * - Terracotta active state with 2px left accent bar (before: pseudo-element)
 * - Partitioned nav sections: PRINCIPAL / OPERACIÓN / ADMINISTRACIÓN
 * - ThemeToggle mounted in footer (Phase 9 component)
 * - Role-filtered nav items
 */
export function Sidebar() {
  const role = useAuthStore((s) => s.user?.role ?? '');
  const { logout } = useAuth();
  const { collapsed, toggle } = useSidebarCollapsed();

  return (
    <aside
      className={`shrink-0 bg-warm-white border-r border-warm-line flex flex-col transition-[width] duration-200 ease-in-out overflow-hidden ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* ── Branding block ─────────────────────────────────────────────────── */}
      <div className="flex items-center px-4 py-4 border-b border-warm-line gap-2">
        {collapsed ? (
          /* Collapsed: show H mark only */
          <span className="w-7 h-7 rounded-lg bg-terracotta text-warm-white flex items-center justify-center font-display italic text-lg shrink-0">
            H
          </span>
        ) : (
          <HotelBranding />
        )}
      </div>

      {/* ── Collapse toggle ─────────────────────────────────────────────────── */}
      <button type="button"
        onClick={toggle}
        aria-label={collapsed ? 'Expandir barra lateral' : 'Plegar barra lateral'}
        className="w-full flex items-center justify-end px-2 py-1 text-ink-3 hover:text-ink-1 transition-colors"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* ── Nav sections ────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.roles || item.roles.includes(role),
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.heading}>
              {/* Section label — hidden when collapsed */}
              <p
                className={`text-xs uppercase tracking-widest text-ink-4 px-3 mt-4 mb-1 font-medium ${
                  collapsed ? 'hidden' : ''
                }`}
              >
                {section.heading}
              </p>

              <div className="flex flex-col gap-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                          isActive
                            ? 'bg-terracotta-tint text-terracotta-deep before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:bg-terracotta before:rounded-r'
                            : 'text-ink-2 hover:bg-warm-cream hover:text-ink-1'
                        }`
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span className={collapsed ? 'hidden' : 'block'}>
                        {item.label}
                      </span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── AI Assistant button ─────────────────────────────────────────────── */}
      <div className="px-2 border-t border-warm-line pt-2">
        <button type="button"
          onClick={() => useAiChatStore.getState().open()}
          title={collapsed ? 'Asistente IA' : undefined}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-ink-2 hover:bg-warm-cream hover:text-ink-1 transition-colors"
          aria-label="Abrir asistente IA"
        >
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          <span className={collapsed ? 'hidden' : 'block'}>Asistente IA</span>
        </button>
      </div>

      {/* ── Footer: ThemeToggle + Logout ────────────────────────────────────── */}
      <div className="border-t border-warm-line p-2 flex flex-col gap-1">
        {/* ThemeToggle from Phase 9 */}
        <div className="px-1">
          <ThemeToggle />
        </div>

        {/* Logout */}
        <button type="button"
          onClick={logout}
          title={collapsed ? 'Cerrar sesión' : undefined}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-ink-3 hover:text-ink-1 hover:bg-warm-cream transition-colors"
        >
          <LogOut size={16} className="shrink-0" aria-hidden />
          <span className={collapsed ? 'hidden' : 'block'}>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
