type PrismaErrorShape = {
  code?: unknown;
  meta?: {
    driverAdapterError?: { cause?: { constraint?: { index?: unknown } } };
  };
};

// Con el adaptador de pg, el nombre de la restricción viene en driverAdapterError.
export function violatedConstraint(
  error: unknown,
  code: "P2002" | "P2003",
): string | null {
  const { code: errorCode, meta } = (error ?? {}) as PrismaErrorShape;

  if (errorCode !== code) {
    return null;
  }

  const index = meta?.driverAdapterError?.cause?.constraint?.index;

  return typeof index === "string" ? index : null;
}

export function isRecordNotFound(error: unknown): boolean {
  return (error as PrismaErrorShape | null)?.code === "P2025";
}
