# AGENTS.md — Instrucciones para agentes de IA

Léelo completo antes de tocar código. Este archivo permite que cualquier IA o colaborador continúe el proyecto sin contexto previo.

## Qué es este proyecto

**Spackhub** (app: Sparkhub): biblioteca/marketplace de prompts de IA. Frontend React + backend Express con SQLite. Incluye catálogo, compras con créditos, publicación con cola QA, panel admin, perfiles de empresa, generador IA y mensajería.

## Stack y arquitectura

- **Frontend**: React 19 + TypeScript, Vite 8, Tailwind CSS 4, lucide-react. Entrada `src/main.tsx` / `src/App.tsx`.
- **Backend**: Express 4 en `server/index.js` (ESM, `"type": "module"`). Rutas en `server/routes/`, apps por rol en `server/apps/`.
- **Base de datos**: SQLite con `better-sqlite3` (`server/db.js`, `server/seed.js`). Archivo `server/data/sparkhub.db` (local, **no versionar**). Seeds idempotentes al arrancar.
- **Auth**: JWT en cookie `httpOnly` (`server/auth.js`). Roles: comprador, vendedor, empresario, administrador.
- **IA**: Gemini por API REST con `fetch` (sin SDK). Sin `GEMINI_API_KEY` funciona en modo simulado; el modelo se configura con `GEMINI_MODEL` (por defecto `gemini-2.0-flash`).
- **Puerto**: `3000` por defecto (API + app). En desarrollo Vite corre en `5173` con proxy `/api` → `3000`.

## Comandos

```bash
npm install --legacy-peer-deps   # instalar dependencias
npm run dev:api                  # backend en http://localhost:3000 (watch)
npm run dev                      # frontend en http://localhost:5173
npm run build                    # compilar a dist/
npm run lint                     # tsc --noEmit — ejecutar SIEMPRE antes de terminar
npm test                         # tests de integración (base SQLite temporal)
```

## Reglas para modificar código

1. **Antes de empezar**: `git pull origin main`. Con colaboradores, trabaja en rama `feat/...` o `fix/...` y abre Pull Request (`main` está protegida). El propietario puede hacer commit y push directo a `main` (GitHub le permite el bypass).
2. **Conserva el estilo existente**: TypeScript en frontend, JavaScript en backend. Textos de UI y mensajes de error en **español**.
3. **Backend**: rutas en `server/routes/` bajo `/api/...`. Valida entradas y devuelve errores en español con el status HTTP adecuado. No expongas secretos al cliente.
4. **Base de datos**: cualquier cambio de esquema debe ser una migración idempotente en `server/db.js` (no borres datos existentes). No subas `server/data/*.db*`.
5. **Auth/roles**: respeta `requireAuth` / `requireRole` y el reparto comprador/vendedor/plataforma en compras. No permitas registro de admin desde la interfaz.
6. **Frontend**: componentes en `src/components`, vistas/pantallas en `src/views` o según la estructura actual. Usa el cliente `src/lib/api.ts` para llamadas.

## Seguridad (obligatorio)

- **NUNCA** subas `.env` con claves reales. Solo `.env.example` va al repo.
- No imprimas ni incluyas `GEMINI_API_KEY`, `JWT_SECRET`, contraseñas ni tokens en logs, commits ni código.
- No subas `node_modules/`, `dist/`, `server/data/`, `coverage/`, `*.log` ni backups `.zip`.
- Antes de commit: `git status` no debe mostrar `.env`, `.db`, `.db-wal`, `.db-shm` ni `node_modules`.

## Antes de terminar una tarea

```bash
npm run lint
git status
git add -A
git commit -m "feat|fix|docs|refactor|chore: descripción corta"
git push
```

## Notas

- `--legacy-peer-deps` es necesario al instalar por conflicto Vite 8 / plugin esbuild.
- El puerto 3000 es el de este proyecto; 3100 está reservado para CodeExplain.
- `HOST` (por defecto `127.0.0.1`) permite escuchar en `0.0.0.0` para acceder desde otros equipos de la red local.
- Seeds y tests son idempotentes; los tests usan DB temporal y no tocan `server/data/`.
