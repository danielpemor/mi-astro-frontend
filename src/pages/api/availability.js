// src/pages/api/availability.js
export const prerender = false;

// ---------------------------
// Configuración de Directus
// ---------------------------
const DIRECTUS_URL =
  process.env.DIRECTUS_URL ||
  process.env.PUBLIC_DIRECTUS_URL ||
  'http://localhost:8055';

// ---------------------------
// Capacidad máxima por horario
// ---------------------------
const CAPACIDAD_MAXIMA = {
  '10:00': 1,
  '10:30': 20,
  '11:00': 20,
  '11:30': 20,
  '12:00': 20,
  '12:30': 20,
  '13:00': 25,
  '13:30': 25,
  '14:00': 30,
  '14:30': 30,
  '15:00': 25,
  '19:00': 25,
  '19:30': 25,
  '20:00': 30,
  '20:30': 30,
  '21:00': 25,
  '21:30': 20,
  '22:00': 20
};

// ---------------------------
// Helpers
// ---------------------------
function extractHoraFromDateTime(fechaHora) {
  try {
    const d = new Date(fechaHora);
    return d.toISOString().slice(11, 16); // "HH:MM"
  } catch {
    return null;
  }
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// ---------------------------
// Endpoint
// ---------------------------
export async function GET({ url }) {
  try {
    const params     = new URL(url).searchParams;
    const fecha      = params.get('fecha');           // YYYY-MM-DD
    const personas   = parseInt(params.get('personas') || '1', 10);
    const tz         = params.get('tz') || 'America/Mexico_City';

    if (!fecha) {
      return new Response(JSON.stringify({ error: '"fecha" requerida' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    /* -------- Cargar reservas existentes -------- */
    const q = `${DIRECTUS_URL}/items/reservas?filter[fecha][_eq]=${fecha}&filter[estado][_neq]=cancelada&limit=-1`;
    const r = await fetch(q);
    if (!r.ok) throw new Error(`Directus ${r.status} ${r.statusText}`);
    const reservas = (await r.json()).data || [];

    const reservasPorHora = {};
    reservas.forEach(res => {
      const h = res.hora || extractHoraFromDateTime(res.fecha_hora);
      if (!h) return;
      reservasPorHora[h] = (reservasPorHora[h] || 0) + parseInt(res.personas || 1, 10);
    });

    /* -------- Datos de zona horaria -------- */
    const ahoraTz = new Date(
      new Intl.DateTimeFormat('sv-SE', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(new Date())          // "HH:MM:SS" en la tz del navegador
    );
    const hoyISO = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, dateStyle: 'short' })
                     .format(new Date())            // "YYYY-MM-DD" con tz correcta
                     .replace(/-/g, '-');           // mismo formato

    const minutosAhora = ahoraTz.getHours() * 60 + ahoraTz.getMinutes();
    const esHoyCliente = fecha === hoyISO;

    /* -------- Construir disponibilidad -------- */
    const disponibilidad = {};
    for (const hora of Object.keys(CAPACIDAD_MAXIMA)) {
      const capacidadMaxima     = CAPACIDAD_MAXIMA[hora];
      const personasReservadas  = reservasPorHora[hora] || 0;
      const espaciosDisponibles = capacidadMaxima - personasReservadas;
      const disponibleParaGrupo = espaciosDisponibles >= personas;

      disponibilidad[hora] = {
        capacidadMaxima,
        personasReservadas,
        espaciosDisponibles,
        disponibleParaGrupo,
        estado:
          espaciosDisponibles === 0
            ? 'lleno'
            : espaciosDisponibles < personas
            ? 'insuficiente'
            : 'disponible',
        pasada:
          esHoyCliente && toMinutes(hora) <= minutosAhora // útil para el frontend
      };
    }

    return new Response(JSON.stringify({
      fecha,
      tz,
      minutosAhora: esHoyCliente ? minutosAhora : null,
      personasSolicitadas: personas,
      horarios: disponibilidad
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Availability error:', err);
    return new Response(JSON.stringify({
      error: 'Error al verificar disponibilidad',
      message: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
