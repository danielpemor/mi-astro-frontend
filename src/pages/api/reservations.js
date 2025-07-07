export const prerender = false;

const DIRECTUS_URL =
  process.env.DIRECTUS_URL ||    
  process.env.PUBLIC_DIRECTUS_URL ||        
  'http://localhost:8055';                  

const getHeaders = () => ({ 'Content-Type': 'application/json' });

const CAPACIDAD_DEFAULT = {
  '10:00': 20, '10:30': 20, '11:00': 20, '11:30': 20,
  '12:00': 20, '12:30': 20, '13:00': 25, '13:30': 25,
  '14:00': 30, '14:30': 30, '15:00': 25, '19:00': 25,
  '19:30': 25, '20:00': 30, '20:30': 30, '21:00': 25, '21:30': 20
};


async function obtenerConfiguracionCapacidad(fecha) {
  const diaSemana = new Date(fecha).getDay().toString();

  const urlFecha = `${DIRECTUS_URL}/items/configuracion_capacidad`
    + `?filter[fecha_especifica][_eq]=${fecha}&filter[activo][_eq]=true`
    + `&fields=capacidad_por_horario,descripcion&limit=1`;

  const respFecha = await fetch(urlFecha, { headers: getHeaders() });
  if (respFecha.ok) {
    const dataFecha = await respFecha.json();
    if (dataFecha.data?.length) {
      return { capacidad: dataFecha.data[0].capacidad_por_horario, tipo: 'fecha', descripcion: dataFecha.data[0].descripcion };
    }
  }

  const urlDia = `${DIRECTUS_URL}/items/configuracion_capacidad`
    + `?filter[dia_semana][_eq]=${diaSemana}&filter[activo][_eq]=true`
    + `&filter[fecha_especifica][_null]=true&fields=capacidad_por_horario,descripcion&limit=1`;

  const respDia = await fetch(urlDia, { headers: getHeaders() });
  if (respDia.ok) {
    const dataDia = await respDia.json();
    if (dataDia.data?.length) {
      return { capacidad: dataDia.data[0].capacidad_por_horario, tipo: 'dia', descripcion: dataDia.data[0].descripcion };
    }
  }

  return { capacidad: CAPACIDAD_DEFAULT, tipo: 'default', descripcion: 'Config estándar' };
}

async function obtenerCapacidadDisponible(fecha, hora) {
  const cfg = await obtenerConfiguracionCapacidad(fecha);
  const capacidadMaxima = cfg.capacidad[hora];
  if (!capacidadMaxima) return null;

  const url = `${DIRECTUS_URL}/items/reservas`
    + `?filter[fecha][_eq]=${fecha}&filter[hora][_eq]=${hora}`
    + `&filter[estado][_neq]=cancelada&fields=personas&limit=-1`;

  const resp = await fetch(url, { headers: getHeaders() });
  if (!resp.ok) return null;

  const data = await resp.json();
  const personasReservadas = (data.data || []).reduce((tot, r) => tot + (parseInt(r.personas) || 0), 0);
  const espaciosDisponibles = capacidadMaxima - personasReservadas;

  return { capacidadMaxima, personasReservadas, espaciosDisponibles, configuracion: cfg };
}

/*─────────────────────────────────────────────
  GET  – Horarios disponibles
─────────────────────────────────────────────*/
export async function GET({ url }) {
  const q = new URL(url).searchParams;
  const fecha = q.get('fecha');
  if (!fecha) return new Response(JSON.stringify({ error: 'fecha requerida' }), { status: 400 });

  const cfg = await obtenerConfiguracionCapacidad(fecha);
  const horarios = [];

  for (const hora of Object.keys(cfg.capacidad)) {
    const cap = await obtenerCapacidadDisponible(fecha, hora);
    if (cap && cap.espaciosDisponibles > 0) {
      horarios.push({ hora, ...cap });
    }
  }

  return new Response(JSON.stringify({
    fecha,
    configuracion: cfg,
    horariosDisponibles: horarios,
    total: horarios.length
  }), { status: 200 });
}

/*─────────────────────────────────────────────
  POST – Crear reserva
─────────────────────────────────────────────*/
export async function POST({ request }) {
  try {
    const body = await request.json();
    const { fecha, hora, personas } = body;
    if (!fecha || !hora || !personas) {
      return new Response(JSON.stringify({ error: 'Datos incompletos' }), { status: 400 });
    }

    const cap = await obtenerCapacidadDisponible(fecha, hora);
    if (!cap) return new Response(JSON.stringify({ error: 'Horario no disponible' }), { status: 400 });
    if (cap.espaciosDisponibles < personas) {
      return new Response(JSON.stringify({ error: 'Capacidad insuficiente', disponibles: cap.espaciosDisponibles }), { status: 409 });
    }

    const reserva = {
      ...body,
      fecha_hora: `${fecha}T${hora}:00`,
      estado: 'pendiente'
    };

    const resp = await fetch(`${DIRECTUS_URL}/items/reservas`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(reserva)
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error('Directus error:', err);
      return new Response(JSON.stringify({ error: 'Error al crear reserva' }), { status: resp.status });
    }

    const data = await resp.json();
    return new Response(JSON.stringify({ success: true, data }), { status: 200 });

  } catch (e) {
    console.error('POST /reservations error:', e);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500 });
  }
}
