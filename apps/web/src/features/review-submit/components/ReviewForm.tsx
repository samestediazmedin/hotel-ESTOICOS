import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StarRatingInput } from './StarRatingInput';

// ─── Schema ─────────────────────────────────────────────────────────────────

const formSchema = z.object({
  rating: z
    .number()
    .int()
    .min(1, 'Selecciona al menos 1 estrella')
    .max(5, 'Máximo 5 estrellas'),
  comment: z
    .string()
    .min(10, 'Mínimo 10 caracteres')
    .max(2000, 'Máximo 2000 caracteres'),
});

export type ReviewFormValues = z.infer<typeof formSchema>;

// ─── Props ───────────────────────────────────────────────────────────────────

interface ReviewFormProps {
  onSubmit: (values: ReviewFormValues) => Promise<void> | void;
  isSubmitting?: boolean;
  /** Error string from the mutation caller (HTTP status → message mapping). */
  submitError?: string | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ReviewForm — react-hook-form + zodResolver.
 *
 * StarRatingInput is a controlled component driven by react-hook-form's
 * `watch` + `setValue` (not register) because it is not a native input.
 *
 * Error display:
 *   - Inline field errors from Zod (rating, comment)
 *   - Server-level errors passed via `submitError` prop
 */
export function ReviewForm({ onSubmit, isSubmitting, submitError }: ReviewFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { rating: 0, comment: '' },
  });

  // react-hook-form's watch() is not memoization-safe per React Compiler rules.
  // Acceptable here: StarRatingInput is a controlled component that requires a
  // live rating value — using Controller + render prop would be the alternative
  // but adds unnecessary complexity for a single-field case.
  // eslint-disable-next-line react-hooks/incompatible-library
  const rating = watch('rating');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Star rating */}
      <div>
        <label className="block mb-2 text-sm font-medium text-ink-2">
          ¿Cómo calificas tu estadía?
        </label>
        <StarRatingInput
          value={rating}
          onChange={(v) => setValue('rating', v, { shouldValidate: true })}
          disabled={isSubmitting}
        />
        {errors.rating && (
          <p className="mt-1 text-sm text-terracotta">{errors.rating.message}</p>
        )}
      </div>

      {/* Comment */}
      <div>
        <label htmlFor="review-comment" className="block mb-2 text-sm font-medium text-ink-2">
          Cuéntanos más
        </label>
        <Textarea
          id="review-comment"
          rows={5}
          placeholder="¿Qué destacarías de tu visita? ¿Qué podríamos mejorar?"
          {...register('comment')}
          disabled={isSubmitting}
        />
        {errors.comment && (
          <p className="mt-1 text-sm text-terracotta">{errors.comment.message}</p>
        )}
      </div>

      {/* Server-level error */}
      {submitError && (
        <div className="rounded-md bg-terracotta-tint p-3 text-sm text-terracotta border border-terracotta-soft">
          {submitError}
        </div>
      )}

      <Button
        type="submit"
        variant="terracotta"
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting ? 'Enviando…' : 'Enviar reseña'}
      </Button>
    </form>
  );
}
