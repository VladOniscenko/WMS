import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@shared/ui/Toast";
import { CanvasPageEditor } from "../CanvasPageEditor";

const mockWebsite = {
  id: "site-123",
  name: "Elegance Nails",
  domainOrSlug: "elegance-nails",
  themeConfig: {
    primaryColor: "#b26c59",
    font: "Inter",
  },
  content: {
    title: "Elegance Nails Studio",
    navigation: {
      brandLabel: "Elegance Nails",
      items: [{ label: "Home", pageSlug: "home" }],
      showBookingButton: true,
    },
  },
};

const defaultProps = {
  websiteId: "site-123",
  websiteName: "Elegance Nails",
  website: mockWebsite,
  onBack: vi.fn(),
};

function renderEditor() {
  return render(
    <ToastProvider>
      <CanvasPageEditor {...defaultProps} />
    </ToastProvider>,
  );
}

describe("CanvasPageEditor", () => {
  it("renders page header, auto-save status, and existing sections", async () => {
    renderEditor();

    // Verify header and page title
    await waitFor(() => {
      const brandElements = screen.getAllByText("Elegance Nails");
      expect(brandElements.length).toBeGreaterThan(0);
      const homeElements = screen.getAllByText("Home");
      expect(homeElements.length).toBeGreaterThan(0);
    });

    // Auto-save initial status
    expect(screen.getByText("All changes saved")).toBeInTheDocument();

    // Verify loaded sections in canvas
    expect(screen.getByText("Welcome to Nail Art Studio")).toBeInTheDocument();
    expect(screen.getByText("Our Services")).toBeInTheDocument();
  });

  it("adds a new block section to the page canvas", async () => {
    const user = userEvent.setup();
    renderEditor();

    await waitFor(() => {
      expect(
        screen.getByText("Welcome to Nail Art Studio"),
      ).toBeInTheDocument();
    });

    // Find and click "Gallery" block in the library
    const addGalleryButton = screen.getByRole("button", { name: /Gallery/i });
    await user.click(addGalleryButton);

    // Verify Gallery section is added to canvas
    await waitFor(() => {
      expect(screen.getByText(/gallery block/i)).toBeInTheDocument();
    });

    // Status changes to Unsaved changes
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("selects a block and moves it down", async () => {
    const user = userEvent.setup();
    renderEditor();

    await waitFor(() => {
      expect(
        screen.getByText("Welcome to Nail Art Studio"),
      ).toBeInTheDocument();
    });

    // Click on the first section to select it
    const heroHeading = screen.getByText("Welcome to Nail Art Studio");
    await user.click(heroHeading);

    // Verify block action bar appears
    const moveDownButton = screen.getByRole("button", {
      name: /Move block down/i,
    });
    expect(moveDownButton).toBeInTheDocument();

    // Move block down
    await user.click(moveDownButton);

    // Status changes to Unsaved changes
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("deletes a block from the page canvas", async () => {
    const user = userEvent.setup();
    renderEditor();

    await waitFor(() => {
      expect(screen.getByText("Our Services")).toBeInTheDocument();
    });

    // Click to select the second block
    const servicesHeading = screen.getByText("Our Services");
    await user.click(servicesHeading);

    // Find and click Delete block button
    const deleteButton = screen.getByRole("button", { name: /Delete block/i });
    await user.click(deleteButton);

    // Block should now be removed from canvas
    await waitFor(() => {
      expect(screen.queryByText("Our Services")).not.toBeInTheDocument();
    });

    // Status updates to unsaved
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("triggers auto-save debounce and updates indicator back to All changes saved", async () => {
    const user = userEvent.setup();
    renderEditor();

    await waitFor(() => {
      expect(
        screen.getByText("Welcome to Nail Art Studio"),
      ).toBeInTheDocument();
    });

    // Add a block to trigger unsaved state
    const addTestimonialBtn = screen.getByRole("button", {
      name: /Testimonials/i,
    });
    await user.click(addTestimonialBtn);

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    // Wait for the 1.5s debounce + auto-save API call to complete
    await waitFor(
      () => {
        expect(screen.getByText("All changes saved")).toBeInTheDocument();
      },
      { timeout: 3500 },
    );
  });
});
