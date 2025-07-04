export const prerender = false;

// Configuración de Directus
const DIRECTUS_URL =
  process.env.DIRECTUS_URL ||
  process.env.PUBLIC_DIRECTUS_URL ||
  'http://localhost:8055';

// Capacidad máxima por horario
const CAPACIDAD_MAXIMA = {
  '10:00': 20,
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

// Función para extraer hora desde datetime
function extractHoraFromDateTime(fechaHora) {
  if (!fechaHora) return null;
  try {
    const date = new Date(fechaHora);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (e) {
    console.error('Error extrayendo hora:', e);
    return null;
  }
}

export async function GET({ url }) {
  console.log('=== API Availability llamada ===');
  console.log('DIRECTUS_URL:', DIRECTUS_URL);

  try {
    const searchParams = new URL(url).searchParams;
    const fecha = searchParams.get('fecha');
    const personas = parseInt(searchParams.get('personas')) || 1;

    if (!fecha) {
      return new Response(JSON.stringify({
        error: 'Parámetro "fecha" es requerido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verificar si la fecha es pasada
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaReserva = new Date(fecha + 'T00:00:00');
    
    if (fechaReserva < hoy) {
      return new Response(JSON.stringify({
        error: 'No se pueden hacer reservas para fechas pasadas'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener reservas para esa fecha (excepto canceladas)
    const checkUrl = `${DIRECTUS_URL}/items/reservas?filter[fecha][_eq]=${fecha}&filter[estado][_neq]=cancelada&limit=-1`;
    console.log('Consultando disponibilidad en:', checkUrl);

    const response = await fetch(checkUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Error al consultar Directus: ${response.status} ${response.statusText}`);
    }

    const reservasData = await response.json();
    const reservas = reservasData.data || [];
    console.log(`Reservas encontradas: ${reservas.length}`);

    // Agrupar reservas por hora
    const reservasPorHora = {};
    for (const reserva of reservas) {
      const hora = reserva.hora || extractHoraFromDateTime(reserva.fecha_hora);
      if (!hora) continue;
      if (!reservasPorHora[hora]) reservasPorHora[hora] = 0;
      reservasPorHora[hora] += parseInt(reserva.personas || 1);
    }

    // Calcular disponibilidad por horario
    const disponibilidad = {};
    let totalCapacidad = 0;
    let totalReservado = 0;
    
    for (const hora of Object.keys(CAPACIDAD_MAXIMA)) {
      const capacidadMaxima = CAPACIDAD_MAXIMA[hora];
      const personasReservadas = reservasPorHora[hora] || 0;
      const espaciosDisponibles = capacidadMaxima - personasReservadas;
      const disponibleParaGrupo = espaciosDisponibles >= personas;
      
      totalCapacidad += capacidadMaxima;
      totalReservado += personasReservadas;

      disponibilidad[hora] = {
        capacidadMaxima,
        personasReservadas,
        espaciosDisponibles,
        disponibleParaGrupo,
        porcentajeOcupacion: ((personasReservadas / capacidadMaxima) * 100).toFixed(1),
        estado:
          espaciosDisponibles === 0
            ? 'lleno'
            : espaciosDisponibles < personas
            ? 'insuficiente'
            : espaciosDisponibles <= 5
            ? 'casi_lleno'
            : 'disponible'
      };
    }

    // Si es hoy, filtrar horarios pasados
    if (fechaReserva.toDateString() === hoy.toDateString()) {
      const horaActual = new Date();
      const horaActualStr = `${horaActual.getHours().toString().padStart(2, '0')}:${horaActual.getMinutes().toString().padStart(2, '0')}`;
      
      for (const hora of Object.keys(disponibilidad)) {
        if (hora < horaActualStr) {
          disponibilidad[hora].estado = 'pasado';
          disponibilidad[hora].espaciosDisponibles = 0;
          disponibilidad[hora].disponibleParaGrupo = false;
        }
      }
    }

    return new Response(JSON.stringify({
      fecha,
      personasSolicitadas: personas,
      horarios: disponibilidad,
      resumen: {
        totalHorarios: Object.keys(CAPACIDAD_MAXIMA).length,
        horariosDisponibles: Object.values(disponibilidad).filter(h => h.disponibleParaGrupo && h.estado !== 'pasado').length,
        horariosLlenos: Object.values(disponibilidad).filter(h => h.espaciosDisponibles === 0).length,
        horariosInsuficientes: Object.values(disponibilidad).filter(h =>
          h.espaciosDisponibles > 0 && h.espaciosDisponibles < personas
        ).length,
        capacidadTotal: totalCapacidad,
        personasReservadas: totalReservado,
        porcentajeOcupacionGeneral: ((totalReservado / totalCapacidad) * 100).toFixed(1)
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error en API Availability:', error);
    return new Response(JSON.stringify({
      error: 'Error al verificar disponibilidad',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}