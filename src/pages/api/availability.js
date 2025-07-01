// src/pages/api/availability.js
export const prerender = false;

const DIRECTUS_URL = 
  process.env.DIRECTUS_URL ||
  process.env.PUBLIC_DIRECTUS_URL ||
  'http://localhost:8055';

// Misma configuración que en reservations.js
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

// Función para extraer hora de datetime
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
  
  try {
    const searchParams = new URL(url).searchParams;
    const fecha = searchParams.get('fecha');
    const personas = parseInt(searchParams.get('personas')) || 1;
    
    if (!fecha) {
      return new Response(JSON.stringify({
        error: 'Parámetro fecha es requerido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const directusUrl = 'http://localhost:8055';
    
    // Obtener todas las reservas para la fecha
    const checkUrl = `${directusUrl}/items/reservas?filter[fecha][_eq]=${fecha}&filter[estado][_neq]=cancelada`;
    console.log('Consultando disponibilidad:', checkUrl);
    
    const response = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Error al consultar reservas existentes');
    }
    
    const reservasData = await response.json();
    console.log('Reservas encontradas:', reservasData.data?.length || 0);
    
    // Agrupar reservas por hora
    const reservasPorHora = {};
    if (reservasData.data && Array.isArray(reservasData.data)) {
      reservasData.data.forEach(reserva => {
        const hora = reserva.hora || extractHoraFromDateTime(reserva.fecha_hora);
        if (hora) {
          if (!reservasPorHora[hora]) {
            reservasPorHora[hora] = 0;
          }
          reservasPorHora[hora] += parseInt(reserva.personas || 1);
        }
      });
    }
    
    console.log('Reservas por hora:', reservasPorHora);
    
    // Calcular disponibilidad por horario
    const disponibilidad = {};
    Object.keys(CAPACIDAD_MAXIMA).forEach(hora => {
      const capacidadMaxima = CAPACIDAD_MAXIMA[hora];
      const personasReservadas = reservasPorHora[hora] || 0;
      const espaciosDisponibles = capacidadMaxima - personasReservadas;
      const disponibleParaGrupo = espaciosDisponibles >= personas;
      
      disponibilidad[hora] = {
        capacidadMaxima,
        personasReservadas,
        espaciosDisponibles,
        disponibleParaGrupo,
        porcentajeOcupacion: (personasReservadas / capacidadMaxima * 100).toFixed(1),
        estado: espaciosDisponibles === 0 ? 'lleno' : 
                espaciosDisponibles < personas ? 'insuficiente' : 'disponible'
      };
    });
    
    return new Response(JSON.stringify({
      fecha,
      personasSolicitadas: personas,
      horarios: disponibilidad,
      resumen: {
        totalHorarios: Object.keys(CAPACIDAD_MAXIMA).length,
        horariosDisponibles: Object.values(disponibilidad).filter(h => h.disponibleParaGrupo).length,
        horariosLlenos: Object.values(disponibilidad).filter(h => h.espaciosDisponibles === 0).length,
        horariosInsuficientes: Object.values(disponibilidad).filter(h => 
          h.espaciosDisponibles > 0 && h.espaciosDisponibles < personas
        ).length
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