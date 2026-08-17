import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminOffers,
  createOfferWithImage,
  updateOfferWithImage,
  deleteOffer,
  reorderOffers,
  type AdminOffer,
  type OfferFormFields,
} from '../offers-admin.api';

const ADMIN_KEY = ['admin', 'offers'] as const;

export function useAdminOffers() {
  return useQuery({
    queryKey: ADMIN_KEY,
    queryFn: fetchAdminOffers,
    staleTime: 30_000,
  });
}

export function useCreateOffer() {
  const qc = useQueryClient();
  return useMutation<
    AdminOffer,
    Error,
    { fields: OfferFormFields & { title: string }; image: File }
  >({
    mutationFn: ({ fields, image }) => createOfferWithImage(fields, image),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEY });
      qc.invalidateQueries({ queryKey: ['public', 'offers'] });
    },
  });
}

export function useUpdateOffer() {
  const qc = useQueryClient();
  return useMutation<
    AdminOffer,
    Error,
    { id: string; fields: OfferFormFields; image?: File | null }
  >({
    mutationFn: ({ id, fields, image }) => updateOfferWithImage(id, fields, image),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEY });
      qc.invalidateQueries({ queryKey: ['public', 'offers'] });
    },
  });
}

export function useDeleteOffer() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteOffer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEY });
      qc.invalidateQueries({ queryKey: ['public', 'offers'] });
    },
  });
}

export function useReorderOffers() {
  const qc = useQueryClient();
  return useMutation<void, Error, string[]>({
    mutationFn: reorderOffers,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEY });
      qc.invalidateQueries({ queryKey: ['public', 'offers'] });
    },
  });
}
