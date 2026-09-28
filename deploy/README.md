# Deploy de campo en el VPS de Nimbo

`https://campo.nimbodata.com` → Caddy (apt, `/etc/caddy/Caddyfile`) → `127.0.0.1:3600` → container `campo-campo-1`.

| Qué | Dónde |
|---|---|
| Código desplegado | `/opt/campo/src` (commit en `DEPLOYED_COMMIT`; el anterior queda en `src.old`) |
| Base SQLite | `/opt/campo/data/campo.sqlite` (bind mount en `/data`) |
| Secretos | `/opt/campo/.env` (600) — plantilla en `deploy/env.example` |
| Backups | `/opt/campo/backups/campo-YYYY-MM-DD.sqlite.gz`, cron 04:45, 14 días |
| Logs HTTP | `/var/log/caddy/campo-access.log` |

## Desplegar

```bash
./deploy/deploy.sh
```

Sube `HEAD` (no el working tree), reconstruye la imagen y espera `/api/health`.

## Cambiar secretos

```bash
ssh -i ~/.ssh/nimbo_vps root@77.37.49.211
nano /opt/campo/.env
cd /opt/campo/src/deploy && docker compose up -d
```

## Importar datos de Firebase

El import corre en una transacción y verifica documento por documento; si algo no
coincide, no guarda nada. Antes de escribir deja una copia de la base
(`campo.sqlite.antes-de-import-*`). `--replace` borra todo lo que no venga del backup:
usarlo solo en el corte final.

```bash
# en el VPS, con firestore.json y auth-users.json en /opt/campo/data/import-tmp (dueño 1000)
cd /opt/campo/src/deploy
docker compose exec -T campo node scripts/import-firestore.js --backup /data/import-tmp --db /data/campo.sqlite --replace --dry-run
docker compose exec -T campo node scripts/import-firestore.js --backup /data/import-tmp --db /data/campo.sqlite --replace
rm -rf /opt/campo/data/import-tmp
```

## Restaurar un backup

```bash
cd /opt/campo/src/deploy && docker compose stop campo
gunzip -c /opt/campo/backups/campo-YYYY-MM-DD.sqlite.gz > /opt/campo/data/campo.sqlite
rm -f /opt/campo/data/campo.sqlite-wal /opt/campo/data/campo.sqlite-shm
chown 1000:1000 /opt/campo/data/campo.sqlite && docker compose start campo
```

Lo borrado desde la app no se pierde: queda en la tabla `deleted_docs`.

## Gotchas

- **`caddy validate` como root crea el archivo de log con dueño root**, y después
  `systemctl reload caddy` falla con *opening log writer*. Solución:
  `chown caddy:caddy /var/log/caddy/campo-access.log` y volver a recargar.
- `node:sqlite` imprime un *ExperimentalWarning*: está silenciado con `NODE_OPTIONS` en la imagen.
