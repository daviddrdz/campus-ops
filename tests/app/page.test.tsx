import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";
import NotFound from "@/app/not-found";
import Home from "@/app/page";

describe("página de inicio", () => {
  it("explica cómo reportar y enlaza al acceso del personal", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "¿Un equipo del campus falla?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/código QR/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Acceso para personal" }),
    ).toHaveAttribute("href", "/login");
  });
});

describe("pantallas de error", () => {
  it("una dirección desconocida se explica en español", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: "No encontramos esta página" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("un error inesperado ofrece reintentar sin mostrar el detalle", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const retry = vi.fn();
    render(
      <ErrorPage
        error={new Error("detalle interno de la consulta")}
        retry={retry}
      />,
    );

    expect(
      screen.queryByText(/detalle interno de la consulta/),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
