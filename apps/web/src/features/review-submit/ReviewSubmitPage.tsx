import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { useForceLightTheme } from '@/features/public-portal/hooks/useForceLightTheme';
import { useReviewToken } from './hooks/useReviewToken';
import { useSubmitReview } from './hooks/useSubmitReview';
import { ReviewForm, type ReviewFormValues } from './components/ReviewForm';

/**
 * ReviewSubmitPage — public, standalone (no StaffLayout, no TopNav).
 *
 * Flow:
 *   1. Read `?token` from URL searchParams
 *   2. Mount → useReviewToken fires GET /api/public/reviews/validate-token
 *   3. Render appropriate state: loading | error | already-used | form | success
 *
 * Layout: `hos` class scopes public-portal CSS variables (Phase 10 portal reset).
 * `useForceLightTheme` removes data-theme attribute to prevent dark-mode leak
 * for guests who may have used the staff PMS with dark theme.
 *
 * Error mapping (HTTP status → user message):
 *   401 → "Este enlace ya no es válido"
 *   410 → "Este enlace ya fue utilizado"
 *   429 → throttle message
 *   other → generic retry message
 */
export default function ReviewSubmitPage() {
  useForceLightTheme();

  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validateQuery = useReviewToken(token);
  const submitMutation = useSubmitReview();

  async function handleSubmit(values: ReviewFormValues) {
    if (!token) return;
    setSubmitError(null);
    try {
      await submitMutation.mutateAsync({
        token,
        rating: values.rating,
        comment: values.comment,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 410) {
        setSubmitError('Este enlace ya fue utilizado.');
      } else if (status === 401) {
        setSubmitError('Este enlace ya no es válido.');
      } else if (status === 429) {
        setSubmitError('Demasiados intentos. Inténtalo más tarde.');
      } else {
        setSubmitError('No se pudo enviar tu reseña. Inténtalo de nuevo.');
      }
    }
  }

  const tokenData = validateQuery.data;

  return (
    <div className="hos min-h-screen bg-warm-paper flex items-center justify-center p-4">
      <Card className="w-full max-w-lg p-8 bg-warm-white shadow-lg">
        <h1 className="font-display italic text-3xl text-ink-1 mb-6">
          Tu opinión cuenta
        </h1>

        {/* No token in URL */}
        {!token && (
          <div className="space-y-4">
            <p className="text-terracotta">Falta el token de invitación.</p>
            <Link to="/" className="text-terracotta underline">
              Volver al inicio
            </Link>
          </div>
        )}

        {/* Loading state — token being validated */}
        {token && validateQuery.isLoading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-warm-cream rounded w-3/4" />
            <div className="h-4 bg-warm-cream rounded w-1/2" />
          </div>
        )}

        {/* Error state — invalid / expired token */}
        {token && validateQuery.isError && (
          <div className="space-y-4">
            <p className="text-ink-2">
              Este enlace ya no es válido o ha expirado.
            </p>
            <Link to="/" className="text-terracotta underline">
              Volver al inicio
            </Link>
          </div>
        )}

        {/* Already submitted — alreadySubmitted flag from validate-token */}
        {token && tokenData?.alreadySubmitted && (
          <div className="space-y-4">
            <p className="text-ink-2">
              Este enlace ya fue utilizado. ¡Gracias por tu reseña!
            </p>
            <Link to="/" className="text-terracotta underline">
              Volver al inicio
            </Link>
          </div>
        )}

        {/* Form state — token valid, not yet submitted */}
        {token && tokenData && !tokenData.alreadySubmitted && !submitted && (
          <>
            <p className="text-ink-3 mb-6">
              Hola,{' '}
              <span className="font-medium text-ink-2">{tokenData.guestName}</span>.
              Esperamos que hayas disfrutado tu estadía.
            </p>
            <ReviewForm
              onSubmit={handleSubmit}
              isSubmitting={submitMutation.isPending}
              submitError={submitError}
            />
          </>
        )}

        {/* Success state — review submitted successfully */}
        {submitted && (
          <div className="space-y-4">
            <h2 className="font-display italic text-2xl text-ink-1">
              ¡Gracias por tu reseña!
            </h2>
            <p className="text-ink-3">
              Tu opinión nos ayuda a mejorar la experiencia de cada huésped.
            </p>
            <Link to="/" className="text-terracotta underline">
              Volver al inicio
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
