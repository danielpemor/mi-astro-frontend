export const prerender = false;

const DIRECTUS_URL =
  process.env.DIRECTUS_URL ||
  process.env.PUBLIC_DIRECTUS_URL ||
  'http://localhost:8055';

const getHeaders = () => ({ 'Content-Type': 'application/json' });

// Capacidad por defecto
const CAPACIDAD_DEFAULT = {
  '10:00': 20, '10:30': 20, '11:00': 20, '11:30': 20,
  '12:00': 20, '12:30': 20, '13:00': 25, '13:30': 25,
  '14:00': 30, '14:30': 30, '15:00': 25, '19:00': 25,
  '19:30': 25, '20:00': 30, '20:30': 30, '21:00': 25, '21:30': 20
};

async function obtenerConfiguracionCapacidad(fecha) {
  const [year, month, day] = fecha.split('-').map(Number);
  const fechaLocal = new Date(year, month - 1, day);
  const diaSemana = fechaLocal.getDay().toString();

  try {
    // Primero buscar configuración específica por fecha
    const urlFecha = `${DIRECTUS_URL}/items/configuracion_capacidad?filter[fecha_especifica][_eq]=${fecha}&filter[activo][_eq]=true&fields=capacidad_por_horario&limit=1`;
    const respFecha = await fetch(urlFecha, { headers: getHeaders() });
    if (respFecha.ok) {
      const dataFecha = await respFecha.json();
      if (dataFecha.data?.length) {
        return dataFecha.data[0].capacidad_por_horario;
      }
    }

    // Luego buscar por día de semana
    const urlDia = `${DIRECTUS_URL}/items/configuracion_capacidad?filter[dia_semana][_eq]=${diaSemana}&filter[activo][_eq]=true&filter[fecha_especifica][_null]=true&fields=capacidad_por_horario&limit=1`;
    const respDia = await fetch(urlDia, { headers: getHeaders() });
    if (respDia.ok) {
      const dataDia = await respDia.json();
      if (dataDia.data?.length) {
        return dataDia.data[0].capacidad_por_horario;
      }
    }
  } catch (e) {
    console.error('Error obteniendo configuración:', e);
  }

  return CAPACIDAD_DEFAULT;
}

async function obtenerReservasDelDia(fecha) {
  try {
    const checkUrl = `${DIRECTUS_URL}/items/reservas?filter[fecha][_eq]=${fecha}&filter[estado][_neq]=cancelada&fields=hora,personas&limit=-1`;
    const response = await fetch(checkUrl, { headers: getHeaders() });

    if (!response.ok) {
      console.error(`Error al consultar reservas: ${response.status}`);
      return {};
    }

    const reservasData = await response.json();
    const reservas = reservasData.data || [];

    // Contar personas por hora
    const reservasPorHora = {};
    reservas.forEach(reserva => {
      if (reserva.hora) {
        const personas = parseInt(reserva.personas) || 1;
        reservasPorHora[reserva.hora] = (reservasPorHora[reserva.hora] || 0) + personas;
      }
    });

    return reservasPorHora;
  } catch (error) {
    console.error('Error obteniendo reservas:', error);
    return {};
  }
}

function esHoraPasada(hora, horaClienteStr, fechaClienteStr, fechaSeleccionada) {
  // Solo verificar si es hoy
  if (fechaSeleccionada !== fechaClienteStr) {
    return false;
  }

  if (!horaClienteStr) {
    return false;
  }

  try {
    const [horaActual, minActual] = horaClienteStr.split(':').map(Number);
    const [horaSlot, minSlot] = hora.split(':').map(Number);
    
    // Convertir a minutos para comparar más fácil
    const minutosActuales = horaActual * 60 + minActual;
    const minutosSlot = horaSlot * 60 + minSlot;
    
    // Agregar 15 minutos de margen para que no se pueda reservar muy cerca
    return minutosSlot <= (minutosActuales + 0);
  } catch (error) {
    console.error('Error comparando horas:', error);
    return false;
  }
}

export async function GET({ url }) {
  try {
    const searchParams = new URL(url).searchParams;
    const fecha = searchParams.get('fecha');
    const horaClienteStr = searchParams.get('horaCliente');
    const fechaClienteStr = searchParams.get('fechaCliente');

    if (!fecha) {
      return new Response(JSON.stringify({ error: 'Fecha requerida' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('=== Availability Check ===');
    console.log('Fecha:', fecha);
    console.log('Hora cliente:', horaClienteStr);
    console.log('Fecha cliente:', fechaClienteStr);

    // Obtener configuración de capacidad
    const capacidadConfig = await obtenerConfiguracionCapacidad(fecha);
    console.log('Capacidad config:', capacidadConfig);

    // Obtener reservas del día
    const reservasPorHora = await obtenerReservasDelDia(fecha);
    console.log('Reservas por hora:', reservasPorHora);

    // Calcular disponibilidad para cada horario
    const horarios = {};
    
    Object.entries(capacidadConfig).forEach(([hora, capacidadMaxima]) => {
      const personasReservadas = reservasPorHora[hora] || 0;
      const espaciosDisponibles = capacidadMaxima - personasReservadas;
      const estaCompleto = espaciosDisponibles <= 0;
      const yaPaso = esHoraPasada(hora, horaClienteStr, fechaClienteStr, fecha);
      
      horarios[hora] = {
        disponible: !estaCompleto && !yaPaso,
        completo: estaCompleto,
        pasado: yaPaso,
        capacidadMaxima,
        personasReservadas,
        espaciosDisponibles: Math.max(0, espaciosDisponibles)
      };
      
      console.log(`${hora}: disponible=${!estaCompleto && !yaPaso}, completo=${estaCompleto}, pasado=${yaPaso}, espacios=${espaciosDisponibles}`);
    });

    return new Response(JSON.stringify({ 
      horarios,
      debug: {
        fecha,
        fechaCliente: fechaClienteStr,
        horaCliente: horaClienteStr,
        esHoy: fecha === fechaClienteStr
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error en availability:', error);
    return new Response(JSON.stringify({ 
      error: 'Error al verificar disponibilidad',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}