import { useState } from 'react';
import { useAuthStore } from '@/features/auth/auth.store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  MoreHorizontal,
  Pencil,
  KeyRound,
  Eye,
  Ban,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'MANAGER' | 'RECEPTION' | 'HOUSEKEEPING';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserActionsMenuProps {
  user: User;
  onEdit: (user: User, data: { name: string; email: string; role: UserRole }) => Promise<void>;
  onChangePassword: (userId: string, password: string, currentPassword?: string) => Promise<void>;
  onChangeStatus: (userId: string, status: UserStatus) => Promise<void>;
  onViewDetails: (user: User) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  RECEPTION: 'Recepción',
  HOUSEKEEPING: 'Housekeeping',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  ACTIVE: { label: 'Activo', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 },
  SUSPENDED: { label: 'Suspendido', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: AlertTriangle },
  INACTIVE: { label: 'Inactivo', color: 'bg-red-100 text-red-800 border-red-200', icon: Ban },
};

function validateAdminPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 10) errors.push('Mínimo 10 caracteres');
  if (!/[A-Z]/.test(password)) errors.push('Al menos una mayúscula');
  if (!/[a-z]/.test(password)) errors.push('Al menos una minúscula');
  if (!/[0-9]/.test(password)) errors.push('Al menos un número');
  if (!/[!@#$%^&*()_+&#x3D;&#x5B;&#x5D;&#x7B;&#x7D;':"\\|,.&lt;&gt;\/?]/.test(password)) errors.push('Al menos un carácter especial');
  return { valid: errors.length === 0, errors };
}

function validateRegularPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Mínimo 8 caracteres');
  return { valid: errors.length === 0, errors };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function UserActionsMenu({
  user,
  onEdit,
  onChangePassword,
  onChangeStatus,
  onViewDetails,
}: UserActionsMenuProps) {
  const currentUser = useAuthStore((s) => s.user);
  const isCurrentUser = currentUser?.id === user.id;
  const isAdmin = user.role === 'ADMIN';
  const isCurrentUserAdmin = currentUser?.role === 'ADMIN';

  // Modals state
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<UserStatus | null>(null);

  // Form state
  const [editName, setEditName] = useState(user.name);
  const [editEmail, setEditEmail] = useState(user.email);
  const [editRole, setEditRole] = useState<UserRole>(user.role);
  const [editLoading, setEditLoading] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleEdit = async () => {
    // Self-protection: admin cannot change own role
    if (isCurrentUser && isAdmin && editRole !== user.role) {
      toast.error('No puedes cambiar el rol de tu propia cuenta de administrador');
      return;
    }

    setEditLoading(true);
    try {
      await onEdit(user, { name: editName, email: editEmail, role: editRole });
      toast.success('Usuario actualizado correctamente');
      setEditOpen(false);
    } catch (err) {
      toast.error('Error al actualizar usuario');
    } finally {
      setEditLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    const validator = isAdmin ? validateAdminPassword : validateRegularPassword;
    const validation = validator(newPassword);

    if (!validation.valid) {
      setPasswordErrors(validation.errors);
      return;
    }

    // Admin password change requires current password verification
    if (isAdmin && !currentPassword) {
      setPasswordErrors(['Para cambiar la contraseña de un administrador, debes confirmar tu contraseña actual']);
      return;
    }

    setPasswordLoading(true);
    try {
      await onChangePassword(user.id, newPassword, isAdmin ? currentPassword : undefined);
      toast.success('Contraseña actualizada correctamente');
      setPasswordOpen(false);
      setNewPassword('');
      setCurrentPassword('');
      setPasswordErrors([]);
    } catch (err) {
      toast.error('Error al cambiar la contraseña');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!pendingStatus) return;

    // Self-protection: admin cannot suspend/deactivate self
    if (isCurrentUser && isAdmin && pendingStatus !== 'ACTIVE') {
      toast.error('No puedes desactivar ni suspender tu propia cuenta de administrador');
      setStatusConfirmOpen(false);
      return;
    }

    try {
      await onChangeStatus(user.id, pendingStatus);
      toast.success(`Estado cambiado a ${STATUS_CONFIG[pendingStatus].label}`);
      setStatusConfirmOpen(false);
    } catch (err) {
      toast.error('Error al cambiar el estado');
    }
  };

  const openStatusConfirm = (status: UserStatus) => {
    setPendingStatus(status);
    setStatusConfirmOpen(true);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const StatusIcon = STATUS_CONFIG[user.status].icon;

  return (
    <>
      {/* Inline action buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-ink-3 hover:text-terracotta hover:bg-terracotta/10"
          onClick={() => setEditOpen(true)}
          title="Editar usuario"
        >
          <Pencil className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-ink-3 hover:text-terracotta hover:bg-terracotta/10"
          onClick={() => setPasswordOpen(true)}
          title="Cambiar contraseña"
        >
          <KeyRound className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-ink-3 hover:text-terracotta hover:bg-terracotta/10"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setDetailsOpen(true)}>
              <Eye className="mr-2 h-4 w-4" />
              Ver Detalles
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => openStatusConfirm('ACTIVE')}
              disabled={user.status === 'ACTIVE'}
            >
              <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
              Activar Cuenta
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => openStatusConfirm('SUSPENDED')}
              disabled={user.status === 'SUSPENDED' || (isCurrentUser && isAdmin)}
              className={isCurrentUser && isAdmin ? 'opacity-50 cursor-not-allowed' : ''}
            >
              <AlertTriangle className="mr-2 h-4 w-4 text-amber-600" />
              Suspender Cuenta
              {isCurrentUser && isAdmin && (
                <span className="ml-auto text-xs text-red-500">Protegido</span>
              )}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => openStatusConfirm('INACTIVE')}
              disabled={user.status === 'INACTIVE' || (isCurrentUser && isAdmin)}
              className={isCurrentUser && isAdmin ? 'opacity-50 cursor-not-allowed' : ''}
            >
              <Ban className="mr-2 h-4 w-4 text-red-600" />
              Desactivar Cuenta
              {isCurrentUser && isAdmin && (
                <span className="ml-auto text-xs text-red-500">Protegido</span>
              )}
            </DropdownMenuItem>

            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <div className="flex items-center gap-2 text-xs text-amber-700">
                    <ShieldAlert className="h-3 w-3" />
                    <span>Cuenta con privilegios elevados</span>
                  </div>
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              Modifica la información de {user.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Rol</Label>
              <Select
                value={editRole}
                onValueChange={(v) => setEditRole(v as UserRole)}
                disabled={isCurrentUser && isAdmin}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="RECEPTION">Recepción</SelectItem>
                  <SelectItem value="HOUSEKEEPING">Housekeeping</SelectItem>
                </SelectContent>
              </Select>
              {isCurrentUser && isAdmin && (
                <p className="text-xs text-amber-600">
                  No puedes cambiar tu propio rol de administrador
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleEdit}
              disabled={editLoading}
              className="bg-terracotta hover:bg-terracotta/90"
            >
              {editLoading ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Modal */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Cambiar Contraseña</DialogTitle>
            <DialogDescription>
              {isAdmin
                ? 'Esta cuenta tiene privilegios de administrador. Se requiere verificación adicional.'
                : `Asigna una nueva contraseña para ${user.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {isAdmin && (
              <div className="grid gap-2">
                <Label htmlFor="currentPassword">Tu contraseña actual (verificación)</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Confirma tu identidad"
                />
                <p className="text-xs text-amber-600">
                  Requerido para cambiar contraseñas de administradores
                </p>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="newPassword">
                Nueva contraseña
                {isAdmin && (
                  <span className="ml-2 text-xs text-amber-600">
                    (Mín. 10 chars, mayúscula, número, especial)
                  </span>
                )}
              </Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordErrors([]);
                }}
                placeholder={isAdmin ? 'AdminPass123!' : 'Nueva contraseña'}
              />
            </div>
            {passwordErrors.length > 0 && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                <p className="font-medium">Requisitos no cumplidos:</p>
                <ul className="mt-1 list-disc pl-4">
                  {passwordErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handlePasswordChange}
              disabled={passwordLoading}
              className="bg-terracotta hover:bg-terracotta/90"
            >
              {passwordLoading ? 'Cambiando...' : 'Cambiar contraseña'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Detalles del Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-3">Nombre</span>
              <span className="font-medium">{user.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-3">Correo</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-3">Rol</span>
              <Badge variant="default" className={isAdmin ? 'bg-terracotta/10 text-terracotta border border-terracotta/20' : ''}>
                {ROLE_LABELS[user.role]}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-3">Estado</span>
              {(() => {
                const status = user.status || 'ACTIVE';
                const config = STATUS_CONFIG[status] || STATUS_CONFIG.ACTIVE;
                const StatusIcon = config.icon;
                return (
                  <Badge variant="default" className={config.color}>
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {config.label}
                  </Badge>
                );
              })()}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-3">Creado</span>
              <span className="text-sm">{new Date(user.createdAt).toLocaleDateString('es-CO')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-3">Última actualización</span>
              <span className="text-sm">{new Date(user.updatedAt).toLocaleDateString('es-CO')}</span>
            </div>
            {user.mustChangePassword && (
              <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mr-2 inline h-4 w-4" />
                Debe cambiar la contraseña en el próximo inicio de sesión
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Confirmation */}
      <Dialog open={statusConfirmOpen} onOpenChange={setStatusConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar Cambio de Estado</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas cambiar el estado de {user.name} a{' '}
              <strong>{pendingStatus && STATUS_CONFIG[pendingStatus].label}</strong>?
            </DialogDescription>
          </DialogHeader>
          {pendingStatus === 'INACTIVE' && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              <Ban className="mr-2 inline h-4 w-4" />
              El usuario no podrá iniciar sesión hasta que se reactive la cuenta.
            </div>
          )}
          {pendingStatus === 'SUSPENDED' && (
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              La cuenta quedará en revisión. El acceso será limitado.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleStatusChange}
              className={
                pendingStatus === 'ACTIVE'
                  ? 'bg-green-600 hover:bg-green-700'
                  : pendingStatus === 'SUSPENDED'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-red-600 hover:bg-red-700'
              }
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
