import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { useEmployees } from '@shared/queries/useEmployees';
import { NailistsShowcase } from '@modules/employees/components';

function TestEmployeeList() {
  const { data: employees, isLoading, isError } = useEmployees();

  if (isLoading) return <div>Loading employees…</div>;
  if (isError) return <div>Error loading employees</div>;

  return (
    <ul>
      {employees?.map((emp) => (
        <li key={emp.id}>{emp.displayName}</li>
      ))}
    </ul>
  );
}

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('MSW Query Integration', () => {
  it('intercepts React Query useEmployees and updates UI when data arrives', async () => {
    // Override MSW handler for /api/employees with mock data
    server.use(
      http.get('/api/employees', () => {
        return HttpResponse.json([
          {
            id: 'emp-101',
            displayName: 'Alex Rivers',
            email: 'alex@example.com',
            roleTitle: 'Senior Technician',
            assignedWebsiteIds: ['site-123'],
            serviceIds: [],
            isActive: true,
          },
          {
            id: 'emp-102',
            displayName: 'Sam Taylor',
            email: 'sam@example.com',
            roleTitle: 'Color Specialist',
            assignedWebsiteIds: ['site-123'],
            serviceIds: [],
            isActive: true,
          },
        ]);
      }),
    );

    renderWithQueryClient(<TestEmployeeList />);

    expect(screen.getByText(/Loading employees…/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Alex Rivers')).toBeInTheDocument();
      expect(screen.getByText('Sam Taylor')).toBeInTheDocument();
    });
  });

  it('renders NailistsShowcase and triggers selection from MSW intercepted data', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(<NailistsShowcase onSelect={handleSelect} />);

    // Meet our nail artists
    expect(screen.getByText(/Meet our nail artists/i)).toBeInTheDocument();

    // Clara Oswald comes from default MSW handler in /api/employees/public
    await waitFor(() => {
      expect(screen.getByText('Clara Oswald')).toBeInTheDocument();
      expect(screen.getByText('Lead Nail Artist')).toBeInTheDocument();
    });

    const artistCard = screen.getByRole('button', { name: /Clara Oswald/i });
    await user.click(artistCard);

    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'emp-123',
        displayName: 'Clara Oswald',
      }),
    );
  });

  it('handles query error cleanly when MSW returns 500 status', async () => {
    server.use(
      http.get('/api/employees', () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    renderWithQueryClient(<TestEmployeeList />);

    await waitFor(() => {
      expect(screen.getByText(/Error loading employees/i)).toBeInTheDocument();
    });
  });
});

