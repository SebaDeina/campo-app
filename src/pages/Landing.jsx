import { useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, CheckCircle2, CloudSun, Users, Shield, MapPin } from 'lucide-react';
import logoLarge from '../img/icons8-grass-100.png';

const FEATURES = [
  {
    icon: <BarChart3 size={26} />,
    title: 'Panel inteligente',
    description: 'Métricas claves del campo en tiempo real: tareas, lluvias y estado del rodeo.'
  },
  {
    icon: <CloudSun size={26} />,
    title: 'Clima hiperlocal',
    description: 'Pronóstico por coordenadas y alertas para planificar trabajos con certeza.'
  },
  {
    icon: <Users size={26} />,
    title: 'Trabajo en equipo',
    description: 'Invitá a tu veterinario o socio para actualizar datos del mismo campo.'
  },
  {
    icon: <Shield size={26} />,
    title: 'Datos seguros',
    description: 'Respaldo en Firebase con controles de acceso por proyecto y rol.'
  }
];

const STEPS = [
  { title: 'Crea tu cuenta', text: 'Registrate con tu nombre y email en menos de un minuto.' },
  { title: 'Define tu campo', text: 'Ubicación, integrantes y datos iniciales guiados paso a paso.' },
  { title: 'Invita a tu equipo', text: 'Comparte acceso seguro para que todos trabajen sincronizados.' },
  { title: 'Gestiona el día a día', text: 'Carga lluvias, tareas y ovejas desde cualquier dispositivo.' }
];

const STATS = [
  { label: 'Campos activos', value: '120+' },
  { label: 'Registros diarios', value: '8.5k' },
  { label: 'Equipos colaborando', value: '300+' }
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f7fbf4 0%, #edf5e7 60%, #ffffff 100%)' }}>
      <header style={{ padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={logoLarge} alt="Campo App" width={48} height={48} />
          <div>
            <p style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Campo App</p>
            <p style={{ margin: 0, color: '#5f6f65', fontSize: '13px' }}>Gestión agro inteligente</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => navigate('/login')} style={{ border: '1px solid var(--primary)', color: 'var(--primary)', background: 'transparent' }}>
            Iniciar sesión
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/login', { state: { mode: 'signup' } })}>
            Crear cuenta
          </button>
        </div>
      </header>

      <main style={{ padding: '0 20px 80px' }}>
        <section className="card" style={{ maxWidth: '1100px', margin: '0 auto', padding: '50px', background: 'linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)', color: 'white' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '640px' }}>
            <p style={{ textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: '13px', margin: 0 }}>La app para productores</p>
            <h1 style={{ fontSize: '48px', lineHeight: '1.1', margin: 0 }}>Control total del campo en tu bolsillo</h1>
            <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.9)' }}>
              Simplificá la gestión diaria: registrá lluvias, asigná tareas, monitoreá el clima y mantené a todo tu equipo alineado desde cualquier dispositivo.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                style={{ background: '#ffeb3b', color: '#2e7d32' }}
                onClick={() => navigate('/login', { state: { mode: 'signup' } })}
              >
                Comenzar gratis
                <ArrowRight size={18} style={{ marginLeft: '6px' }} />
              </button>
              <button
                className="btn"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.4)' }}
                onClick={() => navigate('/login')}
              >
                Ver la app
              </button>
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <p style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>{stat.value}</p>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)' }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ maxWidth: '1100px', margin: '50px auto 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          {FEATURES.map((feature) => (
            <div key={feature.title} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(46,125,50,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {feature.icon}
              </div>
              <p style={{ fontWeight: 600, margin: 0 }}>{feature.title}</p>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{feature.description}</p>
            </div>
          ))}
        </section>

        <section style={{ maxWidth: '1100px', margin: '60px auto 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '25px' }}>
          <div className="card" style={{ padding: '30px' }}>
            <p style={{ fontSize: '14px', color: 'var(--primary)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '10px' }}>
              Cómo funciona
            </p>
            <h2 style={{ marginTop: 0 }}>De la primera lluvia a la toma de decisiones</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Diseñada junto a productores y veterinarios para cubrir todo el ciclo operativo sin planillas dispersas.
            </p>
          </div>
          {STEPS.map((step, index) => (
            <div key={step.title} className="card" style={{ padding: '24px', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '20px', right: '20px', fontSize: '42px', fontWeight: 700, color: 'rgba(46,125,50,0.08)' }}>
                {index + 1}
              </div>
              <CheckCircle2 size={24} color="var(--primary)" />
              <p style={{ fontWeight: 600, marginBottom: '6px' }}>{step.title}</p>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{step.text}</p>
            </div>
          ))}
        </section>

        <section style={{ maxWidth: '1100px', margin: '60px auto 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '25px', alignItems: 'stretch' }}>
          <div className="card" style={{ padding: '30px', background: '#fef7e0' }}>
            <p style={{ fontSize: '14px', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '10px', color: '#a67c00' }}>Caso real</p>
            <h3 style={{ marginTop: 0 }}>“Un solo lugar para lluvias y tareas”</h3>
            <p style={{ color: '#5f4b00', lineHeight: 1.6 }}>
              “Antes cada uno tenía su cuaderno. Ahora el capataz, el asesor y yo vemos exactamente lo mismo y decidimos más rápido cuando mover la hacienda.” — <strong>Marcos, Estancia Don Pedro</strong>
            </p>
          </div>
          <div className="card" style={{ padding: '30px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>¿Qué podés hacer?</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                'Registrar lluvias manualmente o por importador CSV/XLSX.',
                'Asignar tareas y marcarlas completas desde el celular.',
                'Consultar el clima puntual del campo con un clic.',
                'Compartir el campo con otros usuarios con roles diferenciados.'
              ].map((item) => (
                <li key={item} style={{ display: 'flex', gap: '8px', color: 'var(--text-secondary)' }}>
                  <MapPin size={18} color="var(--primary)" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section style={{ maxWidth: '960px', margin: '70px auto 0', textAlign: 'center' }}>
          <div className="card" style={{ padding: '40px', background: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)', color: 'white' }}>
            <h2 style={{ marginTop: 0, marginBottom: '10px' }}>Listo para digitalizar tu campo</h2>
            <p style={{ marginTop: 0, marginBottom: '24px', color: 'rgba(255,255,255,0.85)' }}>
              Sin costos ocultos, soporte humano y todas las funcionalidades desde el día uno.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                style={{ background: '#ffeb3b', color: '#2e7d32' }}
                onClick={() => navigate('/login', { state: { mode: 'signup' } })}
              >
                Crear mi cuenta
              </button>
              <button
                className="btn"
                style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.4)' }}
                onClick={() => navigate('/login')}
              >
                Ingresar
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ textAlign: 'center', padding: '30px 15px', color: '#6b7b6d', fontSize: '14px' }}>
        © {new Date().getFullYear()} Campo App · Construido con productores para productores.
      </footer>
    </div>
  );
}
