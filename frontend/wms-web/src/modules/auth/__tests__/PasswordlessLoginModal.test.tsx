import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '@shared/auth/AuthProvider';
import { PasswordlessLoginForm, PasswordlessLoginModal } from '../components';

describe('PasswordlessLoginModal and LoginForm', () => {
  it('renders modal with dialog role', () => {
    render(
      <AuthProvider>
        <PasswordlessLoginModal onClose={vi.fn()} />
      </AuthProvider>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Sign in to book/i })).toBeInTheDocument();
  });

  it('renders email input and successfully requests OTP', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <PasswordlessLoginForm />
      </AuthProvider>,
    );

    const emailInput = screen.getByLabelText(/Email/i);
    const sendButton = screen.getByRole('button', { name: /Send Login Code/i });

    await user.type(emailInput, 'user@example.com');
    await user.click(sendButton);

    // Transitions to OTP screen
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Enter your login code/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/Code sent to user@example\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/Development code:/i)).toBeInTheDocument();
    expect(screen.getByText('123456')).toBeInTheDocument();
  });

  it('handles OTP auto-advance when typing digits', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <PasswordlessLoginForm />
      </AuthProvider>,
    );

    await user.type(screen.getByLabelText(/Email/i), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /Send Login Code/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('Digit 1')).toBeInTheDocument();
    });

    const digit1 = screen.getByLabelText('Digit 1');
    const digit2 = screen.getByLabelText('Digit 2');

    digit1.focus();
    await user.type(digit1, '1');

    // Focus automatically advances to digit 2
    expect(document.activeElement).toBe(digit2);
  });

  it('handles 6-digit paste into OTP inputs and enables submit button', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <PasswordlessLoginForm />
      </AuthProvider>,
    );

    await user.type(screen.getByLabelText(/Email/i), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /Send Login Code/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('Digit 1')).toBeInTheDocument();
    });

    const verifyButton = screen.getByRole('button', { name: /Verify & Continue/i });
    expect(verifyButton).toBeDisabled();

    // Paste 6 digits into digit 1 input
    const digit1 = screen.getByLabelText('Digit 1');
    fireEvent.paste(digit1, {
      clipboardData: {
        getData: (type: string) => (type === 'text' ? '123456' : ''),
      },
    });

    expect(screen.getByLabelText('Digit 1')).toHaveValue('1');
    expect(screen.getByLabelText('Digit 2')).toHaveValue('2');
    expect(screen.getByLabelText('Digit 3')).toHaveValue('3');
    expect(screen.getByLabelText('Digit 4')).toHaveValue('4');
    expect(screen.getByLabelText('Digit 5')).toHaveValue('5');
    expect(screen.getByLabelText('Digit 6')).toHaveValue('6');

    expect(verifyButton).toBeEnabled();
  });

  it('renders error state on invalid code submission', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <PasswordlessLoginForm />
      </AuthProvider>,
    );

    await user.type(screen.getByLabelText(/Email/i), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /Send Login Code/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('Digit 1')).toBeInTheDocument();
    });

    // Paste invalid code '999999'
    const digit1 = screen.getByLabelText('Digit 1');
    fireEvent.paste(digit1, {
      clipboardData: {
        getData: (type: string) => (type === 'text' ? '999999' : ''),
      },
    });

    const verifyButton = screen.getByRole('button', { name: /Verify & Continue/i });
    await user.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/That code is invalid or expired/i);
    });
  });

  it('successfully verifies valid code and calls onAuthenticated and onClose', async () => {
    const user = userEvent.setup();
    const handleAuthenticated = vi.fn();
    const handleClose = vi.fn();

    render(
      <AuthProvider>
        <PasswordlessLoginForm
          onAuthenticated={handleAuthenticated}
          onClose={handleClose}
        />
      </AuthProvider>,
    );

    await user.type(screen.getByLabelText(/Email/i), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /Send Login Code/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('Digit 1')).toBeInTheDocument();
    });

    // Paste valid development code '123456'
    const digit1 = screen.getByLabelText('Digit 1');
    fireEvent.paste(digit1, {
      clipboardData: {
        getData: (type: string) => (type === 'text' ? '123456' : ''),
      },
    });

    const verifyButton = screen.getByRole('button', { name: /Verify & Continue/i });
    await user.click(verifyButton);

    await waitFor(() => {
      expect(handleAuthenticated).toHaveBeenCalledTimes(1);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});

