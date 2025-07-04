export const prerender = false;

const DIRECTUS_URL =
  process.env.DIRECTUS_URL ||
  process.env.PUBLIC_DIRECTUS_URL ||
  'http://localhost:8055';

const getHeaders = () => ({ 'Content-Type': 'application/json' });

// Capacidad por defecto (fallback)
const CAPACIDAD_DEFAULT = {
  '10:00': 20, '10:30': 20, '11:00': 20, '11:30': 20,
  '12:00': 20, '12:30': 20, '13:00': 25, '13:30': 25,
  '14:00': 30, '14:30': 30, '15:00': 25, '19:00': 25,
  '19:30': 25, '20:00': 30, '20:30': 30, '21:00': 25, '21:30': 20
};

// Función para obtener configuración de capacidad desde Directus
async function obtenerConfiguracionCapacidad(fecha) {
  const diaSemana = new Date(fecha).getDay().toString();

  // 1. Configuración específica por fecha
  const urlFecha = `${DIRECTUS_URL}/items/configuracion_capacidad`
    + `?filter[fecha_especifica][_eq]=${fecha}&filter[activo][_eq]=true`
    + `&fields=capacidad_por_horario,descripcion&limit=1`;

  try {
    const respFecha = await fetch(urlFecha, { headers: getHeaders() });
    if (respFecha.ok) {
      const dataFecha = await respFecha.json();
      if (dataFecha.data?.length) {
        return { 
          capacidad: dataFecha.data[0].capacidad_por_horario, 
          tipo: 'fecha', 
          descripcion: dataFecha.data[0].descripcion 
        };
      }
    }
  } catch (e) {
    console.error('Error obteniendo config por fecha:', e);
  }

  // 2. Configuración por día de semana
  const urlDia = `${DIRECTUS_URL}/items/configuracion_capacidad`
    + `?filter[dia_semana][_eq]=${diaSemana}&filter[activo][_eq]=true`
    + `&filter[fecha_especifica][_null]=true&fields=capacidad_por_horario,descripcion&limit=1`;

  try {
    const respDia = await fetch(urlDia, { headers: getHeaders() });
    if (respDia.ok) {
      const dataDia = await respDia.json();
      if (dataDia.data?.length) {
        return { 
          capacidad: dataDia.data[0].capacidad_por_horario, 
          tipo: 'dia', 
          descripcion: dataDia.data[0].descripcion 
        };
      }
    }
  } catch (e) {
    console.error('Error obteniendo config por día:', e);
  }

  // 3. Default
  return { capacidad: CAPACIDAD_DEFAULT, tipo: 'default', descripcion: 'Config estándar' };
}

export async function GET({ url }) {
  console.log('=== API Availability llamada ===');

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

    // Obtener configuración de capacidad desde Directus
    const config = await obtenerConfiguracionCapacidad(fecha);
    console.log('Configuración obtenida:', config);

    // Obtener reservas para esa fecha
    const checkUrl = `${DIRECTUS_URL}/items/reservas?filter[fecha][_eq]=${fecha}&filter[estado][_neq]=cancelada&limit=-1`;
    const response = await fetch(checkUrl, { headers: getHeaders() });

    if (!response.ok) {
      throw new Error(`Error al consultar Directus: ${response.status}`);
    }

    const reservasData = await response.json();
    const reservas = reservasData.data || [];
    console.log(`Reservas encontradas para ${fecha}: ${reservas.length}`);

    // Agrupar reservas por hora
    const reservasPorHora = {};
    for (const reserva of reservas) {
      const hora = reserva.hora;
      if (!hora) continue;
      if (!reservasPorHora[hora]) reservasPorHora[hora] = 0;
      reservasPorHora[hora] += parseInt(reserva.personas || 1);
    }

    // Calcular disponibilidad por horario
    const disponibilidad = {};
    const ahora = new Date();
    const esHoy = new Date(fecha).toDateString() === ahora.toDateString();
    
    // Obtener hora actual con 30 minutos de margen
    const horaActualMinutos = ahora.getHours() * 60 + ahora.getMinutes() + 30;

    Object.entries(config.capacidad).forEach(([hora, capacidadMaxima]) => {
      const personasReservadas = reservasPorHora[hora] || 0;
      const espaciosDisponibles = capacidadMaxima - personasReservadas;
      
      // Verificar si el horario ya pasó
      let estaPasado = false;
      if (esHoy) {
        const [h, m] = hora.split(':').map(Number);
        const horaMinutos = h * 60 + m;
        estaPasado = horaMinutos < horaActualMinutos;
      }
      
      disponibilidad[hora] = {
        capacidadMaxima,
        personasReservadas,
        espaciosDisponibles: estaPasado ? 0 : espaciosDisponibles,
        disponibleParaGrupo: !estaPasado && espaciosDisponibles >= personas,
        porcentajeOcupacion: ((personasReservadas / capacidadMaxima) * 100).toFixed(1),
        estado: estaPasado ? 'pasado' :
          espaciosDisponibles === 0 ? 'lleno' :
          espaciosDisponibles < personas ? 'insuficiente' :
          espaciosDisponibles <= 5 ? 'casi_lleno' : 'disponible'
      };
    });

    return new Response(JSON.stringify({
      fecha,
      configuracion: {
        tipo: config.tipo,
        descripcion: config.descripcion
      },
      horarios: disponibilidad,
      resumen: {
        horariosDisponibles: Object.values(disponibilidad).filter(h => h.disponibleParaGrupo).length,
        horariosLlenos: Object.values(disponibilidad).filter(h => h.estado === 'lleno').length,
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