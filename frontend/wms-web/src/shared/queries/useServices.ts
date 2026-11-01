import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cmsApi, type CatalogService } from '@modules/cms'

export const serviceKeys = {
  all: ['services'] as const,
  detail: (id: string) => ['services', id] as const,
}

export function useServices() {
  return useQuery({
    queryKey: serviceKeys.all,
    queryFn: async () => {
      const { data } = await cmsApi.services()
      return data
    },
  })
}

export function useCreateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<CatalogService, 'id'>) => {
      const { data } = await cmsApi.createService(payload)
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: serviceKeys.all })
    },
  })
}

export function useUpdateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CatalogService> }) => {
      const response = await cmsApi.updateService(id, data)
      return response.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: serviceKeys.all })
    },
  })
}

export function useDeleteService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await cmsApi.deleteService(id)
      return id
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: serviceKeys.all })
    },
  })
}

