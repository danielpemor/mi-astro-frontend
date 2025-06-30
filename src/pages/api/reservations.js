// src/pages/api/reservations.js
export const prerender = false;

// Configuración de capacidad por defecto (fallback)
const CAPACIDAD_DEFAULT = {
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
  '21:30': 20
};

// Configuración de Directus
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055';

// Headers básicos (sin autenticación - para endpoints públicos)
const getHeaders = () => {
  return { 'Content-Type': 'application/json' };
};

// Función para obtener la configuración de capacidad para una fecha específica
async function obtenerConfiguracionCapacidad(fecha) {
  // Convertir fecha a objeto Date para obtener día de la semana
  const fechaObj = new Date(fecha);
  const diaSemana = fechaObj.getDay().toString(); // 0=Domingo, 1=Lunes, etc.
  
  console.log(`📅 Obteniendo configuración para fecha: ${fecha}, Día de la semana: ${diaSemana}`);
  
  try {
    // 1. Buscar configuración para fecha específica (prioridad alta)
    const configFechaUrl = `${DIRECTUS_URL}/items/configuracion_capacidad?filter[fecha_especifica][_eq]=${fecha}&filter[activo][_eq]=true&fields=id,capacidad_por_horario,descripcion&limit=1`;
    
    const responseFecha = await fetch(configFechaUrl, {
      method: 'GET',
      headers: getHeaders(),
    });
    
    if (responseFecha.ok) {
      const dataFecha = await responseFecha.json();
      if (dataFecha.data && dataFecha.data.length > 0) {
        console.log(`🎯 Usando configuración específica para ${fecha}: ${dataFecha.data[0].descripcion}`);
        return {
          capacidad: dataFecha.data[0].capacidad_por_horario,
          tipo: 'fecha_especifica',
          descripcion: dataFecha.data[0].descripcion
        };
      }
    }
    
    // 2. Buscar configuración para día de la semana
    const configDiaUrl = `${DIRECTUS_URL}/items/configuracion_capacidad?filter[dia_semana][_eq]=${diaSemana}&filter[activo][_eq]=true&filter[fecha_especifica][_null]=true&fields=id,capacidad_por_horario,descripcion&limit=1`;
    
    const responseDia = await fetch(configDiaUrl, {
      method: 'GET',
      headers: getHeaders(),
    });
    
    if (responseDia.ok) {
      const dataDia = await responseDia.json();
      if (dataDia.data && dataDia.data.length > 0) {
        console.log(`📆 Usando configuración para día de semana ${diaSemana}: ${dataDia.data[0].descripcion}`);
        return {
          capacidad: dataDia.data[0].capacidad_por_horario,
          tipo: 'dia_semana',
          descripcion: dataDia.data[0].descripcion
        };
      }
    }
    
    // 3. Usar configuración por defecto
    console.log('⚙️ Usando configuración por defecto');
    return {
      capacidad: CAPACIDAD_DEFAULT,
      tipo: 'default',
      descripcion: 'Configuración estándar'
    };
    
  } catch (error) {
    console.error('❌ Error al obtener configuración, usando valores por defecto:', error);
    return {
      capacidad: CAPACIDAD_DEFAULT,
      tipo: 'default',
      descripcion: 'Configuración estándar (fallback)'
    };
  }
}

// Función para obtener capacidad disponible CON CONFIGURACIÓN DINÁMICA
async function obtenerCapacidadDisponible(fecha, hora) {
  // Obtener configuración de capacidad para esta fecha
  const configCapacidad = await obtenerConfiguracionCapacidad(fecha);
  const CAPACIDAD_MAXIMA = configCapacidad.capacidad;
  
  if (!CAPACIDAD_MAXIMA || !CAPACIDAD_MAXIMA[hora]) {
    console.log(`❌ Horario ${hora} no disponible en la configuración para ${fecha}`);
    return null;
  }
  
  const checkUrl = `${DIRECTUS_URL}/items/reservas?filter[fecha][_eq]=${fecha}&filter[hora][_eq]=${hora}&filter[estado][_neq]=cancelada&fields=id,personas,estado&limit=-1`;
  
  try {
    const response = await fetch(checkUrl, {
      method: 'GET',
      headers: getHeaders(),
    });
    
    if (!response.ok) {
      console.error(`Error al consultar reservas: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const reservasData = await response.json();
    console.log(`📊 Reservas encontradas para ${fecha} ${hora}:`, reservasData.data?.length || 0);
    
    const personasReservadas = (reservasData.data || []).reduce((total, reserva) => {
      const personas = parseInt(reserva.personas || 0);
      console.log(`   - Reserva ${reserva.id}: ${personas} personas (${reserva.estado})`);
      return total + personas;
    }, 0);
    
    const capacidadMaxima = CAPACIDAD_MAXIMA[hora];
    const espaciosDisponibles = capacidadMaxima - personasReservadas;
    
    console.log(`📈 Capacidad para ${hora}: ${capacidadMaxima} (${configCapacidad.descripcion})`);
    console.log(`👥 Reservadas: ${personasReservadas}, Disponibles: ${espaciosDisponibles}`);
    
    return {
      capacidadMaxima,
      personasReservadas,
      espaciosDisponibles,
      configuracion: configCapacidad
    };
  } catch (error) {
    console.error('Error al obtener capacidad:', error);
    return null;
  }
}

// GET - Obtener horarios disponibles con configuración dinámica
export async function GET({ url }) {
  const searchParams = new URL(url).searchParams;
  const fecha = searchParams.get('fecha');
  
  if (!fecha) {
    return new Response(JSON.stringify({ 
      error: 'Parámetro fecha requerido' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  try {
    // Obtener configuración para esta fecha
    const configCapacidad = await obtenerConfiguracionCapacidad(fecha);
    const CAPACIDAD_MAXIMA = configCapacidad.capacidad;
    
    const horariosDisponibles = [];
    
    for (const hora of Object.keys(CAPACIDAD_MAXIMA)) {
      const capacidadInfo = await obtenerCapacidadDisponible(fecha, hora);
      
      if (capacidadInfo && capacidadInfo.espaciosDisponibles > 0) {
        horariosDisponibles.push({
          hora,
          capacidadMaxima: capacidadInfo.capacidadMaxima,
          personasReservadas: capacidadInfo.personasReservadas,
          espaciosDisponibles: capacidadInfo.espaciosDisponibles,
          disponible: true
        });
      }
    }
    
    return new Response(JSON.stringify({
      fecha,
      configuracion: {
        tipo: configCapacidad.tipo,
        descripcion: configCapacidad.descripcion
      },
      horariosDisponibles,
      total: horariosDisponibles.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error en GET /api/reservations:', error);
    return new Response(JSON.stringify({ 
      error: 'Error al consultar disponibilidad' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST - Crear reservas con validación previa y configuración dinámica
export async function POST({ request }) {
  try {
    const reservationData = await request.json();
    const { fecha, hora, personas } = reservationData;
    
    console.log('🔍 Nueva solicitud de reserva:', { fecha, hora, personas });
    
    // Validaciones básicas del frontend
    if (!fecha || !hora || !personas) {
      console.log('❌ Datos incompletos');
      return new Response(JSON.stringify({
        success: false,
        error: 'Datos incompletos',
        message: 'Por favor completa todos los campos requeridos'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const personasNum = parseInt(personas);
    if (isNaN(personasNum) || personasNum <= 0) {
      console.log('❌ Número de personas inválido');
      return new Response(JSON.stringify({
        success: false,
        error: 'Número de personas inválido',
        message: 'Por favor ingresa un número válido de personas'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // VALIDACIÓN PREVIA DE CAPACIDAD (antes de enviar a Directus)
    console.log('🔍 Verificando capacidad disponible...');
    const capacidadInfo = await obtenerCapacidadDisponible(fecha, hora);
    
    if (!capacidadInfo) {
      console.log('❌ Error al verificar capacidad o horario no disponible');
      return new Response(JSON.stringify({
        success: false,
        error: 'Horario no disponible',
        message: `El horario ${hora} no está disponible para la fecha ${fecha}.`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (capacidadInfo.espaciosDisponibles < personasNum) {
      console.log(`❌ Capacidad insuficiente: Disponibles ${capacidadInfo.espaciosDisponibles}, Solicitadas ${personasNum}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Capacidad insuficiente',
        message: `Solo quedan ${capacidadInfo.espaciosDisponibles} espacios disponibles para el horario de las ${hora} el ${fecha}, pero solicitas ${personasNum} personas. (${capacidadInfo.configuracion.descripcion})`
      }), {
        status: 409, // Conflict
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Preparar datos para Directus
    const fechaHora = `${fecha}T${hora}:00`;
    const directusData = {
      ...reservationData,
      fecha_hora: fechaHora,
      estado: 'pendiente',
      personas: personasNum
    };
    
    console.log('📤 Enviando a Directus:', directusData);
    console.log(`⚙️ Configuración aplicada: ${capacidadInfo.configuracion.descripcion}`);
    
    // Enviar a Directus - la validación de capacidad se hace allí también (doble seguridad)
    const directusCreateUrl = `${DIRECTUS_URL}/items/reservas`;
    const response = await fetch(directusCreateUrl, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(directusData)
    });
    
    console.log(`📥 Respuesta de Directus: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Reserva creada exitosamente:', result.data?.id);
      
      return new Response(JSON.stringify({
        success: true,
        data: result,
        configuracion: capacidadInfo.configuracion,
        message: `¡Reserva confirmada! Tu mesa para ${personas} personas está reservada el ${fecha} a las ${hora}. Por favor revisa tu email (incluyendo la carpeta de spam) para ver los detalles de tu reserva.`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      
    } else {
      // Manejar errores de Directus
      let errorData;
      try {
        errorData = await response.json();
        console.log('❌ Error de Directus:', errorData);
      } catch (e) {
        console.log('❌ Error al parsear respuesta de Directus');
        errorData = { message: 'Error desconocido' };
      }
      
      const errorMessage = errorData.errors?.[0]?.message || errorData.message || 'Error al procesar la reserva';
      
      let userMessage = 'Hubo un problema al procesar tu reserva. Por favor intenta nuevamente.';
      let statusCode = response.status;
      
      if (errorMessage.includes('Capacidad insuficiente')) {
        userMessage = errorMessage;
        statusCode = 409;
      } else if (errorMessage.includes('Horario') && errorMessage.includes('no está disponible')) {
        userMessage = 'El horario seleccionado no está disponible para la fecha especificada.';
        statusCode = 400;
      } else if (errorMessage.includes('Datos de reserva incompletos')) {
        userMessage = 'Faltan datos requeridos para la reserva.';
        statusCode = 400;
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Validación fallida',
        message: userMessage,
        details: process.env.NODE_ENV === 'development' ? errorData : undefined
      }), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
  } catch (error) {
    console.error('💥 Error en POST /api/reservations:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Error interno',
      message: 'Ocurrió un error inesperado. Por favor intenta nuevamente.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// PUT - Actualizar reserva (opcional)
export async function PUT({ request }) {
  try {
    const { id, ...updateData } = await request.json();
    
    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de reserva requerido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const directusUpdateUrl = `${DIRECTUS_URL}/items/reservas/${id}`;
    const response = await fetch(directusUpdateUrl, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updateData)
    });
    
    if (response.ok) {
      const result = await response.json();
      return new Response(JSON.stringify({
        success: true,
        data: result,
        message: 'Reserva actualizada exitosamente'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      const errorData = await response.json();
      return new Response(JSON.stringify({
        success: false,
        error: 'Error al actualizar',
        message: 'No se pudo actualizar la reserva'
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
  } catch (error) {
    console.error('Error en PUT /api/reservations:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno',
      message: 'Error al actualizar la reserva'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// DELETE - Cancelar reserva
export async function DELETE({ url }) {
  try {
    const searchParams = new URL(url).searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de reserva requerido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // En lugar de eliminar, cambiar estado a 'cancelada'
    const directusUpdateUrl = `${DIRECTUS_URL}/items/reservas/${id}`;
    const response = await fetch(directusUpdateUrl, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ estado: 'cancelada' })
    });
    
    if (response.ok) {
      const result = await response.json();
      return new Response(JSON.stringify({
        success: true,
        data: result,
        message: 'Reserva cancelada exitosamente'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Error al cancelar',
        message: 'No se pudo cancelar la reserva'
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
  } catch (error) {
    console.error('Error en DELETE /api/reservations:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno',
      message: 'Error al cancelar la reserva'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}