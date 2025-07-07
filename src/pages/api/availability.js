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
    const urlFecha = `${DIRECTUS_URL}/items/configuracion_capacidad?filter[fecha_especifica][_eq]=${fecha}&filter[activo][_eq]=true&fields=capacidad_por_horario&limit=1`;
    const respFecha = await fetch(urlFecha, { headers: getHeaders() });
    if (respFecha.ok) {
      const dataFecha = await respFecha.json();
      if (dataFecha.data?.length) {
        return dataFecha.data[0].capacidad_por_horario;
      }
    }

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
    const horaClienteStr = searchParams.get('horaCliente');
    const fechaClienteStr = searchParams.get('fechaCliente');

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

    // Verificar si es hoy
    const esHoy = fecha === fechaClienteStr;
    
    // Calcular disponibilidad
    const horarios = {};
    
    Object.entries(capacidadConfig).forEach(([hora, capacidad]) => {
      const reservadas = reservasPorHora[hora] || 0;
      const hayEspacio = capacidad > reservadas;
      
      // Solo marcar como pasado si es HOY y la hora ya pasó
      let yaPaso = false;
      if (esHoy && horaClienteStr) {
        const [horaActual, minActual] = horaClienteStr.split(':').map(Number);
        const [horaSlot, minSlot] = hora.split(':').map(Number);
        
        // Comparar directamente sin margen
        if (horaSlot < horaActual) {
          yaPaso = true;
        } else if (horaSlot === horaActual && minSlot <= minActual) {
          yaPaso = true;
        }
      }

      horarios[hora] = {
        disponible: hayEspacio && !yaPaso,
        completo: !hayEspacio,
        pasado: yaPaso
      };
    });

    console.log('=== Debug Availability ===');
    console.log('Fecha seleccionada:', fecha);
    console.log('Fecha cliente:', fechaClienteStr);
    console.log('Hora cliente:', horaClienteStr);
    console.log('Es hoy?:', esHoy);
    console.log('Horarios:', horarios);

    return new Response(JSON.stringify({ horarios }), {
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