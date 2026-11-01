import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { httpClient } from '../api/httpClient'
import type { WebsitePage } from './useWebsites'

export const pageKeys = {
  byWebsite: (websiteId: string) => ['pages', websiteId] as const,
  detail: (websiteId: string, pageId: string) => ['pages', websiteId, pageId] as const,
}

export function usePages(websiteId: string) {
  return useQuery({
    queryKey: pageKeys.byWebsite(websiteId),
    queryFn: async () => {
      const { data } = await httpClient.get<WebsitePage[]>(`/api/websites/${websiteId}/pages`)
      return data
    },
    enabled: Boolean(websiteId),
  })
}

export function useCreatePage(websiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      title: string
      slug: string
      status: string
      showInNavigation?: boolean
      sections?: unknown[]
    }) => {
      const { data } = await httpClient.post<WebsitePage>(`/api/websites/${websiteId}/pages`, payload)
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pageKeys.byWebsite(websiteId) })
    },
  })
}

export function useUpdatePage(websiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (page: WebsitePage) => {
      const { data } = await httpClient.put<WebsitePage>(`/api/websites/${websiteId}/pages/${page.id}`, page)
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pageKeys.byWebsite(websiteId) })
    },
  })
}

export function useDeletePage(websiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (pageId: string) => {
      await httpClient.delete(`/api/websites/${websiteId}/pages/${pageId}`)
      return pageId
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pageKeys.byWebsite(websiteId) })
    },
  })
}

