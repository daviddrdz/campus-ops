import "dotenv/config";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const DEV_DATABASE = "campusops_dev";

const url = URL.parse(process.env.DATABASE_URL ?? "");
const database = url?.pathname.slice(1);

if (!url || !LOCAL_HOSTS.has(url.hostname) || database !== DEV_DATABASE) {
  console.error(
    `db:reset solo se permite contra ${DEV_DATABASE} en este equipo. Revisa DATABASE_URL.`,
  );
  process.exit(1);
}
