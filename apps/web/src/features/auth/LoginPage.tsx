import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { z } from 'zod';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HotelBranding } from '@/components/branding/HotelBranding';
import { useAuth } from './useAuth';
import { api } from '@/lib/api';

const loginSchema = z.object({
  email: z.string().email('Ingrese un correo válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

// LoginPage — INT-01 split-panel design. Existing login logic preserved verbatim.
export function LoginPage() {
  const { login, isLoading, error } = useAuth();
  const [hotelName, setHotelName] = useState<string>('Hotel Sumapaz');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Fetch hotel name from public endpoint (no auth required)
  useEffect(() => {
    api.get<{ hotelName: string }>('/system-config/public')
      .then((res) => {
        if (res.data.hotelName) {
          setHotelName(res.data.hotelName);
        }
      })
      .catch(() => {
        // Fail silently — use default name
      });
  }, []);

  const onSubmit = (data: LoginFormData) => {
    login(data);
  };

  return (
    <div className="hos min-h-screen grid lg:grid-cols-2 bg-warm-paper">
      {/* Left panel — decorative, desktop only */}
      <aside className="hidden lg:flex relative bg-ink-1 flex-col justify-between p-12 overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              'radial-gradient(at 20% 30%, var(--terracotta) 0%, transparent 50%), radial-gradient(at 80% 70%, var(--mustard) 0%, transparent 50%)',
          }}
          aria-hidden
        />
        <div className="relative z-10 flex items-center gap-2 text-warm-white">
          <span className="w-8 h-8 rounded-lg bg-terracotta text-warm-white flex items-center justify-center font-display italic text-lg">H</span>
          <span className="font-display italic text-xl">{hotelName}</span>
        </div>
        <h1 className="relative z-10 font-display text-5xl text-warm-white leading-tight">
          Hospitalidad, <i>operada con inteligencia</i>
        </h1>
        <div className="relative z-10 flex gap-8">
          {[
            { num: '42', label: 'habitaciones' },
            { num: '78%', label: 'ocupación' },
            { num: '12', label: 'check-ins hoy' },
          ].map(({ num, label }) => (
            <div key={label}>
              <span className="font-mono text-2xl text-mustard">{num}</span>
              <p className="text-xs text-ink-4 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </aside>

      {/* Right panel — form */}
      <main className="relative flex items-center justify-center bg-warm-white p-8">
        {/* Back-to-site button — top-left, visible on all breakpoints */}
        <Link
          to="/"
          aria-label="Volver al sitio del hotel"
          className="absolute top-4 left-4 flex items-center gap-1.5 px-3 h-9 rounded-full text-sm text-ink-2 hover:text-terracotta hover:bg-warm-paper transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al sitio</span>
        </Link>

        <div className="w-full max-w-[420px]">
          <HotelBranding hotelName={hotelName} city="Bogotá" />

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-4" noValidate>
            {/* Email */}
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm font-medium text-ink-2">
                Correo electrónico
              </label>
              <Input
                id="email"
                type="email"
                placeholder="admin@hotelsumapaz.co"
                autoComplete="email"
                className="font-mono"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-terracotta">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-sm font-medium text-ink-2">
                Contraseña
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-terracotta">{errors.password.message}</p>
              )}
            </div>

            {/* Auth error */}
            {error && (
              <div
                role="alert"
                className="bg-terracotta-soft text-ink-1 rounded px-3 py-3 text-sm"
              >
                {error}
              </div>
            )}

            {/* Submit — terracotta primary */}
            <Button
              type="submit"
              variant="terracotta"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Ingresando...' : 'Entrar'}
            </Button>

            {/* Secondary link to public site */}
            <Link
              to="/"
              className="text-center text-sm text-ink-3 hover:text-terracotta underline-offset-4 hover:underline mt-2"
            >
              Ir al sitio del hotel
            </Link>
          </form>
        </div>
      </main>
    </div>
  );
}
