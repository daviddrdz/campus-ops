import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SUBMIT_FAILED_MESSAGE } from "@/components/forms/use-server-form";
import { ReportForm } from "@/components/reports/report-form";
import type { SubmitReportState } from "@/server/reports/actions";

function renderForm(result: SubmitReportState | Error) {
  const action = vi.fn<
    (
      previous: SubmitReportState,
      formData: FormData,
    ) => Promise<SubmitReportState>
  >(async () => {
    if (result instanceof Error) throw result;

    return result;
  });

  render(
    <ReportForm
      action={action}
      assetHref="/a/codigoprueba"
      notice={<p>Ya hay una falla reportada.</p>}
    />,
  );

  return action;
}

function send() {
  fireEvent.change(screen.getByLabelText("¿Qué le pasa al equipo?"), {
    target: { value: "No enciende" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Enviar reporte" }));
}

describe("ReportForm", () => {
  it("solo pide la descripción: el tipo de falla empieza en «No sé»", () => {
    renderForm({ ok: false });

    expect(screen.getByRole("radio", { name: "No sé" })).toBeChecked();
    expect(screen.getAllByRole("radio")).toHaveLength(6);
    expect(screen.getByText("Ya hay una falla reportada.")).toBeInTheDocument();
  });

  it("oculta el campo trampa a las personas y a los lectores de pantalla", () => {
    renderForm({ ok: false });

    expect(
      screen.queryByRole("textbox", { name: /sitio web/i }),
    ).not.toBeInTheDocument();
  });

  it("al enviar muestra el folio y quita el aviso", async () => {
    const action = renderForm({ ok: true, data: { folio: 42 } });

    send();

    const heading = await screen.findByRole("heading", {
      name: "Reporte enviado",
    });
    // El foco llega en un efecto, después de pintar el encabezado.
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver la ficha del equipo" }),
    ).toHaveAttribute("href", "/a/codigoprueba");
    expect(screen.queryByText("Ya hay una falla reportada.")).toBeNull();

    const formData = action.mock.calls[0]?.[1] as FormData;
    expect(formData.get("description")).toBe("No enciende");
    expect(formData.get("faultType")).toBe("");
  });

  it("muestra los errores sin perder lo escrito", async () => {
    renderForm({
      ok: false,
      fieldErrors: { reporterEmail: "Escribe un correo válido." },
    });

    send();

    expect(
      await screen.findByText("Escribe un correo válido."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Correo")).toHaveFocus();
    expect(screen.getByLabelText("¿Qué le pasa al equipo?")).toHaveValue(
      "No enciende",
    );
  });

  it("sin conexión avisa y conserva lo escrito", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderForm(new TypeError("Failed to fetch"));

    send();

    expect(await screen.findByText(SUBMIT_FAILED_MESSAGE)).toBeInTheDocument();
    expect(screen.getByLabelText("¿Qué le pasa al equipo?")).toHaveValue(
      "No enciende",
    );
    expect(
      screen.getByRole("button", { name: "Enviar reporte" }),
    ).toBeEnabled();
  });
});
