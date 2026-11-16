# Spackhub (Sparkhub)

**Spackhub** es una plataforma web tipo biblioteca/marketplace de prompts de IA. Este repositorio contiene el código fuente de la aplicación (frontend React + backend Express con SQLite).

> Repositorio público. El código es la fuente de verdad: siempre se trabaja con `git clone` / `git pull` / `git push`, no con copias sueltas.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite 8 |
| Estilos | Tailwind CSS 4 (`@tailwindcss/vite`) |
| Iconos / animación | lucide-react, motion |
| Backend | Express 4 + Node.js |
| Base de datos | SQLite (`better-sqlite3`), archivo local `server/data/sparkhub.db` |
| Auth | JWT en cookie `httpOnly` (`jsonwebtoken`, `bcryptjs`) |
| IA (opcional) | `@google/genai` (Gemini). Sin clave, el generador funciona en modo simulado local. |

## Requisitos

- Node.js 20 o superior
- npm

## Instalación

```bash
npm install --legacy-peer-deps
cp .env.example .env     # Windows PowerShell: Copy-Item .env.example .env
```

> `--legacy-peer-deps` es necesario por un conflicto de versiones entre Vite 8 y un plugin de esbuild.

Edita `.env`:

```env
PORT=3000
ADMIN_EMAIL=admin@sparkhub.local
ADMIN_PASSWORD=una-clave-segura
JWT_SECRET=una-cadena-larga-y-aleatoria
GEMINI_API_KEY=
PORTADA_URL=http://127.0.0.1:4321/
```

- **Nunca subas `.env` al repositorio.** Está en `.gitignore`. Cada máquina/entorno usa su propio `.env`.
- `GEMINI_API_KEY` es opcional. En despliegue, las claves van en variables de entorno/Secrets del hosting.
- La cuenta administradora se crea/actualiza al arrancar a partir de `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

## Ejecutar

```bash
npm run build
npm start
```

La app queda en **http://localhost:3000**. La base `server/data/sparkhub.db` se crea automáticamente y se puebla con datos demo idempotentes.

### Desarrollo

En dos terminales:

```bash
npm run dev:api   # Express + API en 3000 (watch)
npm run dev       # Vite en 5173 con proxy /api -> 3000
```

Abre `http://localhost:5173`.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Vite en modo desarrollo (puerto 5173, proxy `/api` a 3000) |
| `npm run dev:api` | Servidor Express con `node --watch` en 3000 |
| `npm run build` | Compila el frontend a `dist/` |
| `npm start` | Sirve API + `dist/` en el puerto configurado |
| `npm run lint` | Verificación de tipos (`tsc --noEmit`) |
| `npm test` | Tests de integración (`node --test tests/`) con base temporal |

## Estructura

```
server/                   Backend Express
  index.js                Punto de entrada, estático, fallback SPA
  db.js, seed.js          Esquema SQLite, migraciones y datos demo
  auth.js, payments.js    Autenticación JWT/cookie y pagos simulados
  routes/                 auth, prompts, library, admin, billing, ai, profile, cart, ...
  apps/                   Apps por rol (marketplace, business, admin)
src/                      Frontend React
  App.tsx, main.tsx       Composición y entrada
  components/, views/     Componentes y pantallas
  context/AuthContext.tsx Sesión de usuario
  lib/api.ts              Cliente de la API
tests/
  integration.test.js     Flujos completos contra servidor real y DB temporal
```

## Apps y roles

| App | Ruta API | Ruta front | Roles |
|---|---|---|---|
| Marketplace | `/api` | `/` | comprador, vendedor |
| Empresa | `/api/business` | `/empresa` | empresario |
| Administración | `/api/admin` | `/admin` | administrador |

## Flujo de trabajo con Git

`main` está protegida: los cambios entran por **Pull Request** (sin force-push, sin borrar la rama).

```bash
git pull origin main
git checkout -b feat/mi-cambio
# ... trabajar ...
git add -A
git commit -m "feat: descripción corta"
git push -u origin feat/mi-cambio
# abrir Pull Request en GitHub
```

### Primera vez en otra PC

```bash
git clone https://github.com/wilderzaca320-commits/spackhub.git
cd spackhub
npm install --legacy-peer-deps
# crear .env con tus valores
npm run dev:api   # y en otra terminal: npm run dev
```

## Seguridad

- `.env`, `node_modules/`, `dist/`, `coverage/`, logs y `server/data/` están ignorados por Git.
- No subas claves API, tokens ni credenciales reales.
- La base SQLite local (`server/data/`) es de desarrollo; no se versiona.
