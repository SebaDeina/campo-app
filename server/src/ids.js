import { randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomId(length) {
  return Array.from(randomBytes(length), (b) => ALPHABET[b % ALPHABET.length]).join('');
}

// Mismos formatos que Firestore (docs, 20 chars) y Firebase Auth (uids, 28 chars).
export const newDocId = () => randomId(20);
export const newUid = () => randomId(28);
