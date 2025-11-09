import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDrbw6dtZCb5HIJxxSjSl4ykOpFlCffYqE",
  authDomain: "tambo-manager.firebaseapp.com",
  projectId: "tambo-manager",
  storageBucket: "tambo-manager.firebasestorage.app",
  messagingSenderId: "1095952416269",
  appId: "1:1095952416269:web:9704d3ce799f6831dbdf44",
  measurementId: "G-0RGD17LY29"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Servicios de Firebase
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
