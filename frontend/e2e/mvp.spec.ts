import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
const password = process.env.E2E_PASSWORD!;

async function login(page: Page) {
  await page.goto("/login");
  await page
    .getByLabel("Correo electrónico", { exact: true })
    .fill(process.env.E2E_ORGANIZER_EMAIL!);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(page).toHaveURL(/explore/);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
async function openNavigation(page: Page) {
  const menu = page.getByRole("button", { name: "Abrir menú", exact: true });
  if (await menu.isVisible()) await menu.click();
}

test("descubrimiento, búsqueda real, categorías y estado vacío", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Los mejores planes",
  );
  await expect(
    page.getByRole("heading", { name: "Ideas que nos conectan", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.getByRole("link", { name: "Encuentra tu próximo plan" }).click();
  await page.getByRole("button", { name: "Música", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Una tarde, muchas canciones",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ideas que nos conectan", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Todos los planes" }).click();
  await page.getByRole("searchbox").fill("no-existe-este-evento");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "No encontramos eventos con esos filtros",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Limpiar filtros" }).click();
  await expect(
    page.getByRole("heading", { name: "Ideas que nos conectan", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  expect(errors).toEqual([]);
  mkdirSync(resolve("../docs/evidencias"), { recursive: true });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Ideas que nos conectan", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(`../docs/evidencias/inicio-${info.project.name}.png`),
    fullPage: true,
  });
});

test("registro, inscripción, cupos, sesión renovada y cierre", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/explore");
  await page
    .getByRole("link", { name: "Ideas que nos conectan", exact: true })
    .click();
  const eventUrl = page.url();
  await expect(
    page.getByRole("heading", { name: "De qué se trata" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Inicia sesión para inscribirte" })
    .click();
  await page
    .getByRole("link", { name: "Crea una cuenta", exact: true })
    .click();
  await page
    .getByLabel("Tu nombre", { exact: true })
    .fill("Participante de navegador");
  await page
    .getByLabel("Correo electrónico", { exact: true })
    .fill(`participant-${info.project.name}-${Date.now()}@e2e.example.test`);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Mostrar contraseña" }).click();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Ocultar contraseña" }).click();
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page).toHaveURL(eventUrl);
  const initial = Number(
    await page.locator(".capacity-line strong").textContent(),
  );
  await page.getByRole("button", { name: "Inscribirme", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Inscripción confirmada",
  );
  await expect(page.locator(".capacity-line strong")).toHaveText(
    String(initial - 1),
  );
  await expect(
    page.getByRole("link", { name: "Ver mi inscripción" }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: resolve(`../docs/evidencias/detalle-${info.project.name}.png`),
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Ver mi inscripción" }),
  ).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  await page.getByRole("link", { name: "Ver mi inscripción" }).click();
  await expect(page.getByText(/Confirmada · #/)).toHaveCount(1);
  await openNavigation(page);
  await expect(
    page.getByRole("link", { name: "Mis eventos", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(page).toHaveURL("/");
  await page.goto("/registrations");
  await expect(page).toHaveURL(/login\?next/);
  expect(errors).toEqual([]);
});

test("organizador crea, confirma publicación y edita con persistencia", async ({
  page,
}, info) => {
  await login(page);
  await openNavigation(page);
  await page.getByRole("link", { name: "Mis eventos", exact: true }).click();
  await page.getByRole("link", { name: "Crear evento", exact: true }).click();
  const title = `Encuentro ${info.project.name} ${Date.now()}`;
  await page.getByLabel("Nombre del evento", { exact: true }).fill(title);
  await page
    .getByLabel("Descripción", { exact: true })
    .fill("Un encuentro real de prueba guardado en PostgreSQL.");
  await page.getByLabel("Categoría", { exact: true }).selectOption("community");
  const future =
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) + "T18:00";
  await page.getByLabel("Fecha y hora", { exact: true }).fill(future);
  await page.getByLabel("Ciudad", { exact: true }).fill("Antigua Guatemala");
  await page
    .getByLabel("Lugar o dirección", { exact: true })
    .fill("Plaza de prueba");
  await page.getByLabel("Capacidad máxima", { exact: true }).fill("12");
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tu borrador está listo." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Ir a mis eventos" }).click();
  let row = page.getByRole("row").filter({ hasText: title });
  await expect(row).toContainText("Borrador");
  await row.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Publicar evento", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(row).toContainText("Publicado");
  await row.getByRole("link", { name: "Editar", exact: true }).click();
  await expect(
    page.getByLabel("Nombre del evento", { exact: true }),
  ).toHaveValue(title);
  await page
    .getByLabel("Nombre del evento", { exact: true })
    .fill(title + " actualizado");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cambios guardados." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Ir a mis eventos" }).click();
  row = page.getByRole("row").filter({ hasText: title + " actualizado" });
  await expect(row).toContainText("12");
  await noOverflow(page);
  await page.screenshot({
    path: resolve(`../docs/evidencias/gestion-${info.project.name}.png`),
    fullPage: true,
  });
  await row
    .getByRole("link", { name: title + " actualizado", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: title + " actualizado", exact: true }),
  ).toBeVisible();
});

test("errores reales de formulario y credenciales", async ({ page }) => {
  await page.goto("/login");
  await page
    .getByLabel("Correo electrónico", { exact: true })
    .fill("unknown@e2e.example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("invalid-password");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText(
    "Correo o contraseña incorrectos.",
  );
  await page.goto("/register");
  await page.getByLabel("Tu nombre", { exact: true }).fill("Otra cuenta");
  await page
    .getByLabel("Correo electrónico", { exact: true })
    .fill(process.env.E2E_ORGANIZER_EMAIL!);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(
    page.getByText("Ya existe una cuenta con este correo."),
  ).toBeVisible();
  await expect(
    page.getByLabel("Correo electrónico", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await noOverflow(page);
});

test("estados de carga y error de API con recuperación", async ({ page }) => {
  await page.route("**/api/events/?**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "No pudimos cargar los eventos." }),
    });
  });
  await page.goto("/explore");
  await expect(page.getByRole("status")).toContainText(
    "Buscando buenos planes",
  );
  await expect(page.getByRole("alert")).toContainText(
    "No pudimos cargar los eventos",
  );
  await page.unroute("**/api/events/?**");
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ideas que nos conectan", exact: true }),
  ).toBeVisible();
});

test("confirmación de abandono, Escape y navegación por teclado", async ({
  page,
}) => {
  await login(page);
  await page.goto("/manage/new");
  await page
    .getByLabel("Nombre del evento", { exact: true })
    .fill("Cambios sin guardar");
  await page.getByRole("link", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByLabel("Nombre del evento", { exact: true }),
  ).toHaveValue("Cambios sin guardar");
  await page.getByRole("link", { name: "Cancelar", exact: true }).click();
  await page
    .getByRole("button", { name: "Salir sin guardar", exact: true })
    .click();
  await expect(page).toHaveURL("/manage");
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Saltar al contenido" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});
