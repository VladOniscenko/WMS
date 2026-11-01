import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { httpClient } from "../api/httpClient";

export type PageSection = {
  id: string;
  type: string;
  heading: string;
  body?: string;
  imageUrl?: string;
  sortOrder: number;
};

export type WebsitePage = {
  id: string;
  websiteId: string;
  slug: string;
  title: string;
  status: string;
  showInNavigation: boolean;
  sections: PageSection[];
};

export type Website = {
  id: string;
  businessId: string;
  name: string;
  domainOrSlug: string;
  category: string;
  status: string;
  enabledModules: string[];
  themeConfig: {
    primaryColor?: string;
    logoUrl?: string;
    font?: string;
    themeId?: string;
  };
  content?: {
    title?: string;
    tagline?: string;
    heroText?: string;
    heroImageUrl?: string;
    aboutText?: string;
    galleryImageUrls?: string[];
    navigation?: {
      brandLabel?: string;
      items?: { label: string; pageSlug: string }[];
      showBookingButton?: boolean;
    };
    footer?: {
      text?: string;
      address?: string;
      email?: string;
      phone?: string;
    };
  };
};

export type Business = {
  id: string;
  name: string;
  ownerEmail: string;
  websiteCount: number;
  websites: Website[];
};

export const websiteKeys = {
  all: ["websites"] as const,
  businesses: ["businesses"] as const,
  detail: (id: string) => ["websites", id] as const,
};

export function useBusinesses() {
  return useQuery({
    queryKey: websiteKeys.businesses,
    queryFn: async () => {
      const { data } = await httpClient.get<Business[]>("/api/businesses");
      return data;
    },
  });
}

export function useWebsites() {
  const query = useBusinesses();
  const websites = query.data?.flatMap((b) => b.websites) ?? [];
  return {
    ...query,
    websites,
  };
}

export function useWebsite(id: string) {
  return useQuery({
    queryKey: websiteKeys.detail(id),
    queryFn: async () => {
      const { data } = await httpClient.get<Website>(`/api/websites/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateWebsite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      domainOrSlug: string;
      templateId?: string;
      category: string;
      enabledModules: string[];
      themeConfig?: {
        primaryColor?: string;
        logoUrl?: string;
        font?: string;
        themeId?: string;
      };
      content?: { title?: string; heroText?: string };
    }) => {
      const { data } = await httpClient.post<Website>("/api/websites", payload);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: websiteKeys.businesses });
      void qc.invalidateQueries({ queryKey: websiteKeys.all });
    },
  });
}

export function useUpdateWebsite(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Website>) => {
      const { data } = await httpClient.put<Website>(
        `/api/websites/${websiteId}`,
        payload,
      );
      return data;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: websiteKeys.businesses });
      void qc.invalidateQueries({ queryKey: websiteKeys.all });
      void qc.invalidateQueries({ queryKey: websiteKeys.detail(websiteId) });
      return data;
    },
  });
}

export function usePublishWebsite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (websiteId: string) => {
      const { data } = await httpClient.post<Website>(
        `/api/websites/${websiteId}/publish`,
      );
      return data;
    },
    onSuccess: (_, websiteId) => {
      void qc.invalidateQueries({ queryKey: websiteKeys.businesses });
      void qc.invalidateQueries({ queryKey: websiteKeys.all });
      void qc.invalidateQueries({ queryKey: websiteKeys.detail(websiteId) });
    },
  });
}
