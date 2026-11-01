import { http, HttpResponse } from 'msw';

export const mockUser = {
  id: 'usr-123',
  email: 'test@example.com',
  roles: ['Customer'],
};

export const mockPage = {
  id: 'page-1',
  websiteId: 'site-123',
  title: 'Home',
  slug: 'home',
  status: 'Published',
  showInNavigation: true,
  sections: [
    {
      id: 'sec-1',
      type: 'hero',
      heading: 'Welcome to Nail Art Studio',
      body: 'Premium nail styling and bespoke elegance.',
      sortOrder: 0,
      ctaLabel: 'Book Appointment',
      ctaUrl: '#booking',
    },
    {
      id: 'sec-2',
      type: 'services',
      heading: 'Our Services',
      body: 'Gel manicures, pedicures, and nail extensions.',
      sortOrder: 1,
    },
  ],
};

export const mockSlots = [
  {
    startTimeUtc: '2026-11-02T10:00:00Z',
    endTimeUtc: '2026-11-02T11:00:00Z',
    resourceId: 'emp-123',
  },
  {
    startTimeUtc: '2026-11-02T11:30:00Z',
    endTimeUtc: '2026-11-02T12:30:00Z',
    resourceId: 'emp-123',
  },
  {
    startTimeUtc: '2026-11-02T14:00:00Z',
    endTimeUtc: '2026-11-02T15:00:00Z',
    resourceId: 'emp-123',
  },
];

export const handlers = [
  // Auth endpoints
  http.post('/api/auth/request-code', async ({ request }) => {
    const body = (await request.json()) as { email: string; scope: string };
    if (!body.email || !body.email.includes('@')) {
      return HttpResponse.json(
        { detail: 'Invalid email address provided.' },
        { status: 400 },
      );
    }
    return HttpResponse.json({
      message: 'Code sent.',
      developmentCode: '123456',
    });
  }),

  http.post('/api/auth/verify-code', async ({ request }) => {
    const body = (await request.json()) as { email: string; code: string };
    if (body.code === '123456') {
      return HttpResponse.json({
        accessToken: 'mock-jwt-token-abcdef',
        refreshToken: 'mock-refresh-token-123456',
        expiresAt: '2099-01-01T00:00:00Z',
        user: {
          id: mockUser.id,
          email: body.email || mockUser.email,
          roles: mockUser.roles,
        },
      });
    }
    return HttpResponse.json(
      { detail: 'That code is invalid or expired.' },
      { status: 400 },
    );
  }),

  http.post('/api/auth/refresh', async () => {
    return HttpResponse.json({
      accessToken: 'refreshed-jwt-token-xyz',
      refreshToken: 'refreshed-token-789',
      expiresAt: '2099-01-01T00:00:00Z',
      user: mockUser,
    });
  }),

  http.get('/api/auth/me', () => {
    return HttpResponse.json(mockUser);
  }),

  // Agenda endpoints
  http.get('/api/agenda/slots', ({ request }) => {
    const url = new URL(request.url);
    const resourceId = url.searchParams.get('resourceId');
    if (!resourceId) {
      return HttpResponse.json([]);
    }
    return HttpResponse.json(mockSlots);
  }),

  http.post('/api/agenda/reservations', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: 'resv-generated-1',
        ...body,
        status: 'Pending',
      },
      { status: 201 },
    );
  }),

  http.get('/api/agenda/reservations/my', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/agenda/reservations', () => {
    return HttpResponse.json([]);
  }),

  // Employee endpoints
  http.get('/api/employees/public', () => {
    return HttpResponse.json([
      {
        id: 'emp-123',
        displayName: 'Clara Oswald',
        email: 'clara@example.com',
        roleTitle: 'Lead Nail Artist',
        avatarUrl: '',
        assignedWebsiteIds: ['site-123'],
        serviceIds: ['srv-1'],
        isActive: true,
        colorHex: '#e11d48',
        skillTags: ['Nail Art', 'Gel-X'],
      },
    ]);
  }),

  http.get('/api/employees', () => {
    return HttpResponse.json([]);
  }),

  // CMS & Websites
  http.get('/api/websites/:websiteId', ({ params }) => {
    return HttpResponse.json({
      id: params.websiteId,
      name: 'Elegance Nails',
      domainOrSlug: 'elegance-nails',
      themeConfig: {
        primaryColor: '#b26c59',
        font: 'Inter',
      },
      content: {
        title: 'Elegance Nails Studio',
        navigation: {
          brandLabel: 'Elegance Nails',
          items: [{ label: 'Home', pageSlug: 'home' }],
          showBookingButton: true,
        },
      },
    });
  }),

  http.get('/api/websites/:websiteId/pages', () => {
    return HttpResponse.json([mockPage]);
  }),

  http.post('/api/websites/:websiteId/pages', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: `page-${Date.now()}`,
        ...body,
      },
      { status: 201 },
    );
  }),

  http.put('/api/websites/:websiteId/pages/:pageId', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(body);
  }),

  http.delete('/api/websites/:websiteId/pages/:pageId', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('/api/websites/resolve/:slug/:pageSlug', () => {
    return HttpResponse.json({
      websiteId: 'site-123',
      businessId: 'biz-123',
      page: mockPage,
    });
  }),

  http.post('/api/assets', () => {
    return HttpResponse.json({
      url: '/uploads/mock-uploaded-file.jpg',
    });
  }),
];

