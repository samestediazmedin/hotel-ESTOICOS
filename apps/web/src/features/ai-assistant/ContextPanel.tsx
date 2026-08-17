import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAiChatStore } from './ai-chat.store';

/**
 * ContextPanel — right-side column inside ChatPanel.
 *
 * Shows 3 sections with EXACT uppercase labels (AI-12 contract):
 *   1. CONTEXTO ACTIVO    — current context derived from latest tool result
 *   2. FUENTES CONSULTADAS — tools called this conversation turn
 *   3. ACCIONES SUGERIDAS  — navigation buttons from tool results (NEVER mutations)
 */
export function ContextPanel() {
  const navigate = useNavigate();
  const { contextPanel } = useAiChatStore();
  const { activeContext, sources, suggestedActions } = contextPanel;

  return (
    <aside
      className="w-full flex flex-col overflow-y-auto p-4 gap-6"
      aria-label="Panel de contexto"
    >
      {/* ── Section 1: CONTEXTO ACTIVO ─────────────────────────────────── */}
      <section>
        <h3 className="font-display italic text-xl text-ink-1 mb-3">
          CONTEXTO ACTIVO
        </h3>
        {activeContext ? (
          <div className="bg-warm-white border border-warm-line rounded-lg p-3 mb-2">
            <p className="text-sm text-ink-1">{activeContext}</p>
          </div>
        ) : (
          <p className="text-sm text-ink-3 italic">No hay contexto activo</p>
        )}
      </section>

      {/* ── Section 2: FUENTES CONSULTADAS ────────────────────────────── */}
      <section>
        <h3 className="font-display italic text-xl text-ink-1 mb-3">
          FUENTES CONSULTADAS
        </h3>
        {sources.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {sources.map((toolName) => (
              <li key={toolName} className="bg-warm-white border border-warm-line rounded-lg p-3 mb-2 flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-terracotta shrink-0" />
                <span className="text-xs text-ink-1 font-mono flex-1">{toolName}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-mustard-tint text-mustard text-xs font-medium">
                  herramienta
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3 italic">No hay fuentes consultadas</p>
        )}
      </section>

      {/* ── Section 3: ACCIONES SUGERIDAS ─────────────────────────────── */}
      <section>
        <h3 className="font-display italic text-xl text-ink-1 mb-3">
          ACCIONES SUGERIDAS
        </h3>
        {suggestedActions.length > 0 ? (
          <div className="flex flex-col gap-2">
            {suggestedActions.map((action, i) => (
              <Button
                key={`${action.route}-${i}`}
                variant="outline"
                size="sm"
                className="w-full justify-start text-left"
                onClick={() => navigate(action.route)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-3 italic">No hay acciones sugeridas</p>
        )}
      </section>
    </aside>
  );
}
