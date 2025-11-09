# 📖 Guía de Configuración Paso a Paso

## 🎯 Paso 1: Instalar Node.js

1. Ve a https://nodejs.org/
2. Descarga la versión LTS (Long Term Support)
3. Instala siguiendo las instrucciones
4. Verifica la instalación abriendo una terminal y ejecutando:
   ```bash
   node --version
   npm --version
   ```

## 🔥 Paso 2: Configurar Firebase

### 2.1 Crear Proyecto en Firebase

1. Ve a https://console.firebase.google.com/
2. Click en "Agregar proyecto"
3. Nombre: "campo-app" (o el que prefieras)
4. Desactiva Google Analytics (opcional)
5. Click en "Crear proyecto"

### 2.2 Habilitar Authentication

1. En el menú lateral, click en "Authentication"
2. Click en "Comenzar"
3. Selecciona "Correo electrónico/contraseña"
4. Activa el primer interruptor (Correo electrónico/contraseña)
5. Click en "Guardar"

### 2.3 Crear Base de Datos Firestore

1. En el menú lateral, click en "Firestore Database"
2. Click en "Crear base de datos"
3. Selecciona "Comenzar en modo de prueba"
4. Elige la ubicación más cercana (ej: southamerica-east1)
5. Click en "Habilitar"

### 2.4 Configurar Reglas de Seguridad

1. En Firestore Database, ve a la pestaña "Reglas"
2. Reemplaza todo el contenido con:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click en "Publicar"

### 2.5 Obtener Credenciales

1. Click en el ícono de engranaje ⚙️ > "Configuración del proyecto"
2. Scroll hacia abajo hasta "Tus apps"
3. Click en el ícono web </> (Agregar app)
4. Nombre: "campo-app-web"
5. Click en "Registrar app"
6. Copia el objeto `firebaseConfig` que aparece
7. **IMPORTANTE**: Guarda estas credenciales en un lugar seguro

## 🌤️ Paso 3: Obtener API Key del Clima

### 3.1 Crear Cuenta en OpenWeatherMap

1. Ve a https://openweathermap.org/api
2. Click en "Sign Up" (arriba a la derecha)
3. Completa el formulario de registro
4. Confirma tu email

### 3.2 Obtener API Key

1. Inicia sesión
2. Ve a tu perfil > "My API keys"
3. Copia la API key que aparece (puede tardar unos minutos en activarse)

### 3.3 Obtener Coordenadas del Campo

1. Ve a Google Maps
2. Busca la ubicación de tu campo
3. Click derecho en el punto exacto
4. Selecciona las coordenadas (aparecen arriba) para copiarlas
5. Ejemplo: -34.603722, -58.381592
   - El primer número es la LATITUD
   - El segundo número es la LONGITUD

## 💻 Paso 4: Configurar el Proyecto

### 4.1 Instalar Dependencias

1. Abre una terminal en la carpeta del proyecto
2. Ejecuta:
   ```bash
   npm install
   ```
3. Espera a que se instalen todas las dependencias (puede tardar unos minutos)

### 4.2 Configurar Firebase en el Código

1. Abre el archivo `src/firebase/config.js`
2. Reemplaza las credenciales de ejemplo con las tuyas:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",  // Tu API key de Firebase
  authDomain: "campo-app-xxxx.firebaseapp.com",
  projectId: "campo-app-xxxx",
  storageBucket: "campo-app-xxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef..."
};
```

3. Guarda el archivo

### 4.3 Configurar API del Clima

1. Abre el archivo `src/pages/Clima.jsx`
2. Busca estas líneas (cerca de la línea 17):

```javascript
const CAMPO_LAT = -34.6037;
const CAMPO_LON = -58.3816;
const API_KEY = 'TU_API_KEY_AQUI';
```

3. Reemplaza con tus datos
4. Guarda el archivo

## 🚀 Paso 5: Iniciar la Aplicación

1. En la terminal, ejecuta:
   ```bash
   npm run dev
   ```

2. Abre tu navegador en `http://localhost:3000`

## 👤 Paso 6: Crear tu Primera Cuenta

1. Click en "¿No tienes cuenta? Regístrate"
2. Ingresa email y contraseña (mínimo 6 caracteres)
3. Click en "Crear Cuenta"

## ✅ ¡Listo! Ya puedes usar la aplicación

---

**Si tienes problemas, revisa el archivo README.md para más detalles**
