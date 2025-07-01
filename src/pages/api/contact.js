// src/pages/api/contact.js
export const prerender = false;

// Configuración de Directus
const DIRECTUS_URL = 
  process.env.DIRECTUS_URL ||
  process.env.PUBLIC_DIRECTUS_URL ||
  'http://localhost:8055';

// Headers básicos (sin autenticación - para endpoints públicos)
const getHeaders = () => {
  return { 'Content-Type': 'application/json' };
};

// Función para validar email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Función para sanitizar y validar datos de entrada
function validateContactData(data) {
  const { nombre, email, telefono, asunto, mensaje } = data;
  const errors = [];

  // Validar nombre (requerido)
  if (!nombre || nombre.trim().length < 2) {
    errors.push('El nombre debe tener al menos 2 caracteres');
  }

  // Validar email (requerido y formato válido)
  if (!email || !isValidEmail(email)) {
    errors.push('Por favor ingresa un email válido');
  }

  // Validar teléfono (opcional pero si se proporciona debe tener formato básico)
  if (telefono && telefono.trim().length > 0) {
    const telefonoClean = telefono.replace(/[\s\-\(\)]/g, '');
    if (telefonoClean.length < 10) {
      errors.push('El teléfono debe tener al menos 10 dígitos');
    }
  }

  // Validar asunto (requerido)
  if (!asunto || asunto.trim().length < 3) {
    errors.push('El asunto debe tener al menos 3 caracteres');
  }

  // Validar mensaje (requerido)
  if (!mensaje || mensaje.trim().length < 10) {
    errors.push('El mensaje debe tener al menos 10 caracteres');
  }

  return {
    isValid: errors.length === 0,
    errors,
    cleanData: {
      nombre: nombre?.trim(),
      email: email?.trim().toLowerCase(),
      telefono: telefono?.trim() || null,
      asunto: asunto?.trim(),
      mensaje: mensaje?.trim()
    }
  };
}

// GET - Obtener mensajes de contacto (opcional, para admin)
export async function GET({ url }) {
  const searchParams = new URL(url).searchParams;
  const limite = searchParams.get('limite') || '10';
  const pagina = searchParams.get('pagina') || '1';
  const estado = searchParams.get('estado'); // 'nuevo', 'leido', 'respondido', 'archivado'
  
  try {
    let filtros = [];
    
    // Filtrar por estado si se especifica
    if (estado) {
      filtros.push(`filter[estado][_eq]=${estado}`);
    }
    
    // Construir URL con filtros
    const filtrosQuery = filtros.length > 0 ? `&${filtros.join('&')}` : '';
    const offset = (parseInt(pagina) - 1) * parseInt(limite);
    
    const contactosUrl = `${DIRECTUS_URL}/items/contactos?limit=${limite}&offset=${offset}&sort=-fecha_creacion&fields=id,nombre,email,telefono,asunto,mensaje,estado,fecha_creacion,fecha_respuesta${filtrosQuery}`;
    
    const response = await fetch(contactosUrl, {
      method: 'GET',
      headers: getHeaders(),
    });
    
    if (!response.ok) {
      console.error(`Error al consultar contactos: ${response.status} ${response.statusText}`);
      return new Response(JSON.stringify({ 
        error: 'Error al consultar mensajes de contacto' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const contactosData = await response.json();
    
    return new Response(JSON.stringify({
      success: true,
      data: contactosData.data,
      meta: {
        total: contactosData.data?.length || 0,
        pagina: parseInt(pagina),
        limite: parseInt(limite)
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error en GET /api/contact:', error);
    return new Response(JSON.stringify({ 
      error: 'Error al consultar mensajes de contacto' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST - Crear nuevo mensaje de contacto
export async function POST({ request }) {
  try {
    const contactData = await request.json();
    
    console.log('📧 Nueva solicitud de contacto:', contactData);
    
    // Validar y sanitizar datos
    const validation = validateContactData(contactData);
    
    if (!validation.isValid) {
      console.log('❌ Datos de contacto inválidos:', validation.errors);
      return new Response(JSON.stringify({
        success: false,
        error: 'Datos inválidos',
        message: validation.errors.join(', '),
        details: validation.errors
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Preparar datos para Directus
    const directusData = {
      ...validation.cleanData,
      estado: 'nuevo',
      fecha_creacion: new Date().toISOString(),
      ip_origen: request.headers.get('x-forwarded-for') || 
                request.headers.get('x-real-ip') || 
                'unknown'
    };
    
    console.log('📤 Enviando a Directus:', directusData);
    
    // Enviar a Directus
    const directusCreateUrl = `${DIRECTUS_URL}/items/contactos`;
    const response = await fetch(directusCreateUrl, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(directusData)
    });
    
    console.log(`📥 Respuesta de Directus: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Mensaje de contacto creado exitosamente:', result.data?.id);
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          id: result.data?.id,
          estado: 'nuevo'
        },
        message: `¡Gracias por contactarnos, ${validation.cleanData.nombre}! Hemos recibido tu mensaje y te responderemos pronto a ${validation.cleanData.email}.`
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
      
      const errorMessage = errorData.errors?.[0]?.message || errorData.message || 'Error al procesar el mensaje';
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Error del servidor',
        message: 'Hubo un problema al enviar tu mensaje. Por favor intenta nuevamente.',
        details: process.env.NODE_ENV === 'development' ? errorData : undefined
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
  } catch (error) {
    console.error('💥 Error en POST /api/contact:', error);
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


// PUT - Actualizar estado del mensaje (para admin)
export async function PUT({ request }) {
  try {
    const { id, estado, notas_admin } = await request.json();
    
    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de mensaje requerido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Validar estado
    const estadosValidos = ['nuevo', 'leido', 'respondido', 'archivado'];
    if (estado && !estadosValidos.includes(estado)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Estado inválido',
        message: `El estado debe ser uno de: ${estadosValidos.join(', ')}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const updateData = {};
    if (estado) {
      updateData.estado = estado;
      if (estado === 'respondido') {
        updateData.fecha_respuesta = new Date().toISOString();
      }
    }
    if (notas_admin) {
      updateData.notas_admin = notas_admin.trim();
    }
    
    const directusUpdateUrl = `${DIRECTUS_URL}/items/contactos/${id}`;
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
        message: 'Mensaje actualizado exitosamente'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      const errorData = await response.json().catch(() => ({}));
      return new Response(JSON.stringify({
        success: false,
        error: 'Error al actualizar',
        message: 'No se pudo actualizar el mensaje'
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
  } catch (error) {
    console.error('Error en PUT /api/contact:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno',
      message: 'Error al actualizar el mensaje'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// DELETE - Eliminar mensaje (opcional, para admin)
export async function DELETE({ url }) {
  try {
    const searchParams = new URL(url).searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de mensaje requerido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // En lugar de eliminar completamente, cambiar estado a 'archivado'
    const directusUpdateUrl = `${DIRECTUS_URL}/items/contactos/${id}`;
    const response = await fetch(directusUpdateUrl, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ 
        estado: 'archivado',
        fecha_archivado: new Date().toISOString()
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      return new Response(JSON.stringify({
        success: true,
        data: result,
        message: 'Mensaje archivado exitosamente'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Error al archivar',
        message: 'No se pudo archivar el mensaje'
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
  } catch (error) {
    console.error('Error en DELETE /api/contact:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno',
      message: 'Error al archivar el mensaje'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}