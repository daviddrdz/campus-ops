import { hashPassword } from "better-auth/crypto";
import type { PrismaClient } from "../src/generated/prisma/client";
import type { AssetType, UserRole } from "../src/generated/prisma/enums";
import { generatePublicCode } from "../src/lib/public-code";

const users: { name: string; email: string; role: UserRole }[] = [
  { name: "Admin Demo", email: "admin@campusops.test", role: "ADMIN" },
  {
    name: "Técnico Demo 1",
    email: "tecnico1@campusops.test",
    role: "TECHNICIAN",
  },
  {
    name: "Técnico Demo 2",
    email: "tecnico2@campusops.test",
    role: "TECHNICIAN",
  },
  {
    name: "Administrativo Demo",
    email: "administrativo@campusops.test",
    role: "STAFF",
  },
];

const locations = [
  { building: "Edificio A", room: "Laboratorio de Cómputo 1" },
  { building: "Edificio A", room: "Aula 101" },
  { building: "Edificio B", room: "Laboratorio de Electrónica" },
  { building: "Biblioteca", room: "Sala de Consulta" },
];

const assets: {
  inventoryNumber: string;
  name: string;
  type: AssetType;
  brand: string;
  model: string;
  serialNumber: string;
  specifications: string;
  location: (typeof locations)[number];
}[] = [
  {
    inventoryNumber: "INV-0001",
    name: "PC de laboratorio 01",
    type: "COMPUTER",
    brand: "Dell",
    model: "OptiPlex 7010",
    serialNumber: "DEMO-SN-0001",
    specifications: "Intel Core i5, 16 GB RAM, SSD de 512 GB",
    location: locations[0],
  },
  {
    inventoryNumber: "INV-0002",
    name: "PC de laboratorio 02",
    type: "COMPUTER",
    brand: "HP",
    model: "ProDesk 400",
    serialNumber: "DEMO-SN-0002",
    specifications: "Intel Core i5, 8 GB RAM, SSD de 256 GB",
    location: locations[0],
  },
  {
    inventoryNumber: "INV-0003",
    name: "Proyector del aula 101",
    type: "PROJECTOR",
    brand: "Epson",
    model: "PowerLite X49",
    serialNumber: "DEMO-SN-0003",
    specifications: "3600 lúmenes, XGA, HDMI y VGA",
    location: locations[1],
  },
  {
    inventoryNumber: "INV-0004",
    name: "Pantalla del aula 101",
    type: "DISPLAY",
    brand: "Samsung",
    model: "QM55",
    serialNumber: "DEMO-SN-0004",
    specifications: "55 pulgadas, 4K, HDMI",
    location: locations[1],
  },
  {
    inventoryNumber: "INV-0005",
    name: "Osciloscopio digital",
    type: "LAB_EQUIPMENT",
    brand: "Tektronix",
    model: "TBS1052C",
    serialNumber: "DEMO-SN-0005",
    specifications: "50 MHz, 2 canales",
    location: locations[2],
  },
  {
    inventoryNumber: "INV-0006",
    name: "PC de consulta",
    type: "COMPUTER",
    brand: "Lenovo",
    model: "ThinkCentre M70",
    serialNumber: "DEMO-SN-0006",
    specifications: "Intel Core i3, 8 GB RAM, SSD de 256 GB",
    location: locations[3],
  },
];

export async function seedDatabase(
  prisma: PrismaClient,
  { userPassword }: { userPassword: string },
) {
  for (const user of users) {
    const { id: userId } = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role },
      create: { ...user, emailVerified: true },
      select: { id: true },
    });
    const password = await hashPassword(userPassword);

    await prisma.account.upsert({
      where: {
        providerId_accountId: { providerId: "credential", accountId: userId },
      },
      update: { password },
      create: { providerId: "credential", accountId: userId, userId, password },
    });
  }

  for (const location of locations) {
    await prisma.location.upsert({
      where: { building_room: location },
      update: {},
      create: location,
    });
  }

  for (const { location, ...asset } of assets) {
    const { id: locationId } = await prisma.location.findUniqueOrThrow({
      where: { building_room: location },
      select: { id: true },
    });

    // publicCode y status no se actualizan: los QR y el estado derivado deben conservarse.
    await prisma.asset.upsert({
      where: { inventoryNumber: asset.inventoryNumber },
      update: { ...asset, locationId },
      create: { ...asset, locationId, publicCode: generatePublicCode() },
    });
  }
}
