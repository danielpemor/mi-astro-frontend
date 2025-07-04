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
  // Parsear fecha correctamente para evitar problemas de zona horaria
  const [year, month, day] = fecha.split('-').map(Number);
  const fechaLocal = new Date(year, month - 1, day);
  const diaSemana = fechaLocal.getDay().toString();

  try {
    // Intentar obtener configuración específica por fecha
    const urlFecha = `${DIRECTUS_URL}/items/configuracion_capacidad?filter[fecha_especifica][_eq]=${fecha}&filter[activo][_eq]=true&fields=capacidad_por_horario&limit=1`;
    const respFecha = await fetch(urlFecha, { headers: getHeaders() });
    if (respFecha.ok) {
      const dataFecha = await respFecha.json();
      if (dataFecha.data?.length) {
        return dataFecha.data[0].capacidad_por_horario;
      }
    }

    // Intentar obtener configuración por día de semana
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

export async function GET({ url }) {
  try {
    const searchParams = new URL(url).searchParams;
    const fecha = searchParams.get('fecha');
    const horaCliente = searchParams.get('horaCliente');
    const fechaClienteStr = searchParams.get('fechaCliente'); // Nueva: fecha actual del cliente

    if (!fecha) {
      return new Response(JSON.stringify({ error: 'Fecha requerida' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener capacidad desde Directus
    const capacidadConfig = await obtenerConfiguracionCapacidad(fecha);

    // Obtener reservas
    const checkUrl = `${DIRECTUS_URL}/items/reservas?filter[fecha][_eq]=${fecha}&filter[estado][_neq]=cancelada&limit=-1`;
    const response = await fetch(checkUrl, { headers: getHeaders() });

    if (!response.ok) {
      throw new Error(`Error al consultar reservas: ${response.status}`);
    }

    const reservasData = await response.json();
    const reservas = reservasData.data || [];

    // Contar reservas por hora
    const reservasPorHora = {};
    reservas.forEach(reserva => {
      if (reserva.hora) {
        reservasPorHora[reserva.hora] = (reservasPorHora[reserva.hora] || 0) + parseInt(reserva.personas || 1);
      }
    });

    // Verificar si es hoy usando la fecha del cliente
    const esHoy = fecha === fechaClienteStr;
    
    console.log('Fecha seleccionada:', fecha);
    console.log('Fecha del cliente:', fechaClienteStr);
    console.log('Es hoy?', esHoy);

    // Calcular disponibilidad
    const horarios = {};
    
    Object.entries(capacidadConfig).forEach(([hora, capacidad]) => {
      const reservadas = reservasPorHora[hora] || 0;
      const disponible = capacidad > reservadas;
      
      // Solo marcar como pasado si es HOY
      let yaPaso = false;
      if (esHoy && horaCliente) {
        const [clienteHora, clienteMinutos] = horaCliente.split(':').map(Number);
        const [horaSlot, minutosSlot] = hora.split(':').map(Number);
        const ahora = clienteHora * 60 + clienteMinutos + 30; // 30 min margen
        const slot = horaSlot * 60 + minutosSlot;
        yaPaso = slot < ahora;
        
        console.log(`Hora ${hora}: slot=${slot}, ahora=${ahora}, yaPaso=${yaPaso}`);
      }

      horarios[hora] = {
        disponible: disponible && !yaPaso,
        completo: reservadas >= capacidad,
        pasado: yaPaso
      };
    });

    return new Response(JSON.stringify({ horarios, debug: { fecha, fechaClienteStr, esHoy } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Error al verificar disponibilidad' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}