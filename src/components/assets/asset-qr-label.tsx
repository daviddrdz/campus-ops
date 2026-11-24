type AssetQrLabelProps = {
  name: string;
  building: string;
  room: string;
  publicCode: string;
  qrSvg: string;
};

export function AssetQrLabel({
  name,
  building,
  room,
  publicCode,
  qrSvg,
}: AssetQrLabelProps) {
  return (
    <figure className="asset-label">
      {/* El SVG lo genera `qrcode` en el servidor y no contiene texto del usuario. */}
      <div
        role="img"
        aria-label={`Código QR de ${name}`}
        className="asset-label-qr"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <figcaption className="mt-3 space-y-0.5">
        <p className="font-heading text-xl leading-tight font-semibold wrap-anywhere">
          {name}
        </p>
        <p className="text-sm wrap-anywhere">
          {building}, {room}
        </p>
        <p className="pt-1 text-sm font-medium tabular-nums">{publicCode}</p>
        <p className="pt-1 text-xs">
          Escanea para ver el equipo o reportar una falla.
        </p>
      </figcaption>
    </figure>
  );
}
