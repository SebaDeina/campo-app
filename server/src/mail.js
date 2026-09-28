import { Resend } from 'resend';

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function layout(publicUrl, title, subtitle, body) {
  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background:#f6f7fb; padding:40px 0;">
      <table cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 20px 40px rgba(17, 37, 62, 0.1);">
        <tr>
          <td style="padding:20px 40px;background:#ffffff;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="vertical-align:middle;"><img src="${publicUrl}/email-logo.png" width="40" height="40" alt="Nimbo" style="display:block;border:0;"></td>
              <td style="vertical-align:middle;padding-left:10px;font-size:22px;font-weight:700;color:#2e7d32;">Nimbo</td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td bgcolor="#2e7d32" style="background-color:#2e7d32;background-image:linear-gradient(135deg,#2e7d32 0%,#4caf50 100%);padding:32px 40px;color:#fff;">
            <h1 style="margin:0;font-size:28px;">${title}</h1>
            <p style="margin:8px 0 0;font-size:16px;opacity:.9;">${subtitle}</p>
          </td>
        </tr>
        <tr><td style="padding:32px 40px;color:#172b4d;">${body}</td></tr>
        <tr>
          <td style="padding:24px 40px;background:#f8f9fb;color:#94a3b8;font-size:12px;text-align:center;">
            © ${new Date().getFullYear()} Nimbo · Gestión Agro Inteligente
          </td>
        </tr>
      </table>
    </div>`;
}

function button(href, label) {
  return `<a href="${href}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#2e7d32;color:#fff;text-decoration:none;font-weight:600;">${label}</a>`;
}

export function createMailer(config) {
  const resend = config.resend ? new Resend(config.resend.apiKey) : null;

  async function send(to, subject, html) {
    if (!resend) {
      console.warn(`[mail] Resend no configurado; no se envió "${subject}" a ${to}`);
      return;
    }
    const { error } = await resend.emails.send({ from: config.resend.from, to, subject, html });
    if (error) throw new Error(error.message || 'Resend rechazó el envío');
  }

  return {
    async sendWelcome(email, name) {
      const safeName = escapeHtml(name?.trim() || 'Productor');
      const body = `
        <p style="font-size:16px;margin:0 0 16px;">Hola ${safeName},</p>
        <p style="font-size:16px;margin:0 0 16px;line-height:1.6;">
          Tu cuenta en <strong>Nimbo</strong> se creó con éxito. Desde ahora podés registrar lluvias, organizar tareas,
          invitar a tu equipo y seguir el clima hiperlocal de tu campo.
        </p>
        <div style="background:#f5faf4;border-radius:12px;padding:18px 20px;margin:24px 0;">
          <p style="margin:0 0 10px;font-weight:600;color:#2e7d32;">Marcá estos primeros pasos:</p>
          <ul style="margin:0;padding-left:20px;color:#51606a;line-height:1.6;">
            <li>Configura tu campo y su ubicación.</li>
            <li>Invita a quienes trabajan con vos.</li>
            <li>Registra las primeras lluvias o tareas del día.</li>
          </ul>
        </div>
        <p style="margin:0 0 24px;color:#51606a;">Estamos construyendo Nimbo junto a productores como vos. Cualquier sugerencia es bienvenida.</p>
        ${button(`${config.publicUrl}/login`, 'Entrar a mi cuenta')}`;
      await send(email, '¡Bienvenido a Nimbo!', layout(config.publicUrl, '¡Bienvenido a Nimbo!', 'Tu panel inteligente para gestionar el campo.', body));
    },

    async sendPasswordReset(email, link) {
      const body = `
        <p style="font-size:16px;margin:0 0 16px;line-height:1.6;">
          Recibimos un pedido para cambiar la contraseña de tu cuenta. El enlace vence en 1 hora.
        </p>
        <p style="margin:0 0 24px;">${button(link, 'Elegir nueva contraseña')}</p>
        <p style="margin:0;color:#51606a;font-size:14px;">Si no lo pediste, ignorá este mail: tu contraseña no cambia.</p>`;
      await send(email, 'Cambiá tu contraseña de Nimbo', layout(config.publicUrl, 'Recuperar contraseña', 'Nimbo · Gestión Agro Inteligente', body));
    },
  };
}
