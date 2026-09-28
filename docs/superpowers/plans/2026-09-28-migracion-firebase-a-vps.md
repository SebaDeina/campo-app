# Migración Firebase → VPS Nimbo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sacar campo-app de Firebase (Firestore + Auth) y Vercel, sirviéndola desde el VPS de Nimbo en `https://campo.nimbodata.com`, sin perder ningún dato.

**Architecture:** Un único servicio Node (Express) en Docker que sirve la API y el build de Vite. Los datos viven en SQLite (`node:sqlite`, WAL) como documentos JSON por colección, conservando los IDs de Firestore y los UIDs de Firebase; cada documento importado guarda además su representación cruda de Firestore. El frontend reemplaza `firebase/firestore` por un shim con la misma API (`src/lib/db.js`) y `firebase/auth` por un cliente de la API propia (`src/lib/api.js`). Caddy (ya instalado en el VPS) termina TLS y hace reverse proxy a `127.0.0.1:3600`.

**Tech Stack:** Node 24, Express 5, `node:sqlite`, Resend, Vitest + Supertest, React 18 + Vite 5, Docker Compose, Caddy.

**Spec:** diseño aprobado en la conversación del 2026-09-28 (resumen en la memoria `firebase-to-vps-migration`). Cambio respecto del diseño: SQLite en lugar de Postgres (escala: 301 docs / 9 usuarios; sin Docker local para tests; backup = un archivo).

## Global Constraints

- **Ningún dato se pierde.** El import es verificable: conteo por colección + igualdad profunda doc por doc entre `decode(raw)` y `data`. Si la verificación falla, el import hace rollback.
- IDs: se conservan los IDs de documento de Firestore y los UIDs de Firebase Auth como claves primarias.
- Firebase queda intacto (solo lectura tras el corte) como respaldo 30 días. Ningún paso borra datos de Firebase.
- Secretos (`FIREBASE_SCRYPT_*`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `SESSION_SECRET`) solo en `/opt/campo/.env` (600) en el VPS y en `server/.env` local (gitignored). Nunca en el repo ni en el chat.
- El backup `~/nimbo-backups/*` contiene hashes de contraseñas: nunca se copia al repo.
- Puerto en el VPS: `127.0.0.1:3600` (libre al 2026-09-28). Directorio: `/opt/campo`.
- Cambios sin commitear del usuario en `Dashboard.jsx`, `Ovejas.jsx`, `Login.jsx`, `Header.jsx`: no se pisan; los commits agregan solo archivos propios (`git add <paths>`).
- Roles de campo: `owner`, `editor`, `viewer` (viewer = solo lectura).
- Aprobación: usuario aprobado si `users/{uid}.isApproved === true` **o** es miembro de algún campo. Admins por env `ADMIN_EMAILS`.

---

## File Structure

```
server/
  package.json            deps del backend (express, resend) + vitest/supertest
  src/
    app.js                createApp({db, config}) → Express app (sin listen)
    index.js              lee env, abre DB, listen
    config.js             parseo/validación de env
    db.js                 openDb(path) + migraciones de schema
    codec.js              Firestore REST value ⇄ JSON etiquetado ({__t:'ts',v:iso})
    passwords.js          verifyFirebaseScrypt, hashPassword, verifyPassword
    sessions.js           crear/leer/borrar sesiones (cookie campo_sid)
    access.js             membresía, rol, aprobación
    docs-query.js         filtros/orden estilo Firestore sobre docs en memoria
    routes/auth.js        signup, login, logout, me, google, reset
    routes/db.js          API genérica para ovejas/ovejaHistorial/lluvias/tareas
    routes/campos.js      campos, miembros, invitaciones
    routes/admin.js       listado y aprobación de usuarios
    mail.js               Resend (bienvenida, reset)
  scripts/
    import-firestore.js   import + verificación (idempotente, --replace)
  test/*.test.js
src/lib/api.js            fetch wrapper (credentials: 'include')
src/lib/db.js             shim de la API de Firestore usada por las páginas
src/firebase/*            AuthContext/CampoContext pasan a usar la API propia
deploy/
  Dockerfile              build Vite + runtime Node
  docker-compose.yml      servicio `campo`, volumen ./data
  Caddyfile.campo         bloque para /etc/caddy/Caddyfile
  deploy.sh               rsync + build + up en el VPS
  backup.sh               sqlite .backup diario, retiene 14 días
```

## Schema (SQLite)

```sql
CREATE TABLE docs (
  collection TEXT NOT NULL,
  id         TEXT NOT NULL,
  data       TEXT NOT NULL,              -- JSON etiquetado
  raw        TEXT,                       -- documento original de Firestore (REST), solo importados
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  campo_id   TEXT GENERATED ALWAYS AS (json_extract(data,'$.campoId')) VIRTUAL,
  PRIMARY KEY (collection, id)
);
CREATE INDEX docs_campo ON docs(collection, campo_id);
CREATE TABLE auth_accounts (
  uid TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_algo TEXT, password_hash TEXT, password_salt TEXT,
  google_sub TEXT UNIQUE, display_name TEXT, email_verified INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_login_at TEXT,
  firebase_raw TEXT
);
CREATE TABLE sessions (id_hash TEXT PRIMARY KEY, uid TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE password_resets (token_hash TEXT PRIMARY KEY, uid TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT);
```

---

### Task 1: Base del servidor — codec, DB, contraseñas

**Files:** Create `server/package.json`, `server/src/{codec,db,passwords}.js`, `server/test/{codec,passwords,db}.test.js`

**Produces:** `decodeFields(fields) → object`, `decodeValue(v)`, `encodeForJson(value)`; `openDb(path) → DatabaseSync` con schema aplicado; `verifyFirebaseScrypt({password, salt, hash, cfg}) → bool`, `hashPassword(pw) → {algo:'scrypt', hash}` (formato `N$r$p$salt$hash`), `verifyPassword(account, pw, cfg) → {ok, needsRehash}`.

- [ ] Tests del codec: timestampValue → `{__t:'ts', v}`, integerValue → number, doubleValue, mapValue/arrayValue anidados, nullValue, referenceValue/geoPointValue/bytesValue preservados etiquetados.
- [ ] Test de Firebase scrypt con el vector público de `firebase/scrypt` (password `user1password`, salt `42xEC+ixf3L2lw==`, signer key del README, separator `Bw==`, rounds 8, memCost 14).
- [ ] Implementar; `npx vitest run` en verde; commit.

### Task 2: Import + verificación

**Files:** Create `server/scripts/import-firestore.js`, `server/test/import.test.js`

**Consumes:** `openDb`, `decodeFields`. **Produces:** `importBackup(db, {firestore, authUsers}, {replace}) → report`, `verifyImport(db, backup) → {ok, problems[]}`.

- [ ] Test con un backup sintético: conteos, igualdad profunda, re-ejecución idempotente, `--replace` borra lo previo, un doc alterado hace fallar `verifyImport`.
- [ ] Implementar dentro de una transacción (rollback si la verificación falla).
- [ ] Correr contra el backup real `~/nimbo-backups/<ts>/` en una DB temporal: 301 docs, 9 cuentas, verificación OK. Commit.

### Task 3: Auth — sesiones, email/clave, Google OAuth, reset, aprobación

**Files:** Create `server/src/{config,sessions,access,mail,app,index}.js`, `server/src/routes/{auth,admin}.js`, tests.

**Produces (HTTP):**
- `POST /api/auth/signup {email,password,displayName}` → crea cuenta + `users/{uid}` (`isApproved:false`) + mail bienvenida.
- `POST /api/auth/login {email,password}` → cookie; re-hashea si venía de Firebase.
- `POST /api/auth/logout`, `GET /api/auth/me` → `{uid,email,displayName,isApproved,isAdmin}` o 401.
- `PATCH /api/auth/me {displayName}`.
- `GET /api/auth/google` → redirect a Google (state + PKCE en cookie); `GET /api/auth/google/callback` → vincula por `google_sub` o email verificado; crea cuenta si no existe.
- `POST /api/auth/reset {email}` (siempre 200) y `POST /api/auth/reset/confirm {token,password}`.
- `GET /api/admin/users`, `POST /api/admin/users/:uid/approve` (solo admins).

- [ ] Tests con Supertest: login con hash Firebase, rehash, sesión inválida, aprobación por membresía, admin-only, callback de Google con `fetch` mockeado.
- [ ] Implementar; commit.

### Task 4: API de datos — genérica + campos/invitaciones

**Files:** Create `server/src/{docs-query}.js`, `server/src/routes/{db,campos}.js`, tests.

**Produces (HTTP):**
- `POST /api/db/query {collection, where:[[path,op,value]], orderBy:[[path,dir]]}` — exige `where campoId ==` de un campo del usuario.
- `POST /api/db/:collection` (add), `PUT /api/db/:collection/:id` (set), `PATCH /api/db/:collection/:id` (update con paths con punto), `DELETE /api/db/:collection/:id`, `POST /api/db/batch {ops}` — colecciones permitidas: `ovejas, ovejaHistorial, lluvias, tareas`; escritura requiere rol owner/editor; `campoId` inmutable.
- `GET /api/campos`, `POST /api/campos {nombre}`, `PATCH /api/campos/:id/miembros/:uid {rol}`, `DELETE /api/campos/:id/miembros/:uid`, `POST /api/campos/:id/invitaciones {email,rol}`, `GET /api/invitaciones`, `POST /api/invitaciones/:id/{accept,reject}`.
- Sentinel `{__t:'serverTs'}` → timestamp del servidor. Sentinels de update: `{__t:'arrayUnion'|'arrayRemove'|'delete'}`.

- [ ] Tests: aislamiento entre campos, viewer no escribe, orden/filtros (incl. `reproductivo.gestante`), batch atómico, flujo de invitación.
- [ ] Implementar; commit.

### Task 5: Frontend — shim y contextos

**Files:** Create `src/lib/{api,db}.js`; Modify `src/firebase/{config,AuthContext,CampoContext}.jsx`, `src/pages/{Configuracion,Tareas,Lluvias,Dashboard,Ovejas}.jsx`, `src/components/Login.jsx`, `vite.config.js`, `package.json`.

- [ ] `src/lib/db.js` exporta `db, collection, doc, query, where, orderBy, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, writeBatch, Timestamp, serverTimestamp, arrayUnion, arrayRemove, deleteField`; revive `{__t:'ts'}` a `Timestamp` con `toDate()`.
- [ ] Páginas: solo cambia el import `firebase/firestore` → `../lib/db` (sus cambios sin commitear se conservan).
- [ ] AuthContext/CampoContext usan la API; refresco tras cada acción y cada 30 s con la pestaña visible.
- [ ] Login con Google = `window.location = '/api/auth/google'`; reset y displayName vía API. Quitar `firebase` y `@vercel/analytics`.
- [ ] `vite.config.js` proxy `/api` → `http://localhost:8787`. `npm run build` OK; prueba manual local con la DB importada. Commit.

### Task 6: Deploy en el VPS (staging con copia de datos)

**Files:** Create `deploy/{Dockerfile,docker-compose.yml,Caddyfile.campo,deploy.sh,backup.sh,README.md}`.

- [ ] `deploy.sh`: rsync del repo a `/opt/campo/src` (sin `node_modules`, `.env`, `data`), `docker compose build && up -d`, healthcheck `curl 127.0.0.1:3600/api/health`.
- [ ] Crear `/opt/campo/.env` (600): el usuario carga `GOOGLE_CLIENT_ID/SECRET`, `RESEND_*`; los `FIREBASE_SCRYPT_*` se copian por scp desde el backup local.
- [ ] Agregar bloque a `/etc/caddy/Caddyfile` (backup previo del archivo), `caddy validate` y `systemctl reload caddy`.
- [ ] Import de la copia de datos en staging, verificación OK; cron diario de `backup.sh` 04:45.
- [ ] Requiere: registro A `campo` → `77.37.49.211` (usuario). Commit.

### Task 7: Corte (con confirmación del usuario en cada paso)

- [ ] Reglas de Firestore a solo lectura (`allow write: if false`) — `firebase deploy --only firestore:rules`.
- [ ] Export final (`auth:export` + dump REST) → `importBackup --replace` → `verifyImport` OK → conteos mostrados al usuario.
- [ ] `vercel.json` → redirect permanente a `https://campo.nimbodata.com`; deploy en Vercel.
- [ ] Prueba de humo: login email/clave, login Google, ver ovejas/lluvias/tareas de ambos campos con datos.
- [ ] Firebase queda intacto 30 días; recordatorio para decidir su baja.
