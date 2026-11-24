import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("página de inicio", () => {
  it("muestra el título provisional", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: "Mantenimiento de equipos del campus",
      }),
    ).toBeInTheDocument();
  });
});
