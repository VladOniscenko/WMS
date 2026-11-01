import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgendaBookingWidget } from '../components';

const mockService = {
  id: 'srv-gel-manicure',
  name: 'Gel Manicure',
  durationMinutes: 60,
  price: 55,
  currency: 'USD',
};

const mockUser = {
  id: 'user-789',
  email: 'client@example.com',
  roles: ['Customer'],
};

describe('AgendaBookingWidget', () => {
  it('shows prompt banner and disabled state when no artist is selected', () => {
    const handleRequireAuth = vi.fn();

    render(
      <AgendaBookingWidget
        selectedService={mockService}
        selectedResourceId={undefined}
        currentUser={mockUser}
        onRequireAuth={handleRequireAuth}
        businessId="biz-1"
        websiteId="site-1"
      />,
    );

    // Prompt banner
    expect(
      screen.getByText(/Please select a nail artist above to see availability/i),
    ).toBeInTheDocument();

    // Reserve button is disabled
    const reserveButton = screen.getByRole('button', { name: /Reserve Spot/i });
    expect(reserveButton).toBeDisabled();
  });

  it('renders available slot list when artist is selected', async () => {
    const handleRequireAuth = vi.fn();

    render(
      <AgendaBookingWidget
        selectedService={mockService}
        selectedResourceId="emp-123"
        currentUser={mockUser}
        onRequireAuth={handleRequireAuth}
        businessId="biz-1"
        websiteId="site-1"
      />,
    );

    // Wait for MSW slots to load
    await waitFor(() => {
      expect(screen.getByText(/3 slots available/i)).toBeInTheDocument();
    });

    const slotButtons = screen.getAllByRole('button');
    // Ensure we have slot buttons loaded
    expect(slotButtons.length).toBeGreaterThanOrEqual(3);
  });

  it('selects slot and triggers booking call successfully', async () => {
    const user = userEvent.setup();
    const handleRequireAuth = vi.fn();

    render(
      <AgendaBookingWidget
        selectedService={mockService}
        selectedResourceId="emp-123"
        currentUser={mockUser}
        onRequireAuth={handleRequireAuth}
        businessId="biz-1"
        websiteId="site-1"
      />,
    );

    // Wait for slots to appear
    await waitFor(() => {
      expect(screen.getByText(/3 slots available/i)).toBeInTheDocument();
    });

    // Select the first slot button
    const slotButtons = screen.getAllByRole('button', { name: /\d{1,2}:\d{2}/i });
    expect(slotButtons.length).toBeGreaterThan(0);
    await user.click(slotButtons[0]);

    // Reserve Spot button should now be enabled
    const reserveButton = screen.getByRole('button', { name: /Reserve Spot/i });
    expect(reserveButton).toBeEnabled();

    // Click Reserve Spot
    await user.click(reserveButton);

    // Verify confirmation is rendered
    await waitFor(() => {
      expect(screen.getByText(/Booking confirmed!/i)).toBeInTheDocument();
    });
  });

  it('triggers onRequireAuth if user attempts to book while not logged in', async () => {
    const user = userEvent.setup();
    const handleRequireAuth = vi.fn();

    render(
      <AgendaBookingWidget
        selectedService={mockService}
        selectedResourceId="emp-123"
        currentUser={null}
        onRequireAuth={handleRequireAuth}
        businessId="biz-1"
        websiteId="site-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/3 slots available/i)).toBeInTheDocument();
    });

    const slotButtons = screen.getAllByRole('button', { name: /\d{1,2}:\d{2}/i });
    await user.click(slotButtons[0]);

    const reserveButton = screen.getByRole('button', { name: /Reserve Spot/i });
    await user.click(reserveButton);

    expect(handleRequireAuth).toHaveBeenCalledTimes(1);
  });
});

