# Sparkhub

Marketplace de prompts de IA (estilo PromptBase) con backend real en SQLite.
La app corre en un único servidor Express en **http://localhost:3000** y funciona
sin internet: tipografías e imágenes son locales. La portada de presentación vive
aparte, en el puerto **4321**, y se enlaza desde `/portada`.

## Requisitos

- Node.js 20 o superior (probado con Node 26).
- Windows, macOS o Linux.

## Instalación

```bash
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` es necesario por un conflicto de versiones entre Vite 8 y
> un plugin de esbuild.

## Configuración

1. Copiá el archivo de ejemplo:

   ```bash
   copy .env.example .env        # Windows
   cp .env.example .env          # macOS / Linux
   ```

2. Editá `.env`:

   ```ini
   PORT=3000
   ADMIN_EMAIL=admin@sparkhub.local
   ADMIN_PASSWORD=Admin12345
   JWT_SECRET=cambia-este-secreto-por-una-cadena-larga-y-aleatoria
   GEMINI_API_KEY=
   PORTADA_URL=http://127.0.0.1:4321/
   ```

   - El administrador se crea o actualiza solo al arrancar el servidor.
   - `GEMINI_API_KEY` es opcional: sin clave, el generador responde en modo
     simulado local y sigue descontando 2 créditos.
   - Las claves viven **solo** en el servidor; el navegador nunca las recibe.

## Apps por rol

El servidor es único (`localhost:3000`) pero está dividido en tres apps con
routers y permisos independientes:

| App | Montaje | Roles | Entrada del front |
| --- | --- | --- | --- |
| Marketplace | `/api` | comprador, vendedor | `/` |
| Empresa | `/api/business` | empresario | `/empresa` |
| Administración | `/api/admin` | administrador | `/admin` |

- El registro con `accountType: "corporate"` crea la cuenta como empresario.
- `POST /api/auth/login` y `/register` devuelven `redirect` y el usuario con
  `activeRole`, `roles` y `homePath`; el front navega a esa ruta.
- `PATCH /api/auth/role` cambia el rol activo entre los disponibles y persiste
  en `users.active_role`.
- La cookie de sesión es la misma para las tres apps: no hay CORS ni puertos
  extra. `/api/company` se conserva como alias; la ruta oficial es
  `/api/business/company`.

## Compilar y arrancar

```bash
npm run build
npm start
```

Abrí **http://localhost:3000/**.

- `/portada` redirige (302) a la portada de presentación del puerto 4321.
- La API vive bajo `/api/*`.
- La base se guarda en `server/data/sparkhub.db` (se crea sola y es idempotente).
- Para empezar de cero: detené el servidor y borrá `server/data/sparkhub.db*`
  (el `.db`, `-wal` y `-shm`); al arrancar se recrean el admin y los datos demo.

### Desarrollo con recarga

En dos terminales:

```bash
npm run dev:api     # Express + API en 3000
npm run dev         # Vite en 5173 con proxy /api -> 3000
```

Abrí **http://localhost:5173/**. La sesión sigue funcionando porque las
peticiones a `/api` se reenvían al servidor de 3000.

## Cuentas de prueba

| Rol        | Email                   | Contraseña  |
| ---------- | ----------------------- | ----------- |
| Admin      | `admin@sparkhub.local`  | `Admin12345` |
| Creador    | `neo@sparkhub.local`    | `Demo12345` |
| Creadora   | `atelier@sparkhub.local`| `Demo12345` |
| Comprador  | se crea desde la app    | mínimo 8 caracteres |

Cada usuario nuevo recibe **100 créditos de bienvenida**, registrados en
`credit_transactions`. Nadie puede registrarse como administrador desde la
interfaz: el admin solo nace desde `.env`.

## Qué incluye esta versión (Fase 4)

### Marketplace y compras

- Catálogo con búsqueda, filtros por categoría/modelo, orden y paginación.
- Detalle de fórmula con vista previa, autor, rating, reseñas y variables.
- Compra con créditos: se descuenta al comprador, el vendedor recibe el **90%**
  y la plataforma retiene el **10%**, todo dentro de una transacción SQLite.
- El `masterPrompt` solo se entrega al comprador, al dueño o al admin.
- Biblioteca personal, historial de movimientos y favoritos.
- Reseñas solo para compradores verificados, sin duplicados.

### Venta y control de calidad

- Wizard de publicación con validaciones en español.
- Toda fórmula nueva entra como `pending` a la cola de QA.
- El admin puede aprobar, rechazar o pedir cambios con una nota.
- Panel del creador con ventas, ganancias, retiros y estado de sus fórmulas.

### Planes, pagos y empresa

- Planes Starter / Pro / Enterprise y paquetes de créditos en USD.
- Pasarela de pago simulada (tarjeta de prueba `4242 4242 4242 4242`).
- Perfil de empresa, miembros del equipo y API keys con clave mostrada una vez.
- Encargos a creadores (`/api/hires`).
- Generador de IA con Gemini o mock local; cada generación cuesta 2 créditos.

### Robustez

- Validación de todas las entradas y errores de API **siempre en español**.
- JWT en cookie `httpOnly`, `sameSite=lax`, 7 días; contraseñas con `bcryptjs`.
- Rate limit en registro y login.
- Seeds idempotentes al arrancar: admin + 2 vendedores + **12 prompts demo**
  (9 aprobados, 2 pendientes y 1 rechazado para probar la cola QA).

## Tests de integración

```bash
npm test
```

`tests/integration.test.js` levanta un servidor Express real en un puerto libre,
con una base SQLite temporal (`DB_PATH`), y recorre los flujos completos:

1. Salud, catálogo y redirección `/portada`.
2. Registro, sesión, logout y login con error en español.
3. Búsqueda, filtros, orden y paginación del catálogo.
4. Compra con créditos, desbloqueo del master, biblioteca y movimientos.
5. Favoritos (agregar/quitar).
6. Reseñas: comprador verificado, duplicado y no comprador.
7. Publicación, cola QA, aprobación y rechazo por el admin.
8. Paquete de créditos con tarjeta simulada y tarjeta inválida.
9. Generador mock (2 créditos) e historial.
10. Empresa: perfil, miembro, API key y retiro mínimo.
11. Formato y idioma de los errores de la API.

No toca la base real: usa un archivo temporal que se borra al terminar.

## Cómo probar cada flujo a mano

| Flujo | Pasos |
| ----- | ----- |
| Registro y sesión | Crear cuenta en la app → verificar 100 créditos → cerrar y volver a entrar. |
| Explorar | Buscar "Cyber", filtrar por categoría/modelo, cambiar orden y página. |
| Compra | Abrir una fórmula → comprar → ver créditos descontados, master visible y fórmula en **Mi Biblioteca**. |
| Favoritos | Marcar/desmarcar el corazón → revisar la lista de favoritos. |
| Reseña | Tras comprar, dejar 1–5 estrellas y comentario → aparece en el detalle. |
| Venta | **Vender Prompts** → completar el wizard → ver la fórmula en **Panel Creador** como pendiente. |
| QA admin | Entrar como admin → `/admin` → aprobar/rechazar con nota → la fórmula cambia de estado. |
| Créditos | **Planes** → comprar paquete con `4242 4242 4242 4242` → ver saldo y pago en el historial. |
| Generador | **Generador IA** → describir una escena → ver resultado, costo de 2 créditos e historial. |
| Empresa | **Empresa** → guardar perfil → invitar miembro → crear API key (se muestra una sola vez). |
| Retiro | **Panel Creador** → solicitar retiro (mínimo 10 créditos disponibles). |
| Portada | Abrir `http://localhost:3000/portada` → redirige a `http://127.0.0.1:4321/`. |

## API principal

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/api/health` | Estado del servicio |
| POST | `/api/auth/register` · `/login` · `/logout` | Sesión |
| GET | `/api/auth/me` | Usuario actual |
| PATCH | `/api/auth/role` | Cambia el rol activo persistido |
| GET | `/api/business` · `/api/admin/status` | Estado de las apps por rol |
| GET | `/api/prompts` | Catálogo con `search`, `category`, `model`, `sort`, `page`, `limit` |
| GET | `/api/prompts/catalog` | Categorías, modelos e imágenes disponibles |
| GET | `/api/prompts/:id` | Detalle + reseñas (master oculto si no corresponde) |
| POST | `/api/prompts` | Publicar fórmula (queda `pending`) |
| POST | `/api/prompts/:id/purchase` | Comprar con créditos |
| POST | `/api/prompts/:id/favorite` | Alternar favorito |
| POST | `/api/prompts/:id/reviews` | Reseñar (solo comprador) |
| GET | `/api/prompts/mine` · `/favorites` | Fórmulas propias y favoritas |
| GET | `/api/library` · `/transactions` | Biblioteca y movimientos |
| GET | `/api/admin/stats` · `/qa` · `/users` | Panel admin |
| POST | `/api/admin/qa/:id/review` | Aprobar, rechazar o pedir cambios |
| GET | `/api/billing` · `/payments` | Planes, paquetes e historial de pagos |
| POST | `/api/billing/credits` · `/plan` | Comprar créditos o activar plan |
| POST | `/api/ai/generate` | Generar con Gemini o mock (2 créditos) |
| GET | `/api/ai/history` | Historial de generaciones |
| GET/PATCH | `/api/profile` · `/dashboard` | Perfil y métricas del creador |
| POST | `/api/profile/withdraw` | Solicitar retiro |
| GET/PUT | `/api/company` | Perfil de empresa |
| GET/POST | `/api/company/members` · `/keys` | Equipo y API keys |
| GET/POST | `/api/creators` · `/api/hires` | Creadores y encargos |

## Scripts

| Script            | Qué hace                                              |
| ----------------- | ----------------------------------------------------- |
| `npm run dev`     | Vite en 5173 (proxy `/api` a 3000)                    |
| `npm run dev:api` | Express con `node --watch` en 3000                    |
| `npm run build`   | Compila el front a `dist/`                            |
| `npm start`       | Servidor principal: API + `dist/` en 3000             |
| `npm run lint`    | TypeScript sin emitir                                 |
| `npm test`        | Tests de integración con base temporal                |

## Estructura

```text
server/
  index.js          Express: API, estático, fallback SPA y /portada
  db.js             SQLite, esquema, migraciones y seed del administrador
  seed.js           Datos demo idempotentes (vendedores, 12 prompts, ventas)
  auth.js           JWT, cookie httpOnly, requireAuth / requireRole
  catalog.js        Categorías, modelos, planes y paquetes
  payments.js       Pasarela de pago simulada
  routes/           auth, prompts, library, admin, billing, ai,
                    profile, company, creators, hires
  data/             Base SQLite (no versionar)
tests/
  integration.test.js   Flujos completos contra un servidor real
src/
  context/AuthContext.tsx   Sesión y usuario en el front
  lib/api.ts                Cliente de la API
  components/               Vistas y modales de la app
  components/Guards.tsx     RutaPrivada y RutaAdmin
```

## Cabecera, portada y tienda

La cabecera tiene dos filas: la superior con buscador (`/` como atajo), mensajes,
campana, carrito, avatar y Sparkhub Select; la inferior con las 9 categorías
reales ordenadas como PromptBase. En móvil la barra de categorías se desplaza
horizontalmente y el mega-menú muestra las subcategorías con sus contadores.

La portada se calcula 100% desde SQLite (`GET /api/home`): total de fórmulas,
usuarios, usuarios en línea (latido de presencia de 5 minutos), rating y reseñas
reales, términos buscados en los últimos 7 días y 3 fórmulas destacadas.

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/api/home` | Métricas reales de la portada, tendencias y 3 destacados |
| GET | `/api/categories` | Árbol de 9 categorías con subcategorías y contadores |
| GET | `/api/prompts?category=arte&sub=ilustracion-digital` | Filtro por categoría y subcategoría |
| GET/POST/DELETE | `/api/cart` | Ver, agregar y quitar fórmulas del carrito |
| POST | `/api/cart/checkout` | Comprar todo el carrito en una transacción (90/10) |
| GET | `/api/notifications` | Bandeja de notificaciones y contador sin leer |
| PATCH/POST | `/api/notifications/:id/read` · `/read-all` | Marcar leídas |
| GET/POST | `/api/messages` | Conversaciones y envío de mensajes |
| GET | `/api/messages/:userId` | Hilo con un usuario y marcado de leídos |
| GET/POST/DELETE | `/api/select` | Estado, alta y cancelación de Sparkhub Select |
| GET | `/api/search/suggest?q=...` | Sugerencias reales de fórmulas y categorías |
| GET | `/api/search/trending` | Términos más buscados en 7 días |
| POST/GET | `/api/presence` | Latido del usuario y usuarios en línea |

### Ejemplos con `curl`

```bash
# Portada real
curl http://localhost:3000/api/home

# Categorías y subcategorías con contadores
curl http://localhost:3000/api/categories

# Catálogo filtrado por categoría y subcategoría
curl "http://localhost:3000/api/prompts?category=arte&sub=ilustracion-digital&limit=12"

# Login guardando la cookie de sesión
curl -c cookies.txt -H "Content-Type: application/json" \
  -d "{\"email\":\"neo@sparkhub.local\",\"password\":\"Demo12345\"}" \
  http://localhost:3000/api/auth/login

# Carrito: agregar, ver y comprar
curl -b cookies.txt -H "Content-Type: application/json" -d "{\"promptId\":10}" \
  http://localhost:3000/api/cart
curl -b cookies.txt http://localhost:3000/api/cart
curl -b cookies.txt -X POST http://localhost:3000/api/cart/checkout

# Notificaciones y mensajes
curl -b cookies.txt http://localhost:3000/api/notifications
curl -b cookies.txt http://localhost:3000/api/messages

# Presencia y usuarios en línea
curl -b cookies.txt -X POST -H "Content-Type: application/json" -d "{}" \
  http://localhost:3000/api/presence
curl http://localhost:3000/api/presence
```

### Checklist de verificación

- [x] `npm run lint` sin errores de TypeScript.
- [x] `npm run build` compila el front en `dist/`.
- [x] `npm test` pasa los 13 tests de integración con base temporal.
- [x] `/api/health`, `/api/home` y `/api/categories` responden en 3000.
- [x] La cabecera muestra el buscador, badges reales y el Select degradado.
- [x] Las 9 categorías respetan el orden solicitado y sus contadores son reales.
- [x] `/categoria/:slug` lista fórmulas y filtra por subcategoría.
- [x] El carrito agrega, quita y compra con reparto 90% vendedor / 10% plataforma.
- [x] El checkout genera notificaciones de compra y venta.
- [x] La campana, el contador de mensajes y el carrito se actualizan sin recargar.
- [x] El master prompt permanece oculto hasta comprar o ser dueño/admin.

## Notas

- La portada del 4321 es solo presentación; toda la app vive en 3000.
- `bcryptjs`, `better-sqlite3`, `jsonwebtoken`, `express` y `dotenv` son
  dependencias del servidor; no se ejecutan en el navegador.
- Si `npm start` no encuentra `dist/`, ejecutá `npm run build` primero.

## Flujo de trabajo con Git

El repositorio es público y `main` está protegida: los cambios de colaboradores
entran por **Pull Request** (sin force-push y sin borrar la rama). El propietario
puede hacer push directo cuando lo necesite.

```bash
git pull origin main
git checkout -b feat/mi-cambio
# ... trabajar ...
git add -A
git commit -m "feat: descripción corta"
git push -u origin feat/mi-cambio
# abrir el Pull Request en GitHub
```

### Primera vez en otra PC

```bash
git clone https://github.com/wilderzaca320-commits/spackhub.git
cd spackhub
npm install --legacy-peer-deps
Copy-Item .env.example .env     # PowerShell (cp en macOS/Linux)
# editar .env con tus valores
npm run dev:api                 # y en otra terminal: npm run dev
```

### Seguridad del repositorio

- `.env`, `node_modules/`, `dist/`, `coverage/`, `*.log` y `server/data/` están
  ignorados por Git.
- Nunca subas claves API, tokens ni contraseñas reales; cada equipo usa su
  propio `.env`.
- La base SQLite local (`server/data/`) es de desarrollo y no se versiona.
