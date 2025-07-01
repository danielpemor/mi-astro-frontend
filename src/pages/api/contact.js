export const prerender = false;

/*─────────────────────────────────────────────
  Configuración de Directus
─────────────────────────────────────────────*/
const DIRECTUS_URL =
  process.env.DIRECTUS_URL ||               // Netlify Functions en producción
  process.env.PUBLIC_DIRECTUS_URL ||        // Local si solo tienes la pública
  'http://localhost:8055';                  // Fallback en dev puro

const getHeaders = () => ({ 'Content-Type': 'application/json' });

/*─────────────────────────────────────────────
  Helpers básicos
─────────────────────────────────────────────*/
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateContactData(data) {
  const { nombre, email, telefono, asunto, mensaje } = data;
  const errors = [];

  if (!nombre || nombre.trim().length < 2) errors.push('El nombre debe tener al menos 2 caracteres');
  if (!email || !isValidEmail(email)) errors.push('Email inválido');
  if (telefono && telefono.replace(/[\s\-\(\)]/g, '').length < 10) errors.push('Teléfono inválido');
  if (!asunto || asunto.trim().length < 3) errors.push('Asunto demasiado corto');
  if (!mensaje || mensaje.trim().length < 10) errors.push('Mensaje demasiado corto');

  return {
    isValid: errors.length === 0,
    errors,
    cleanData: {
      nombre:  nombre?.trim(),
      email:   email?.trim().toLowerCase(),
      telefono:telefono?.trim() || null,
      asunto:  asunto?.trim(),
      mensaje: mensaje?.trim()
    }
  };
}

/*─────────────────────────────────────────────
  GET  – Listar mensajes (admin)
─────────────────────────────────────────────*/
export async function GET({ url }) {
  const q = new URL(url).searchParams;
  const limite = q.get('limite') || '10';
  const offset = ((q.get('pagina') || 1) - 1) * limite;
  const estado = q.get('estado');

  const filterEstado = estado ? `&filter[estado][_eq]=${estado}` : '';
  const contactosUrl = `${DIRECTUS_URL}/items/contactos?limit=${limite}&offset=${offset}&sort=-fecha_creacion${filterEstado}`;

  try {
    const r = await fetch(contactosUrl, { headers: getHeaders() });
    if (!r.ok) throw new Error(`Directus ${r.status}`);
    const data = await r.json();
    return new Response(JSON.stringify({ success: true, data: data.data }), { status: 200 });
  } catch (e) {
    console.error('GET /contact error:', e);
    return new Response(JSON.stringify({ error: 'Error al consultar mensajes' }), { status: 500 });
  }
}

/*─────────────────────────────────────────────
  POST – Nuevo mensaje de contacto
─────────────────────────────────────────────*/
export async function POST({ request }) {
  try {
    const input = await request.json();
    const v = validateContactData(input);
    if (!v.isValid) {
      return new Response(JSON.stringify({ success: false, error: v.errors.join(', ') }), { status: 400 });
    }

    const directusData = {
      ...v.cleanData,
      estado: 'nuevo',
      fecha_creacion: new Date().toISOString(),
      ip_origen: request.headers.get('x-forwarded-for') || 'unknown'
    };

    const resp = await fetch(`${DIRECTUS_URL}/items/contactos`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(directusData)
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.errors?.[0]?.message || err.message || 'Directus error');
    }

    const result = await resp.json();
    return new Response(JSON.stringify({ success: true, id: result.data.id }), { status: 200 });

  } catch (err) {
    console.error('POST /contact error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Error interno' }), { status: 500 });
  }
}

/*─────────────────────────────────────────────
  PUT – Actualizar estado (admin)
─────────────────────────────────────────────*/
export async function PUT({ request }) {
  try {
    const { id, ...updates } = await request.json();
    if (!id) return new Response(JSON.stringify({ error: 'ID requerido' }), { status: 400 });

    const resp = await fetch(`${DIRECTUS_URL}/items/contactos/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updates)
    });

    if (!resp.ok) throw new Error(`Directus ${resp.status}`);
    const data = await resp.json();
    return new Response(JSON.stringify({ success: true, data }), { status: 200 });

  } catch (e) {
    console.error('PUT /contact error:', e);
    return new Response(JSON.stringify({ error: 'Error al actualizar' }), { status: 500 });
  }
}

/*─────────────────────────────────────────────
  DELETE – Archivar mensaje (admin)
─────────────────────────────────────────────*/
export async function DELETE({ url }) {
  try {
    const id = new URL(url).searchParams.get('id');
    if (!id) return new Response(JSON.stringify({ error: 'ID requerido' }), { status: 400 });

    const resp = await fetch(`${DIRECTUS_URL}/items/contactos/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ estado: 'archivado', fecha_archivado: new Date().toISOString() })
    });

    if (!resp.ok) throw new Error(`Directus ${resp.status}`);
    const data = await resp.json();
    return new Response(JSON.stringify({ success: true, data }), { status: 200 });

  } catch (e) {
    console.error('DELETE /contact error:', e);
    return new Response(JSON.stringify({ error: 'Error al archivar' }), { status: 500 });
  }
}
