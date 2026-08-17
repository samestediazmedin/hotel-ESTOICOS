import { describe, it, expect } from 'vitest';
import { validateAdminPassword, validateRegularPassword } from './change-password.dto';

describe('Password Validators', () => {
  describe('validateAdminPassword', () => {
    it('should accept valid admin password', () => {
      const result = validateAdminPassword('AdminPass123!');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password shorter than 10 chars', () => {
      const result = validateAdminPassword('Short1!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Mínimo 10 caracteres');
    });

    it('should reject password without uppercase', () => {
      const result = validateAdminPassword('adminpass123!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Al menos una mayúscula');
    });

    it('should reject password without lowercase', () => {
      const result = validateAdminPassword('ADMINPASS123!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Al menos una minúscula');
    });

    it('should reject password without number', () => {
      const result = validateAdminPassword('AdminPass!!!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Al menos un número');
    });

    it('should reject password without special char', () => {
      const result = validateAdminPassword('AdminPass123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Al menos un carácter especial');
    });

    it('should report multiple errors at once', () => {
      const result = validateAdminPassword('short');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('validateRegularPassword', () => {
    it('should accept valid regular password', () => {
      const result = validateRegularPassword('MyPass123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password shorter than 8 chars', () => {
      const result = validateRegularPassword('Short1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Mínimo 8 caracteres');
    });

    it('should accept exactly 8 chars', () => {
      const result = validateRegularPassword('Eight88!');
      expect(result.valid).toBe(true);
    });
  });
});
