# 🐑 Campo App - Gestión Agropecuaria

Aplicación completa para la gestión de un campo ovino con registro de ovejas, clima, lluvias y tareas.

## 🚀 Características

- **Gestión de Ovejas**: Registro completo con datos de producción, reproductivos y sanitarios
- **Registro de Lluvias**: Histórico de precipitaciones con gráficos
- **Clima y Pronóstico**: Integración con API meteorológica para pronóstico extendido
- **Tareas y Recordatorios**: Sistema de calendario para vacunaciones, revisiones, etc.
- **Dashboard**: Estadísticas generales y acceso rápido
- **Autenticación**: Sistema de login seguro con Firebase

## 📋 Requisitos Previos

- Node.js (v16 o superior)
- npm o yarn
- Cuenta de Firebase
- Cuenta de OpenWeatherMap (para clima)

## ⚙️ Instalación

### 1. Clonar o descargar el proyecto

```bash
cd campo-app
npm install
```

### 2. Configurar Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto
3. Habilita Authentication (Email/Password)
4. Crea una base de datos Firestore
5. Ve a Configuración del proyecto > Tus apps > Agregar app web
6. Copia las credenciales y pégalas en `src/firebase/config.js`:

```javascript
const firebaseConfig = {
  apiKey: "tu-api-key",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto-id",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "tu-app-id"
};
```

### 3. Configurar Reglas de Firestore

En Firebase Console > Firestore Database > Reglas, pega:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir lectura/escritura solo a usuarios autenticados
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 4. Configurar API del Clima

1. Regístrate en [OpenWeatherMap](https://openweathermap.org/api)
2. Obtén tu API key gratuita
3. Abre `src/pages/Clima.jsx` y configura:

```javascript
const CAMPO_LAT = -34.6037; // Latitud de tu campo
const CAMPO_LON = -58.3816; // Longitud de tu campo
const API_KEY = 'tu-api-key-aqui';
```

💡 **Tip**: Puedes obtener las coordenadas de tu campo en Google Maps (click derecho > copiar coordenadas)

### 5. Iniciar la aplicación

```bash
npm run dev
```

La app estará disponible en `http://localhost:3000`

## 👤 Primer Uso

1. Abre la aplicación
2. Haz click en "¿No tienes cuenta? Regístrate"
3. Crea tu cuenta con email y contraseña
4. ¡Listo! Ya puedes empezar a usar la app

## 📱 Uso de la Aplicación

### Dashboard
Visualiza estadísticas generales:
- Total de ovejas
- Ovejas gestantes
- Producción de leche (últimos 7 días)
- Lluvias del mes
- Tareas pendientes

### Gestión de Ovejas
- Agregar nuevas ovejas con número de caravana
- Registrar peso, fecha de nacimiento, raza
- Indicar si está gestante
- Ver listado completo con edad calculada
- Editar y eliminar registros

### Registro de Lluvias
- Agregar milímetros de lluvia por fecha
- Ver gráficos de precipitaciones
- Estadísticas mensuales (total, promedio, máximo)
- Histórico completo

### Clima y Pronóstico
- Ver clima actual de la ubicación del campo
- Pronóstico extendido de 5 días
- Temperatura, humedad, viento, presión
- Alertas de lluvia pronosticada

### Tareas y Recordatorios
- Crear tareas por tipo (vacunación, desparasitación, etc.)
- Asignar a ovejas específicas
- Marcar como completadas
- Ver tareas de hoy y pendientes
- Alertas visuales para tareas vencidas

## 🔒 Seguridad

- Autenticación requerida para todas las páginas
- Los datos solo son accesibles por usuarios autenticados
- Las credenciales de Firebase deben mantenerse privadas
- Se recomienda habilitar reglas de seguridad más estrictas en producción

## 🎨 Personalización

Puedes personalizar los colores en `src/styles/App.css`:

```css
:root {
  --primary: #2e7d32;
  --primary-dark: #1b5e20;
  --secondary: #558b2f;
  --accent: #ffa726;
  /* ... más colores */
}
```

## 📦 Estructura del Proyecto

```
campo-app/
├── public/
├── src/
│   ├── components/
│   │   ├── Header.jsx
│   │   └── Login.jsx
│   ├── firebase/
│   │   ├── config.js
│   │   └── AuthContext.jsx
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Ovejas.jsx
│   │   ├── Clima.jsx
│   │   ├── Lluvias.jsx
│   │   └── Tareas.jsx
│   ├── styles/
│   │   └── App.css
│   ├── App.jsx
│   └── main.jsx
├── package.json
└── README.md
```

## 🔮 Próximas Mejoras Sugeridas

- [ ] Detalle individual de cada oveja con historial completo
- [ ] Registro de producción de leche por oveja
- [ ] Sistema de alertas automáticas (próximos partos, vacunas vencidas)
- [ ] Exportar datos a Excel/PDF
- [ ] Modo offline con sincronización
- [ ] Gestión de pasturas y alimentación
- [ ] Cálculos de rentabilidad
- [ ] Genealogía visual
- [ ] App móvil nativa
- [ ] Notificaciones push

## 🐛 Solución de Problemas

### Error de Firebase
- Verifica que las credenciales en `config.js` sean correctas
- Asegúrate de habilitar Authentication y Firestore en Firebase Console

### Error de API del Clima
- Verifica que tu API key de OpenWeatherMap sea válida
- Confirma que las coordenadas estén en formato correcto (decimal)

### La app no carga
- Ejecuta `npm install` nuevamente
- Limpia la caché: `npm run clean` y vuelve a iniciar

## 📞 Soporte

Para problemas o sugerencias, crea un issue en el repositorio.

## 📄 Licencia

Este proyecto es de uso libre para fines personales y educativos.

---

**¡Desarrollado con ❤️ para facilitar la gestión del campo!**
