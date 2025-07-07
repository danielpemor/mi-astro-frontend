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
  console.log('🔍 Obteniendo configuración de capacidad para:', fecha);
  
  const [year, month, day] = fecha.split('-').map(Number);
  const fechaLocal = new Date(year, month - 1, day);
  const diaSemana = fechaLocal.getDay().toString();
  
  console.log('📅 Día de semana:', diaSemana);

  try {
    // Primero buscar configuración específica por fecha
    const urlFecha = `${DIRECTUS_URL}/items/configuracion_capacidad?filter[fecha_especifica][_eq]=${fecha}&filter[activo][_eq]=true&fields=capacidad_por_horario&limit=1`;
    console.log('🔍 URL fecha específica:', urlFecha);
    
    const respFecha = await fetch(urlFecha, { headers: getHeaders() });
    if (respFecha.ok) {
      const dataFecha = await respFecha.json();
      console.log('📊 Respuesta fecha específica:', dataFecha);
      if (dataFecha.data?.length) {
        console.log('✅ Usando configuración específica de fecha');
        return dataFecha.data[0].capacidad_por_horario;
      }
    }

    // Luego buscar por día de semana
    const urlDia = `${DIRECTUS_URL}/items/configuracion_capacidad?filter[dia_semana][_eq]=${diaSemana}&filter[activo][_eq]=true&filter[fecha_especifica][_null]=true&fields=capacidad_por_horario&limit=1`;
    console.log('🔍 URL día de semana:', urlDia);
    
    const respDia = await fetch(urlDia, { headers: getHeaders() });
    if (respDia.ok) {
      const dataDia = await respDia.json();
      console.log('📊 Respuesta día de semana:', dataDia);
      if (dataDia.data?.length) {
        console.log('✅ Usando configuración de día de semana');
        return dataDia.data[0].capacidad_por_horario;
      }
    }
  } catch (e) {
    console.error('❌ Error obteniendo configuración:', e);
  }

  console.log('⚠️ Usando capacidad por defecto');
  return CAPACIDAD_DEFAULT;
}

async function obtenerReservasDelDia(fecha) {
  console.log('🔍 Obteniendo reservas del día:', fecha);
  
  try {
    const checkUrl = `${DIRECTUS_URL}/items/reservas?filter[fecha][_eq]=${fecha}&filter[estado][_neq]=cancelada&fields=hora,personas,nombre&limit=-1`;
    console.log('🔍 URL reservas:', checkUrl);
    
    const response = await fetch(checkUrl, { headers: getHeaders() });

    if (!response.ok) {
      console.error(`❌ Error al consultar reservas: ${response.status}`);
      return {};
    }

    const reservasData = await response.json();
    console.log('📊 Respuesta reservas:', reservasData);
    
    const reservas = reservasData.data || [];
    console.log('📋 Reservas encontradas:', reservas.length);

    // Contar personas por hora
    const reservasPorHora = {};
    reservas.forEach(reserva => {
      if (reserva.hora) {
        const personas = parseInt(reserva.personas) || 1;
        reservasPorHora[reserva.hora] = (reservasPorHora[reserva.hora] || 0) + personas;
        console.log(`👥 ${reserva.hora}: +${personas} personas (total: ${reservasPorHora[reserva.hora]})`);
      }
    });

    console.log('📊 Resumen reservas por hora:', reservasPorHora);
    return reservasPorHora;
  } catch (error) {
    console.error('❌ Error obteniendo reservas:', error);
    return {};
  }
}

function esHoraPasada(hora, horaClienteStr, fechaClienteStr, fechaSeleccionada) {
  // Solo verificar si es hoy
  if (fechaSeleccionada !== fechaClienteStr) {
    console.log(`⏰ ${hora}: No es hoy, no está pasada`);
    return false;
  }

  if (!horaClienteStr) {
    console.log(`⏰ ${hora}: No hay hora del cliente`);
    return false;
  }

  try {
    const [horaActual, minActual] = horaClienteStr.split(':').map(Number);
    const [horaSlot, minSlot] = hora.split(':').map(Number);
    
    // Convertir a minutos para comparar más fácil
    const minutosActuales = horaActual * 60 + minActual;
    const minutosSlot = horaSlot * 60 + minSlot;
    
    // Agregar 15 minutos de margen
    const margenMinutos = 15;
    const yaPaso = minutosSlot <= (minutosActuales + margenMinutos);
    
    console.log(`⏰ ${hora}: ${minutosSlot} <= ${minutosActuales + margenMinutos} = ${yaPaso}`);
    
    return yaPaso;
  } catch (error) {
    console.error('❌ Error comparando horas:', error);
    return false;
  }
}

export async function GET({ url }) {
  console.log('🚀 === INICIO AVAILABILITY CHECK ===');
  
  try {
    const searchParams = new URL(url).searchParams;
    const fecha = searchParams.get('fecha');
    const horaClienteStr = searchParams.get('horaCliente');
    const fechaClienteStr = searchParams.get('fechaCliente');

    console.log('📥 Parámetros recibidos:');
    console.log('  - Fecha:', fecha);
    console.log('  - Hora cliente:', horaClienteStr);
    console.log('  - Fecha cliente:', fechaClienteStr);

    if (!fecha) {
      console.log('❌ Fecha no proporcionada');
      return new Response(JSON.stringify({ error: 'Fecha requerida' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener configuración de capacidad
    const capacidadConfig = await obtenerConfiguracionCapacidad(fecha);
    console.log('📊 Capacidad configurada:', capacidadConfig);

    // Obtener reservas del día
    const reservasPorHora = await obtenerReservasDelDia(fecha);

    // Calcular disponibilidad para cada horario
    const horarios = {};
    
    console.log('🔄 Calculando disponibilidad por horario...');
    
    Object.entries(capacidadConfig).forEach(([hora, capacidadMaxima]) => {
      console.log(`\n=== PROCESANDO HORA ${hora} ===`);
      
      const personasReservadas = reservasPorHora[hora] || 0;
      const espaciosDisponibles = capacidadMaxima - personasReservadas;
      const estaCompleto = espaciosDisponibles <= 0;
      const yaPaso = esHoraPasada(hora, horaClienteStr, fechaClienteStr, fecha);
      const disponible = !estaCompleto && !yaPaso;
      
      console.log(`📊 Estadísticas para ${hora}:`);
      console.log(`  - Capacidad máxima: ${capacidadMaxima}`);
      console.log(`  - Personas reservadas: ${personasReservadas}`);
      console.log(`  - Espacios disponibles: ${espaciosDisponibles}`);
      console.log(`  - ¿Completo?: ${estaCompleto}`);
      console.log(`  - ¿Ya pasó?: ${yaPaso}`);
      console.log(`  - ¿DISPONIBLE?: ${disponible}`);
      
      horarios[hora] = {
        disponible,
        completo: estaCompleto,
        pasado: yaPaso,
        capacidadMaxima,
        personasReservadas,
        espaciosDisponibles: Math.max(0, espaciosDisponibles)
      };
    });

    console.log('\n📊 === RESUMEN FINAL ===');
    Object.entries(horarios).forEach(([hora, info]) => {
      const status = info.disponible ? '✅ DISPONIBLE' : 
                    info.completo ? '❌ COMPLETO' : 
                    info.pasado ? '⏰ PASADO' : '❌ NO DISPONIBLE';
      console.log(`${hora}: ${status}`);
    });

    const response = {
      horarios,
      debug: {
        fecha,
        fechaCliente: fechaClienteStr,
        horaCliente: horaClienteStr,
        esHoy: fecha === fechaClienteStr,
        capacidadConfig,
        reservasPorHora,
        timestamp: new Date().toISOString()
      }
    };

    console.log('📤 Enviando respuesta:', JSON.stringify(response, null, 2));
    console.log('🏁 === FIN AVAILABILITY CHECK ===\n');

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Error crítico en availability:', error);
    return new Response(JSON.stringify({ 
      error: 'Error al verificar disponibilidad',
      details: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}