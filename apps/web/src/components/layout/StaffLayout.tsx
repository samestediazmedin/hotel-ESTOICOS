import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ChatPanel } from '@/features/ai-assistant/ChatPanel';

/**
 * StaffLayout — wraps all authenticated staff PMS pages.
 *
 * Structure:
 *   [Sidebar] | [flex-col: Topbar shell (56px) + main (flex-1)]
 *
 * Topbar shell is empty in v1.1 — content (user menu, breadcrumb, search)
 * deferred to v1.2 per locked decision #9 in 11-CONTEXT.md.
 *
 * min-w-0 on the inner column prevents overflow during Sidebar
 * collapse animation (Pitfall 7 — 11-RESEARCH.md line 223).
 *
 * ChatPanel is mounted once here so the floating AI button
 * appears on every staff route. (Phase 07-03 — AI-01)
 */
export function StaffLayout() {
  return (
    <div className="hos flex min-h-screen bg-warm-paper">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar shell — empty v1.1, content deferred to v1.2 */}
        <header
          className="h-14 shrink-0 bg-warm-white border-b border-warm-line flex items-center px-6 gap-4"
          aria-label="Barra superior"
        />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      {/* AI Assistant floating button + panel — mounted once for all staff routes */}
      <ChatPanel />
    </div>
  );
}
