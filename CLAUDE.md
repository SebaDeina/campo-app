# CLAUDE.md - AI Assistant Guide for Nimbo (Campo App)

> **Last Updated**: 2025-11-23
> **Project**: Nimbo - Agricultural Management Application
> **Version**: 1.0.0

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Directory Structure](#directory-structure)
4. [Key Architectural Patterns](#key-architectural-patterns)
5. [Development Workflow](#development-workflow)
6. [Code Conventions](#code-conventions)
7. [State Management](#state-management)
8. [Firebase/Firestore Patterns](#firebasefirestore-patterns)
9. [Routing Structure](#routing-structure)
10. [Styling Conventions](#styling-conventions)
11. [Common Tasks](#common-tasks)
12. [Important Files Reference](#important-files-reference)
13. [Git Workflow](#git-workflow)
14. [Deployment](#deployment)
15. [Troubleshooting](#troubleshooting)

---

## 🎯 Project Overview

**Nimbo** (formerly Campo App) is a full-featured agricultural management web application for sheep farms. It enables farmers to:

- Manage sheep records with genealogy tracking
- Monitor weather and rainfall data
- Track tasks and reminders (vaccinations, health checks, etc.)
- Collaborate with team members via campo invitations
- View production statistics and dashboards

**Primary Language**: Spanish (UI, domain terms, error messages)
**Target Users**: Farmers and agricultural field managers in Spanish-speaking regions
**Deployment**: Vercel (SPA architecture)

---

## 🛠️ Tech Stack

### Core Technologies
- **Framework**: React 18.2.0 (functional components with hooks)
- **Build Tool**: Vite 5.0.8 (fast dev server, HMR)
- **Routing**: React Router v6.20.0 (client-side routing)
- **Language**: JavaScript (no TypeScript)

### Backend & Database
- **Firebase 10.7.1**:
  - Authentication (Email/Password + Google OAuth)
  - Firestore (NoSQL database with real-time subscriptions)
  - Storage (not heavily used yet)

### Styling
- **Tailwind CSS 3.4.17** (utility-first CSS framework)
- **Custom CSS** with CSS Variables for theming
- **PostCSS + Autoprefixer** (browser compatibility)

### UI Libraries
- **lucide-react 0.294.0** - Modern SVG icons
- **recharts 2.10.3** - Charting library for rainfall visualization

### Data Processing
- **date-fns 3.0.0** - Date manipulation (Spanish locale)
- **papaparse 5.4.1** - CSV parsing
- **xlsx 0.18.5** - Excel file parsing

### External Services
- **OpenWeatherMap API** - Weather forecasts
- **Resend 6.4.2** - Email service (welcome emails)
- **Vercel Analytics 1.5.0** - Usage tracking

---

## 📁 Directory Structure

```
campo-app/
├── api/                          # Serverless backend functions
│   └── send-welcome.js           # Resend email integration
├── public/                       # Static assets
│   └── favicon.ico               # Branded favicon
├── src/                          # React application source
│   ├── components/               # Reusable UI components
│   │   ├── Header.jsx            # Navigation bar (14KB)
│   │   ├── Login.jsx             # Auth UI (8.9KB)
│   │   ├── CampoOnboarding.jsx   # First-time setup (4.8KB)
│   │   └── LocationSettings.jsx  # Geolocation component (6.8KB)
│   ├── firebase/                 # Firebase configuration
│   │   ├── config.js             # Firebase initialization
│   │   ├── AuthContext.jsx       # Authentication state
│   │   └── CampoContext.jsx      # Campo management state
│   ├── pages/                    # Full-page route components
│   │   ├── Dashboard.jsx         # Stats overview (9.5KB)
│   │   ├── Ovejas.jsx            # Sheep management (37KB) ⚠️ LARGEST
│   │   ├── Clima.jsx             # Weather forecast (16KB)
│   │   ├── Lluvias.jsx           # Rainfall tracking (18.6KB)
│   │   ├── Tareas.jsx            # Task management (13.6KB)
│   │   ├── Configuracion.jsx     # Settings (17.4KB)
│   │   └── Landing.jsx           # Marketing page (10KB)
│   ├── styles/                   # CSS styling
│   │   └── App.css               # Global styles + component classes (12.5KB)
│   ├── utils/                    # Utility functions
│   │   └── locationPreferences.js # localStorage helpers
│   ├── img/                      # Image assets
│   ├── App.jsx                   # Main router & layout
│   └── main.jsx                  # React DOM entry point
├── .gitignore                    # Git exclusions
├── index.html                    # HTML entry point
├── package.json                  # Dependencies & scripts
├── vite.config.js                # Vite configuration
├── tailwind.config.js            # Tailwind customization
├── postcss.config.js             # PostCSS plugins
├── vercel.json                   # Vercel deployment config
├── README.md                     # User documentation
├── CONFIGURACION.md              # Setup guide (Spanish)
└── CLAUDE.md                     # This file
```

### Key File Sizes & Complexity

| File | Size | Complexity | Notes |
|------|------|-----------|-------|
| `Ovejas.jsx` | 37KB | High | Genealogy tree, CRUD, reproductive tracking |
| `Lluvias.jsx` | 18.6KB | Medium | CSV/Excel import, charting |
| `Configuracion.jsx` | 17.4KB | Medium | Team management, invitations |
| `Clima.jsx` | 16KB | Low | External API integration |
| `Header.jsx` | 14KB | Medium | Complex navigation with dropdowns |
| `Tareas.jsx` | 13.6KB | Medium | Task CRUD with filtering |
| `App.css` | 12.5KB | Low | Global styles |
| `Dashboard.jsx` | 9.5KB | Low | Read-only stats display |

---

## 🏗️ Key Architectural Patterns

### Architecture Type
**Single Page Application (SPA)** with Firebase Backend-as-a-Service (BaaS)

### Design Patterns

1. **Container/Presentation Pattern**
   - Pages (containers) manage state and data fetching
   - Components (presentational) receive props

2. **Context Provider Pattern**
   - `AuthContext` for authentication state
   - `CampoContext` for campo selection and team management
   - Both wrap the entire app via providers

3. **Protected Route Pattern**
   - `PrivateRoute` component guards authenticated pages
   - Redirects to `/login` if unauthenticated

4. **Real-time Subscription Pattern**
   - Firestore `onSnapshot()` for reactive data updates
   - Listeners set up in `useEffect`, cleaned up on unmount

5. **Local Storage Persistence**
   - Selected campo ID persisted across sessions
   - Geolocation coordinates cached

### State Management Philosophy
- **Global state** via React Context (auth, campo selection)
- **Local state** via `useState` (forms, UI toggles)
- **Server state** via Firestore real-time subscriptions
- **No Redux, MobX, or Zustand** - keep it simple with Context API

### Data Flow
```
User Action
  ↓
Event Handler (page component)
  ↓
Firestore Mutation (addDoc, updateDoc, deleteDoc)
  ↓
Firestore Triggers onSnapshot Listener
  ↓
Local State Updated
  ↓
UI Re-renders
```

---

## 🔄 Development Workflow

### Local Development Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Firebase** (see `CONFIGURACION.md` for detailed steps)
   - Edit `src/firebase/config.js` with your Firebase credentials
   - Set up Firestore security rules in Firebase Console

3. **Configure OpenWeatherMap API** (optional for weather feature)
   - Edit `src/pages/Clima.jsx`
   - Set `API_KEY`, `CAMPO_LAT`, `CAMPO_LON`

4. **Start Dev Server**
   ```bash
   npm run dev
   ```
   - Opens browser automatically at `http://localhost:3000`
   - Hot Module Replacement (HMR) enabled

5. **Build for Production**
   ```bash
   npm run build
   ```
   - Output: `dist/` directory
   - Vite optimizes and minifies code

6. **Preview Production Build**
   ```bash
   npm run preview
   ```

### Environment Variables
⚠️ **Current State**: No `.env` file exists. API keys are hardcoded.

**Recommended Improvement**: Create `.env.local` with:
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_OPENWEATHER_API_KEY=...
```

Then access via `import.meta.env.VITE_*` in code.

---

## 📝 Code Conventions

### Naming Conventions

| Type | Convention | Examples |
|------|-----------|----------|
| **React Components** | PascalCase | `Header.jsx`, `Dashboard.jsx` |
| **Functions** | camelCase | `handleSubmit`, `fetchWeatherData` |
| **Variables** | camelCase | `currentUser`, `selectedCampo` |
| **Constants** | UPPER_SNAKE_CASE | `API_KEY`, `CAMPO_LAT` |
| **CSS Classes** | kebab-case | `.btn-primary`, `.stat-card` |
| **Firestore Collections** | camelCase | `campos`, `ovejas`, `lluvias` |
| **Domain Terms** | Spanish | `campo`, `oveja`, `tarea`, `lluvia` |

### File Naming
- **Components**: `ComponentName.jsx`
- **Pages**: `PageName.jsx`
- **Utilities**: `utilityName.js`
- **Contexts**: `ContextName.jsx`

### Component Structure Template
```jsx
import { useState, useEffect, useContext } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { AuthContext } from '../firebase/AuthContext';
import { CampoContext } from '../firebase/CampoContext';
import { Icon } from 'lucide-react';

export default function ComponentName() {
  // 1. Context
  const { currentUser } = useContext(AuthContext);
  const { selectedCampoId } = useContext(CampoContext);

  // 2. State
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // 3. Effects
  useEffect(() => {
    if (!currentUser || !selectedCampoId) return;

    // Firestore subscription
    const q = query(
      collection(db, 'collectionName'),
      where('campoId', '==', selectedCampoId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setData(items);
      setLoading(false);
    });

    return () => unsubscribe(); // Cleanup
  }, [currentUser, selectedCampoId]);

  // 4. Event Handlers
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Firestore mutation
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    }
  };

  // 5. Render
  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div className="page-container">
      {/* JSX */}
    </div>
  );
}
```

### Import Order
1. React core (`react`, `react-dom`)
2. External libraries (`firebase/firestore`, `lucide-react`, etc.)
3. Internal modules (`../firebase/config`, `../components/Header`)
4. Styles (if any separate CSS files)

### Error Handling Pattern
```javascript
try {
  await firestoreOperation();
  alert('Operación exitosa');
} catch (error) {
  console.error('Error:', error);
  alert('Error: ' + error.message);
}
```

⚠️ **Current State**: Uses browser `alert()` for user feedback.
**Recommended Improvement**: Toast notifications or inline error messages.

---

## 🌐 State Management

### Context Architecture

#### 1. AuthContext (`src/firebase/AuthContext.jsx`)

**Purpose**: Manages user authentication state globally.

**Exported Values**:
```javascript
{
  currentUser,      // Firebase user object or null
  loading,          // Boolean - initial auth check
  signup,           // (email, password) => Promise
  login,            // (email, password) => Promise
  logout,           // () => Promise
  resetPassword,    // (email) => Promise
  loginWithGoogle   // () => Promise
}
```

**Usage**:
```javascript
import { useContext } from 'react';
import { AuthContext } from '../firebase/AuthContext';

const { currentUser, logout } = useContext(AuthContext);
```

**Key Behaviors**:
- Blocks app rendering until initial auth state loads (`loading === true`)
- Persists auth state via Firebase SDK (browser storage)
- Automatically redirects unauthenticated users to `/login`

#### 2. CampoContext (`src/firebase/CampoContext.jsx`)

**Purpose**: Manages campo (field) selection and team invitations.

**Exported Values**:
```javascript
{
  campos,            // Array of campos user has access to
  selectedCampoId,   // String - currently selected campo ID
  invitaciones,      // Array of pending invitations
  loading,           // Boolean - Firestore subscriptions loading
  selectCampo,       // (campoId) => void
  createCampo,       // (nombre, ubicacion) => Promise
  inviteUsuario,     // (email, rol) => Promise
  acceptInvite,      // (inviteId) => Promise
  rejectInvite,      // (inviteId) => Promise
  updateMiembroRol,  // (campoId, userId, newRol) => Promise
  removeMiembro      // (campoId, userId) => Promise
}
```

**Usage**:
```javascript
import { useContext } from 'react';
import { CampoContext } from '../firebase/CampoContext';

const { selectedCampoId, campos, selectCampo } = useContext(CampoContext);
```

**Key Behaviors**:
- Auto-selects first campo if none selected
- Persists `selectedCampoId` to localStorage
- Real-time subscriptions to `campos` and `campoInvitaciones` collections
- Memoized value to prevent unnecessary re-renders

### Local State Patterns

**Form State**:
```javascript
const [formData, setFormData] = useState({
  nombre: '',
  peso: '',
  fecha: ''
});

const handleChange = (e) => {
  setFormData({
    ...formData,
    [e.target.name]: e.target.value
  });
};
```

**Modal/Toggle State**:
```javascript
const [showModal, setShowModal] = useState(false);
const [isEditing, setIsEditing] = useState(false);
```

**Loading/Error State**:
```javascript
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
```

---

## 🔥 Firebase/Firestore Patterns

### Firestore Collections

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `campos` | Fields/farms | `nombre`, `ubicacion`, `miembrosIds[]`, `miembros{}` |
| `ovejas` | Sheep records | `campoId`, `caravana`, `peso`, `raza`, `gestante`, `reproductivo{}` |
| `lluvias` | Rainfall records | `campoId`, `fecha`, `milimetros` |
| `tareas` | Tasks/reminders | `campoId`, `tipo`, `descripcion`, `fecha`, `completada`, `ovejaId` |
| `campoInvitaciones` | Team invites | `campoId`, `email`, `rol`, `estado`, `invitadoPor` |

### Firestore Query Patterns

**Basic Query**:
```javascript
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

const q = query(
  collection(db, 'ovejas'),
  where('campoId', '==', selectedCampoId),
  orderBy('caravana', 'asc')
);

const unsubscribe = onSnapshot(q, (snapshot) => {
  const data = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  setOvejas(data);
});

return () => unsubscribe(); // Cleanup in useEffect
```

**Add Document**:
```javascript
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

await addDoc(collection(db, 'tareas'), {
  campoId: selectedCampoId,
  tipo: 'vacunacion',
  descripcion: 'Vacuna antiaftosa',
  fecha: new Date().toISOString().split('T')[0],
  completada: false,
  creadoPor: currentUser.uid,
  creadoEn: serverTimestamp()
});
```

**Update Document**:
```javascript
import { doc, updateDoc } from 'firebase/firestore';

await updateDoc(doc(db, 'ovejas', ovejaId), {
  peso: parseFloat(nuevoPeso),
  gestante: true
});
```

**Delete Document**:
```javascript
import { doc, deleteDoc } from 'firebase/firestore';

await deleteDoc(doc(db, 'lluvias', lluviaId));
```

**Batch Operations**:
```javascript
import { writeBatch, doc } from 'firebase/firestore';

const batch = writeBatch(db);
items.forEach(item => {
  const docRef = doc(collection(db, 'lluvias'));
  batch.set(docRef, item);
});
await batch.commit();
```

**Array Operations**:
```javascript
import { arrayUnion, arrayRemove } from 'firebase/firestore';

// Add to array
await updateDoc(campoRef, {
  miembrosIds: arrayUnion(newUserId)
});

// Remove from array
await updateDoc(campoRef, {
  miembrosIds: arrayRemove(userId)
});
```

### Firebase Authentication Patterns

**Sign Up**:
```javascript
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase/config';

const userCredential = await createUserWithEmailAndPassword(auth, email, password);
await updateProfile(userCredential.user, { displayName: nombre });
```

**Login**:
```javascript
import { signInWithEmailAndPassword } from 'firebase/auth';

await signInWithEmailAndPassword(auth, email, password);
```

**Google OAuth**:
```javascript
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

const provider = new GoogleAuthProvider();
await signInWithPopup(auth, provider);
```

**Password Reset**:
```javascript
import { sendPasswordResetEmail } from 'firebase/auth';

await sendPasswordResetEmail(auth, email);
```

**Logout**:
```javascript
import { signOut } from 'firebase/auth';

await signOut(auth);
```

---

## 🛣️ Routing Structure

### Route Configuration

**Routes** (defined in `src/App.jsx`):

```jsx
<Routes>
  {/* Public Routes */}
  <Route path="/" element={<Landing />} />
  <Route path="/login" element={<Login />} />

  {/* Protected Routes */}
  <Route path="/app" element={<PrivateRoute><CampoLayout /></PrivateRoute>}>
    <Route index element={<Dashboard />} />
    <Route path="ovejas" element={<Ovejas />} />
    <Route path="clima" element={<Clima />} />
    <Route path="lluvias" element={<Lluvias />} />
    <Route path="tareas" element={<Tareas />} />
    <Route path="configuracion" element={<Configuracion />} />
  </Route>

  {/* Catch-all */}
  <Route path="*" element={<Navigate to="/" />} />
</Routes>
```

### PrivateRoute Component Pattern

```jsx
function PrivateRoute({ children }) {
  const { currentUser, loading } = useContext(AuthContext);

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return currentUser ? children : <Navigate to="/login" />;
}
```

### CampoLayout (Nested Layout)

**Purpose**: Wraps all `/app/*` routes with:
- Header navigation
- Campo onboarding check (first-time users)
- Invitation notifications
- Main content area (`<Outlet />`)

### Navigation Helpers

**Programmatic Navigation**:
```javascript
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
navigate('/app/ovejas');
```

**Link Component**:
```javascript
import { Link } from 'react-router-dom';

<Link to="/app/clima">Ver Clima</Link>
```

**Active Link Styling**:
```javascript
import { NavLink } from 'react-router-dom';

<NavLink
  to="/app/dashboard"
  className={({ isActive }) => isActive ? 'active' : ''}
>
  Dashboard
</NavLink>
```

---

## 🎨 Styling Conventions

### CSS Architecture: Hybrid Tailwind + Custom CSS

**Approach**:
1. **Tailwind utilities** for layout, spacing, colors
2. **Component classes** in `App.css` for reusable patterns
3. **CSS variables** for theming

### Tailwind Configuration

**Custom Colors** (`tailwind.config.js`):
```javascript
colors: {
  primary: 'var(--primary)',
  'primary-dark': 'var(--primary-dark)',
  secondary: 'var(--secondary)',
  accent: 'var(--accent)',
}
```

**Usage**:
```jsx
<button className="bg-primary text-white hover:bg-primary-dark">
  Guardar
</button>
```

### CSS Variables (`src/styles/App.css`)

```css
:root {
  --primary: #2e7d32;           /* Green */
  --primary-dark: #1b5e20;      /* Dark Green */
  --secondary: #558b2f;         /* Olive Green */
  --accent: #ffa726;            /* Orange */
  --background: #f5f5f5;        /* Light Gray */
  --surface: #ffffff;           /* White */
  --error: #d32f2f;             /* Red */
  --text: #212121;              /* Dark */
  --text-secondary: #757575;    /* Gray */
  --border: #e0e0e0;            /* Light Gray Border */
}
```

### Component Classes

**Cards**:
```css
.card {
  background: var(--surface);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  padding: 1.5rem;
}
```

**Buttons**:
```css
.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  color: white;
}
```

**Input Groups**:
```css
.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
```

**Stat Cards**:
```css
.stat-card {
  background: linear-gradient(135deg, #1e3c72, #2a5298);
  color: white;
  border-radius: 16px;
  padding: 1.5rem;
}
```

### Responsive Design

**Mobile-First Approach**: Tailwind's default

**Breakpoints**:
- `sm:` - 640px
- `md:` - 768px
- `lg:` - 1024px
- `xl:` - 1280px

**Example**:
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* 1 column mobile, 2 tablet, 3 desktop */}
</div>
```

### Layout Patterns

**Page Container**:
```jsx
<div className="max-w-7xl mx-auto p-6">
  {/* Content */}
</div>
```

**Grid Layout**:
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  {items.map(item => (
    <div key={item.id} className="card">
      {/* Card content */}
    </div>
  ))}
</div>
```

**Flexbox Utilities**:
```jsx
<div className="flex items-center justify-between">
  <h2>Title</h2>
  <button>Action</button>
</div>
```

---

## ✅ Common Tasks

### Adding a New Page

1. **Create page file**: `src/pages/NewPage.jsx`
   ```jsx
   export default function NewPage() {
     return (
       <div className="max-w-7xl mx-auto p-6">
         <h1>New Page</h1>
       </div>
     );
   }
   ```

2. **Add route**: Edit `src/App.jsx`
   ```jsx
   import NewPage from './pages/NewPage';

   <Route path="newpage" element={<NewPage />} />
   ```

3. **Add navigation**: Edit `src/components/Header.jsx`
   ```jsx
   <Link to="/app/newpage">New Page</Link>
   ```

### Adding a New Firestore Collection

1. **Define collection name** (camelCase convention)
   ```javascript
   const collectionName = 'newCollection';
   ```

2. **Create query in component**:
   ```javascript
   useEffect(() => {
     if (!selectedCampoId) return;

     const q = query(
       collection(db, 'newCollection'),
       where('campoId', '==', selectedCampoId)
     );

     const unsubscribe = onSnapshot(q, (snapshot) => {
       const items = snapshot.docs.map(doc => ({
         id: doc.id,
         ...doc.data()
       }));
       setItems(items);
     });

     return () => unsubscribe();
   }, [selectedCampoId]);
   ```

3. **Update Firestore rules** (Firebase Console):
   ```javascript
   match /newCollection/{docId} {
     allow read, write: if request.auth != null;
   }
   ```

### Adding a New Form

1. **Create state**:
   ```javascript
   const [formData, setFormData] = useState({
     field1: '',
     field2: ''
   });
   ```

2. **Handle input changes**:
   ```javascript
   const handleChange = (e) => {
     setFormData({
       ...formData,
       [e.target.name]: e.target.value
     });
   };
   ```

3. **Handle submission**:
   ```javascript
   const handleSubmit = async (e) => {
     e.preventDefault();
     try {
       await addDoc(collection(db, 'collectionName'), {
         ...formData,
         campoId: selectedCampoId,
         creadoEn: serverTimestamp()
       });
       setFormData({ field1: '', field2: '' }); // Reset
       alert('¡Guardado exitosamente!');
     } catch (error) {
       console.error('Error:', error);
       alert('Error: ' + error.message);
     }
   };
   ```

4. **Render form**:
   ```jsx
   <form onSubmit={handleSubmit}>
     <div className="input-group">
       <label>Field 1</label>
       <input
         type="text"
         name="field1"
         value={formData.field1}
         onChange={handleChange}
         required
       />
     </div>
     <button type="submit" className="btn btn-primary">
       Guardar
     </button>
   </form>
   ```

### Implementing Search/Filter

**Client-Side Filtering**:
```javascript
const [searchTerm, setSearchTerm] = useState('');

const filteredItems = items.filter(item =>
  item.nombre.toLowerCase().includes(searchTerm.toLowerCase())
);

return (
  <>
    <input
      type="text"
      placeholder="Buscar..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />
    {filteredItems.map(item => (
      <div key={item.id}>{item.nombre}</div>
    ))}
  </>
);
```

### Adding Icons

**Import from lucide-react**:
```javascript
import { Plus, Edit, Trash2, Check } from 'lucide-react';

<button>
  <Plus size={20} />
  Agregar
</button>
```

### Implementing Date Formatting

**Import date-fns**:
```javascript
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const formattedDate = format(parseISO(dateString), 'dd/MM/yyyy', { locale: es });
const relativeDate = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });
```

### Adding CSV Import

**Example from Lluvias.jsx**:
```javascript
import Papa from 'papaparse';

const handleCSVImport = (e) => {
  const file = e.target.files[0];

  Papa.parse(file, {
    header: true,
    complete: async (results) => {
      const batch = writeBatch(db);

      results.data.forEach(row => {
        const docRef = doc(collection(db, 'collectionName'));
        batch.set(docRef, {
          fecha: row.fecha,
          valor: parseFloat(row.valor),
          campoId: selectedCampoId
        });
      });

      await batch.commit();
      alert('Importación exitosa');
    }
  });
};
```

---

## 📚 Important Files Reference

### Configuration Files

| File | Purpose | When to Edit |
|------|---------|--------------|
| `vite.config.js` | Vite build settings | Change dev server port, add plugins |
| `tailwind.config.js` | Tailwind customization | Add custom colors, fonts, breakpoints |
| `postcss.config.js` | PostCSS plugins | Rarely (autoprefixer already set up) |
| `vercel.json` | Vercel deployment | Add rewrites, headers, redirects |
| `package.json` | Dependencies & scripts | Add/update packages, scripts |

### Core Application Files

| File | Purpose | Modification Frequency |
|------|---------|------------------------|
| `src/main.jsx` | React entry point | Rarely (only for global setup) |
| `src/App.jsx` | Router & layout | When adding new routes |
| `src/firebase/config.js` | Firebase init | When changing Firebase project |
| `src/firebase/AuthContext.jsx` | Auth state | When adding auth methods |
| `src/firebase/CampoContext.jsx` | Campo state | When adding campo features |
| `src/styles/App.css` | Global styles | When adding component classes |

### Page Components

| File | Purpose | Key Features |
|------|---------|--------------|
| `src/pages/Dashboard.jsx` | Home overview | Stats, quick actions |
| `src/pages/Ovejas.jsx` | Sheep management | ⚠️ Most complex - genealogy, CRUD |
| `src/pages/Clima.jsx` | Weather forecast | OpenWeatherMap integration |
| `src/pages/Lluvias.jsx` | Rainfall tracking | CSV/Excel import, charts |
| `src/pages/Tareas.jsx` | Task management | Calendar, reminders |
| `src/pages/Configuracion.jsx` | Settings | Team management, user profile |
| `src/pages/Landing.jsx` | Marketing page | Public homepage |

### Reusable Components

| File | Purpose | Used In |
|------|---------|---------|
| `src/components/Header.jsx` | Navigation bar | All `/app/*` pages |
| `src/components/Login.jsx` | Auth UI | `/login` route |
| `src/components/CampoOnboarding.jsx` | First-time setup | CampoLayout |
| `src/components/LocationSettings.jsx` | Geolocation helper | Configuracion, Clima |

---

## 🔀 Git Workflow

### Branch Strategy

**Main Branch**: `main` (production-ready code)
**Feature Branches**: `claude/claude-md-*` (AI-generated branches)

### Recent Commits (as of 2025-11-23)

```
dc175c2 feat: integrate Vercel Analytics
20b0d25 fix: remove default campo location
42e9ce2 chore: rename Campo App to Nimbo
a95b49f style: responsive landing header
a64d453 feat: mejoras de header y gestion de ovejas
```

### Commit Message Convention

**Format**: `type: description`

**Types**:
- `feat:` - New feature
- `fix:` - Bug fix
- `chore:` - Maintenance (dependencies, config)
- `style:` - CSS/UI changes
- `refactor:` - Code restructuring (no feature change)
- `docs:` - Documentation updates

**Examples**:
```bash
git commit -m "feat: add sheep weight tracking chart"
git commit -m "fix: correct date parsing in rainfall import"
git commit -m "chore: update dependencies to latest versions"
```

### Typical Workflow

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/add-new-feature
   ```

2. **Make Changes & Commit**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

3. **Push to Remote**
   ```bash
   git push -u origin feature/add-new-feature
   ```

4. **Create Pull Request** (on GitHub/GitLab)

5. **Merge to Main** (after review)

---

## 🚀 Deployment

### Platform: Vercel

**Current Setup**:
- Auto-deployment from `main` branch
- SPA rewrites enabled (`vercel.json`)
- Environment variables set in Vercel dashboard

### Manual Deployment

1. **Build Locally**
   ```bash
   npm run build
   ```

2. **Deploy to Vercel**
   ```bash
   npx vercel
   ```

### Environment Variables (Vercel Dashboard)

**Required** (if migrating from hardcoded values):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_OPENWEATHER_API_KEY`
- `RESEND_API_KEY` (for serverless function)
- `RESEND_FROM` (sender email)

### Serverless Function (Resend Email)

**File**: `api/send-welcome.js`

**Endpoint**: `https://your-app.vercel.app/api/send-welcome`

**Usage**:
```javascript
const response = await fetch('/api/send-welcome', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, name })
});
```

### Production Checklist

- [ ] Firebase security rules properly configured
- [ ] Environment variables set in Vercel
- [ ] Analytics enabled (Vercel Analytics)
- [ ] Custom domain configured (optional)
- [ ] Error monitoring set up (optional - Sentry, LogRocket)
- [ ] Backup strategy for Firestore data

---

## 🐛 Troubleshooting

### Common Issues & Solutions

#### Firebase Connection Errors

**Symptom**: "Firebase: Error (auth/configuration-not-found)"

**Solution**:
1. Verify credentials in `src/firebase/config.js`
2. Check Firebase Console > Project Settings
3. Ensure Authentication and Firestore are enabled

#### OpenWeatherMap API Not Working

**Symptom**: Weather page shows "Error cargando datos del clima"

**Solution**:
1. Verify API key is valid (check OpenWeatherMap dashboard)
2. API keys can take 10-20 minutes to activate after creation
3. Check browser console for specific error messages

#### Data Not Loading

**Symptom**: Empty lists, "Cargando..." never disappears

**Solution**:
1. Check Firestore security rules allow read access
2. Verify `selectedCampoId` is set (check localStorage)
3. Ensure user is authenticated (`currentUser` exists)
4. Check browser console for Firestore errors

#### Build Errors

**Symptom**: `npm run build` fails

**Solution**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite

# Try build again
npm run build
```

#### Port 3000 Already in Use

**Symptom**: "Port 3000 is already in use"

**Solution**:
```bash
# Option 1: Kill process on port 3000
lsof -ti:3000 | xargs kill

# Option 2: Use different port
vite --port 3001
```

### Debugging Tips

1. **Enable Verbose Logging**
   ```javascript
   console.log('State:', state);
   console.log('Firestore Query:', q);
   ```

2. **Check Firestore Rules Simulator** (Firebase Console)
   - Test read/write permissions
   - Verify user authentication status

3. **Browser DevTools**
   - Network tab: Check API requests
   - Console: Look for JavaScript errors
   - Application tab: Inspect localStorage, Firebase state

4. **React DevTools Extension**
   - Inspect component props/state
   - Profile render performance

---

## 🎯 Best Practices for AI Assistants

### Do's ✅

1. **Always check if `selectedCampoId` exists** before Firestore queries
2. **Include `campoId` field** in all new documents
3. **Use `serverTimestamp()`** for created/updated timestamps
4. **Clean up Firestore listeners** in `useEffect` return
5. **Validate user input** before Firestore mutations
6. **Use Spanish** for UI text, error messages, domain terms
7. **Follow component structure** (context → state → effects → handlers → render)
8. **Test with multiple campos** to ensure data isolation
9. **Use CSS variables** for colors (theme consistency)
10. **Keep components under 500 lines** (consider splitting large files)

### Don'ts ❌

1. **Don't hardcode campo IDs** - always use `selectedCampoId` from context
2. **Don't forget to check authentication** - verify `currentUser` exists
3. **Don't use `var`** - always use `const` or `let`
4. **Don't ignore errors** - always wrap Firestore ops in try-catch
5. **Don't create global state** without Context - avoid prop drilling
6. **Don't use inline styles** - prefer Tailwind classes or component classes
7. **Don't fetch all documents** - always filter by `campoId`
8. **Don't store sensitive data** in localStorage
9. **Don't break mobile responsiveness** - test on small screens
10. **Don't add English text** - maintain Spanish language consistency

### Performance Considerations

1. **Memoize context values** to prevent unnecessary re-renders
   ```javascript
   const value = useMemo(() => ({ data, loading }), [data, loading]);
   ```

2. **Use Firestore indexes** for complex queries (create via console)

3. **Limit query results** for large datasets
   ```javascript
   query(collection(db, 'items'), limit(100))
   ```

4. **Debounce search inputs**
   ```javascript
   const debouncedSearch = useDebounce(searchTerm, 300);
   ```

5. **Lazy load images** and components when possible

---

## 📖 Additional Resources

### Documentation Links

- **React**: https://react.dev/
- **Vite**: https://vitejs.dev/
- **React Router**: https://reactrouter.com/
- **Firebase**: https://firebase.google.com/docs
- **Firestore**: https://firebase.google.com/docs/firestore
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Lucide Icons**: https://lucide.dev/
- **date-fns**: https://date-fns.org/
- **Recharts**: https://recharts.org/
- **OpenWeatherMap API**: https://openweathermap.org/api

### Internal Documentation

- **README.md** - User-facing documentation
- **CONFIGURACION.md** - Step-by-step setup guide (Spanish)
- **firebase.txt** - Firebase credentials template

---

## 🔄 Changelog

### Version 1.0.0 (2025-11-23)
- **Initial CLAUDE.md creation**
- Comprehensive codebase documentation
- AI assistant guidelines established
- Development workflow documented

---

**🤖 This file was created to help AI assistants understand the Nimbo codebase and contribute effectively. Keep it updated as the project evolves!**
