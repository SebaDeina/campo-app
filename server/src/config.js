function list(value) {
  return (value || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function loadConfig(env = process.env) {
  const publicUrl = (env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');
  const scrypt = env.FIREBASE_SCRYPT_SIGNER_KEY
    ? {
        signerKey: env.FIREBASE_SCRYPT_SIGNER_KEY,
        saltSeparator: env.FIREBASE_SCRYPT_SALT_SEPARATOR || '',
        rounds: Number(env.FIREBASE_SCRYPT_ROUNDS || 8),
        memCost: Number(env.FIREBASE_SCRYPT_MEM_COST || 14),
      }
    : null;

  return {
    port: Number(env.PORT || 8787),
    dbPath: env.DB_PATH || 'data/campo.sqlite',
    staticDir: env.STATIC_DIR || null,
    publicUrl,
    secureCookies: publicUrl.startsWith('https://'),
    sessionDays: Number(env.SESSION_DAYS || 30),
    adminEmails: new Set(list(env.ADMIN_EMAILS)),
    firebaseScrypt: scrypt,
    google: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
      : null,
    resend: env.RESEND_API_KEY && env.RESEND_FROM
      ? { apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM }
      : null,
  };
}
