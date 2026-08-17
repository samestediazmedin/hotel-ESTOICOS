import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { UserFormDrawer } from './UserFormDrawer';
import { UserActionsMenu, type User as UserWithStatus } from '../users/components/UserActionsMenu';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'RECEPTION' | 'HOUSEKEEPING';
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

const ROLE_LABELS: Record<User['role'], string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  RECEPTION: 'Recepción',
  HOUSEKEEPING: 'Housekeeping',
};

const ROLE_COLORS: Record<User['role'], string> = {
  ADMIN: 'bg-terracotta text-text-inverse',
  MANAGER: 'bg-status-verified text-text-inverse',
  RECEPTION: 'bg-status-ready text-text-inverse',
  HOUSEKEEPING: 'bg-status-pending text-text-inverse',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  ACTIVE: { label: 'Activo', color: 'text-status-ready', dot: 'bg-status-ready' },
  SUSPENDED: { label: 'Suspendido', color: 'text-amber-600', dot: 'bg-amber-500' },
  INACTIVE: { label: 'Inactivo', color: 'text-ink-3', dot: 'bg-ink-3' },
};

/**
 * UsersPage — Admin user management
 *
 * Features:
 * - List all users from GET /api/users
 * - "Nuevo usuario" button → UserFormDrawer
 * - "Desactivar" per row → POST /api/users/:id/deactivate + refetch
 *
 * D-22: No hardcoded hex — Tailwind classes only
 * NOTE: window.confirm is used for deactivation in Phase 1.
 * Phase 2 replaces this with shadcn AlertDialog component.
 */
export function UsersPage() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: users = [], isLoading, error } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get<User[]>('/users');
      return res.data;
    },
  });

  const handleEdit = async (user: UserWithStatus, data: { name: string; email: string; role: User['role'] }) => {
    await api.patch(`/users/${user.id}`, data);
    await queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const handleChangePassword = async (userId: string, password: string, currentPassword?: string) => {
    await api.post(`/users/${userId}/change-password`, { tempPassword: password, currentPassword });
    await queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const handleChangeStatus = async (userId: string, status: User['status']) => {
    const endpoint = status === 'ACTIVE' ? 'activate' : status === 'SUSPENDED' ? 'suspend' : 'deactivate';
    await api.post(`/users/${userId}/${endpoint}`);
    await queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const handleViewDetails = (user: UserWithStatus) => {
    // Details are shown in the modal within UserActionsMenu
    console.log('View details for', user.name);
  };

  return (
    <div className="min-h-screen bg-bg-base p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-ink-1 text-2xl font-semibold">Usuarios</h1>
          <p className="text-ink-3 text-sm mt-1">
            Gestión de acceso al sistema
          </p>
        </div>
        <Button onClick={() => setIsDrawerOpen(true)}>
          Nuevo usuario
        </Button>
      </div>

      {/* Table */}
      <div className="bg-warm-white border border-warm-line rounded-lg overflow-hidden">
        {isLoading && (
          <div className="p-8 text-center text-ink-3">Cargando usuarios...</div>
        )}

        {error && (
          <div className="p-8 text-center text-status-in-progress">
            Error al cargar usuarios. Verifique que tiene permisos de admin.
          </div>
        )}

        {!isLoading && !error && (
          <table className="w-full">
            <thead>
              <tr className="border-b border-warm-line">
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-3 uppercase tracking-wide">
                  Nombre
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-3 uppercase tracking-wide">
                  Correo
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-3 uppercase tracking-wide">
                  Rol
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-3 uppercase tracking-wide">
                  Estado
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-warm-line last:border-0 hover:bg-terracotta-soft transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-ink-1 font-medium">
                    {user.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-2">
                    {user.email}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role]}`}
                    >
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const status = user.status || (user.isActive ? 'ACTIVE' : 'INACTIVE');
                      const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.ACTIVE;
                      if (!config) return <span className="text-xs text-ink-3">—</span>;
                      return (
                        <span className={`inline-flex items-center gap-1 text-xs ${config.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                          {config.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <UserActionsMenu
                      user={user as UserWithStatus}
                      onEdit={handleEdit}
                      onChangePassword={handleChangePassword}
                      onChangeStatus={handleChangeStatus}
                      onViewDetails={handleViewDetails}
                    />
                  </td>
                </tr>
              ))}

              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-3 text-sm">
                    No hay usuarios registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create User Drawer */}
      <UserFormDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
      />
    </div>
  );
}
