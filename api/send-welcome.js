import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
    return res.status(500).json({ error: 'Email service is not configured' });
  }

  try {
    const { email, name } = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const safeName = name?.trim() || 'Productor';

    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background:#f6f7fb; padding:40px 0;">
        <table cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 20px 40px rgba(17, 37, 62, 0.1);">
          <tr>
            <td style="background:linear-gradient(135deg,#2e7d32 0%,#4caf50 100%);padding:32px 40px;color:#fff;">
              <h1 style="margin:0;font-size:28px;">¡Bienvenido a Nimbo!</h1>
              <p style="margin:8px 0 0;font-size:16px;opacity:.9;">Tu panel inteligente para gestionar el campo.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;color:#172b4d;">
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
              <a href="https://campo-app.vercel.app/login" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#2e7d32;color:#fff;text-decoration:none;font-weight:600;">
                Entrar a mi cuenta
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;background:#f8f9fb;color:#94a3b8;font-size:12px;text-align:center;">
              © ${new Date().getFullYear()} Nimbo · Gestión Agro Inteligente
            </td>
          </tr>
        </table>
      </div>
    `;

    await resend.emails.send({
      from: process.env.RESEND_FROM,
      to: email,
      subject: '¡Tu cuenta en Nimbo está lista!',
      html
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error sending welcome email', error);
    return res.status(500).json({ error: 'Could not send welcome email' });
  }
}
