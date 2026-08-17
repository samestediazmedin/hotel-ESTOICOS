import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

const createUserSchema = z.object({
  email: z.string().email('Ingrese un correo válido'),
  name: z.string().min(2, 'Nombre requerido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  role: z.enum(['ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING']),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

interface UserFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'RECEPTION', label: 'Recepción' },
  { value: 'HOUSEKEEPING', label: 'Housekeeping' },
] as const;

/**
 * UserFormDrawer — Slide-in drawer for creating new users
 *
 * D-22: No hardcoded hex — Tailwind classes only
 * Form uses react-hook-form + zod for validation
 */
export function UserFormDrawer({ isOpen, onClose, onSuccess }: UserFormDrawerProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: 'RECEPTION' },
  });

  const onSubmit = async (data: CreateUserFormData) => {
    try {
      await api.post('/users', data);
      reset();
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error creating user:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-1/20 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo usuario"
        className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-warm-white border-l border-warm-line shadow-lg z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-warm-line">
          <h2 className="text-ink-1 text-lg font-semibold">Nuevo usuario</h2>
          <button
            onClick={onClose}
            className="text-ink-3 hover:text-ink-1 transition-colors"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">

          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-sm font-medium text-ink-2">
              Nombre completo
            </label>
            <Input id="name" type="text" placeholder="María García" {...register('name')} />
            {errors.name && <p className="text-xs text-status-in-progress">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="userEmail" className="text-sm font-medium text-ink-2">
              Correo electrónico
            </label>
            <Input id="userEmail" type="email" placeholder="maria@hotel.com" {...register('email')} />
            {errors.email && <p className="text-xs text-status-in-progress">{errors.email.message}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="userPassword" className="text-sm font-medium text-ink-2">
              Contraseña temporal
            </label>
            <Input
              id="userPassword"
              type="password"
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-status-in-progress">{errors.password.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="role" className="text-sm font-medium text-ink-2">
              Rol
            </label>
            <select
              id="role"
              {...register('role')}
              className="flex h-9 w-full rounded-md border border-warm-line-strong bg-warm-cream px-3 py-1 text-sm text-ink-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 mt-auto">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear usuario'}
            </Button>
          </div>

        </form>
      </div>
    </>
  );
}
