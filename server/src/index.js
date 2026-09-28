import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { createApp } from './app.js';

const config = loadConfig();
mkdirSync(dirname(config.dbPath), { recursive: true });
const db = openDb(config.dbPath);

if (!config.firebaseScrypt) console.warn('FIREBASE_SCRYPT_* sin configurar: las contraseñas migradas de Firebase no van a funcionar');
if (!config.google) console.warn('GOOGLE_CLIENT_ID/SECRET sin configurar: login con Google deshabilitado');
if (!config.resend) console.warn('RESEND_API_KEY/RESEND_FROM sin configurar: no se envían mails');

const server = createApp({ db, config }).listen(config.port, () => {
  console.log(`campo-server escuchando en :${config.port} (${config.publicUrl})`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
