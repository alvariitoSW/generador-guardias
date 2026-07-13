import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null | undefined;

function getTransporter() {
  if (transporter !== undefined) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    transporter = null;
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

/**
 * Aviso al admin de que alguien se ha registrado eligiendo un nombre de la lista.
 * No configurado (sin SMTP_*) => no hace nada, solo lo deja en el log; el admin
 * siempre puede ver los registros pendientes en el panel de Residentes.
 */
export async function notifyAdminOfRegistration(params: { residentName: string; email: string }) {
  const t = getTransporter();
  const to = process.env.ADMIN_NOTIFY_EMAIL;

  if (!t || !to) {
    console.log(
      `[registro pendiente] ${params.residentName} <${params.email}> — configura SMTP_* y ADMIN_NOTIFY_EMAIL para recibir esto por email`
    );
    return;
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: `Nuevo registro pendiente: ${params.residentName}`,
      text: `${params.residentName} se ha registrado con el email ${params.email} y ha elegido ese nombre de la lista de residentes.\n\nActiva su cuenta desde el panel de Residentes cuando confirmes que es correcto.`,
    });
  } catch (err) {
    console.error("No se pudo enviar el email de aviso de registro:", err);
  }
}
