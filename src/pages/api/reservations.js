---
// src/pages/reservations.astro
import DefaultLayout from '../layouts/DefaultLayout.astro';
import { getOpeningHours } from '../lib/directus';

const openingHours = await getOpeningHours();
---

<DefaultLayout title="Reservaciones - Restaurante">
  <!-- Espaciador para navbar fijo -->
  <div class="h-20"></div>
  
  <!-- Cabecera de la página -->
  <div class="bg-gray-50 py-16">
    <div class="container mx-auto px-4 text-center">
      <h1 class="text-4xl md:text-5xl font-bold mb-4">Reservaciones</h1>
      <p class="text-gray-600 max-w-2xl mx-auto">Reserva tu mesa y disfruta de una experiencia gastronómica inolvidable.</p>
    </div>
  </div>
  
  <!-- Formulario de reservación -->
  <section class="py-20">
    <div class="container mx-auto px-4 max-w-4xl">
      <div class="bg-white rounded-lg shadow-lg overflow-hidden">
        <div class="p-8">
          <h2 class="text-2xl font-bold mb-6 text-center">Haz tu reserva</h2>
          
          <!-- Indicador de disponibilidad -->
          <div id="availabilityIndicator" class="hidden mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
            <div class="flex items-center justify-center space-x-2">
              <svg class="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span class="text-blue-600 font-medium">Verificando disponibilidad...</span>
            </div>
          </div>
          
          <form id="reservationForm" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label for="nombre" class="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                <input 
                  type="text" 
                  id="nombre" 
                  name="nombre" 
                  required
                  class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primaryColor)] focus:border-transparent"
                  placeholder="Tu nombre"
                >
              </div>
              
              <div>
                <label for="telefono" class="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input 
                  type="tel" 
                  id="telefono" 
                  name="telefono"
                  required
                  class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primaryColor)] focus:border-transparent"
                  placeholder="Tu número de teléfono"
                >
              </div>
            </div>
            
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input 
                type="email" 
                id="email" 
                name="email" 
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primaryColor)] focus:border-transparent"
                placeholder="Tu correo electrónico"
              >
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label for="fecha" class="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input 
                  type="date" 
                  id="fecha" 
                  name="fecha" 
                  required
                  min={new Date().toISOString().split('T')[0]}
                  class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primaryColor)] focus:border-transparent"
                >
              </div>
              
              <div>
                <label for="hora" class="block text-sm font-medium text-gray-700 mb-1">
                  Hora
                  <span id="horaInfo" class="text-xs text-gray-500 ml-1"></span>
                </label>
                <select 
                  id="hora" 
                  name="hora" 
                  required
                  disabled
                  class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primaryColor)] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Primero selecciona una fecha</option>
                </select>
              </div>
              
              <div>
                <label for="personas" class="block text-sm font-medium text-gray-700 mb-1">
                  Número de personas
                  <span id="personasInfo" class="text-xs text-gray-500 ml-1"></span>
                </label>
                <select 
                  id="personas" 
                  name="personas" 
                  required
                  disabled
                  class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primaryColor)] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Primero selecciona fecha y hora</option>
                </select>
              </div>
            </div>
            
            <!-- Resumen de disponibilidad -->
            <div id="availabilitySummary" class="hidden p-4 rounded-lg">
              <h4 class="font-medium mb-2">Disponibilidad del día</h4>
              <div id="hourlyAvailability" class="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm"></div>
            </div>
            
            <div>
              <label for="comentarios" class="block text-sm font-medium text-gray-700 mb-1">Comentarios adicionales (alergias, ocasión especial, etc.)</label>
              <textarea 
                id="comentarios" 
                name="comentarios" 
                rows="3"
                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primaryColor)] focus:border-transparent"
                placeholder="Indícanos cualquier necesidad especial..."
              ></textarea>
            </div>
            
            <button 
              type="submit" 
              id="submitBtn"
              disabled
              class="w-full bg-[var(--primaryColor)] text-white py-3 px-6 rounded-md hover:bg-[var(--secondaryColor)] transition-colors duration-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirmar reserva
            </button>
          </form>
        </div>
      </div>
      
      <!-- Información adicional -->
      <div class="mt-12 text-center">
        <h3 class="text-xl font-bold mb-4">Información adicional</h3>
        <ul class="space-y-2 text-gray-600 max-w-2xl mx-auto">
          <li>• Tu reserva será confirmada por teléfono o email dentro de las próximas 24 horas.</li>
          <li>• La disponibilidad se actualiza en tiempo real.</li>
          <li>• Las reservas están sujetas a disponibilidad.</li>
          <li>• Para grupos grandes (más de 8 personas), por favor contacta directamente al restaurante.</li>
        </ul>
        
        <!-- Horarios -->
        <div class="mt-8">
          <h3 class="text-xl font-bold mb-4">Nuestros horarios</h3>
          <div class="flex flex-col md:flex-row justify-center gap-4 md:gap-8">
            {openingHours.length > 0 ? (
              openingHours.map((day) => (
                <div class="flex flex-col items-center">
                  <span class="font-medium">{day.day_of_week}</span>
                  <span class="text-gray-600">{day.is_closed ? 'Cerrado' : `${day.open_time} - ${day.close_time}`}</span>
                </div>
              ))
            ) : (
              <>
                <div class="flex flex-col items-center">
                  <span class="font-medium">Lun - Vie</span>
                  <span class="text-gray-600">11:00 - 22:00</span>
                </div>
                <div class="flex flex-col items-center">
                  <span class="font-medium">Sábados</span>
                  <span class="text-gray-600">10:00 - 23:00</span>
                </div>
                <div class="flex flex-col items-center">
                  <span class="font-medium">Domingos</span>
                  <span class="text-gray-600">10:00 - 21:00</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  </section>
</DefaultLayout>

<script>
  // Sistema de disponibilidad en tiempo real
  let availabilityData = null;
  let selectedHour = null;
  
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('reservationForm');
    const submitBtn = document.getElementById('submitBtn');
    const fechaInput = document.getElementById('fecha');
    const horaSelect = document.getElementById('hora');
    const personasSelect = document.getElementById('personas');
    const availabilityIndicator = document.getElementById('availabilityIndicator');
    const availabilitySummary = document.getElementById('availabilitySummary');
    const hourlyAvailability = document.getElementById('hourlyAvailability');
    
    // Función para verificar disponibilidad
    async function checkAvailability(fecha) {
      if (!fecha) return;
      
      // Mostrar indicador de carga
      availabilityIndicator.classList.remove('hidden');
      availabilitySummary.classList.add('hidden');
      horaSelect.disabled = true;
      personasSelect.disabled = true;
      submitBtn.disabled = true;
      
      try {
        const response = await fetch(`/api/availability?fecha=${fecha}&personas=1`);
        if (!response.ok) throw new Error('Error al verificar disponibilidad');
        
        availabilityData = await response.json();
        console.log('Disponibilidad:', availabilityData);
        
        // Actualizar selector de hora
        updateHourSelector();
        
        // Mostrar resumen de disponibilidad
        showAvailabilitySummary();
        
      } catch (error) {
        console.error('Error:', error);
        alert('Error al verificar la disponibilidad. Por favor, intenta de nuevo.');
      } finally {
        availabilityIndicator.classList.add('hidden');
      }
    }
    
    // Actualizar selector de hora con disponibilidad
    function updateHourSelector() {
      horaSelect.innerHTML = '<option value="">Selecciona una hora</option>';
      horaSelect.disabled = false;
      
      let hasAvailableHours = false;
      
      Object.entries(availabilityData.horarios).forEach(([hora, info]) => {
        const option = document.createElement('option');
        option.value = hora;
        
        if (info.espaciosDisponibles === 0) {
          option.disabled = true;
          option.textContent = `${hora} - COMPLETO`;
          option.classList.add('text-red-500');
        } else if (info.espaciosDisponibles <= 5) {
          option.textContent = `${hora} - Solo ${info.espaciosDisponibles} lugares`;
          option.classList.add('text-orange-500');
          hasAvailableHours = true;
        } else {
          option.textContent = `${hora} - ${info.espaciosDisponibles} lugares disponibles`;
          option.classList.add('text-green-600');
          hasAvailableHours = true;
        }
        
        horaSelect.appendChild(option);
      });
      
      if (!hasAvailableHours) {
        horaSelect.innerHTML = '<option value="">No hay horarios disponibles para esta fecha</option>';
        horaSelect.disabled = true;
      }
      
      // Actualizar info
      document.getElementById('horaInfo').textContent = hasAvailableHours ? '(selecciona para ver disponibilidad)' : '';
    }
    
    // Mostrar resumen de disponibilidad
    function showAvailabilitySummary() {
      hourlyAvailability.innerHTML = '';
      availabilitySummary.classList.remove('hidden');
      
      Object.entries(availabilityData.horarios).forEach(([hora, info]) => {
        const div = document.createElement('div');
        div.className = 'p-2 rounded text-center ';
        
        if (info.espaciosDisponibles === 0) {
          div.className += 'bg-red-100 text-red-700';
          div.innerHTML = `<div class="font-medium">${hora}</div><div class="text-xs">Completo</div>`;
        } else if (info.espaciosDisponibles <= 5) {
          div.className += 'bg-orange-100 text-orange-700';
          div.innerHTML = `<div class="font-medium">${hora}</div><div class="text-xs">${info.espaciosDisponibles} lugares</div>`;
        } else {
          div.className += 'bg-green-100 text-green-700';
          div.innerHTML = `<div class="font-medium">${hora}</div><div class="text-xs">${info.espaciosDisponibles} lugares</div>`;
        }
        
        hourlyAvailability.appendChild(div);
      });
      
      // Actualizar clase del contenedor según disponibilidad general
      if (availabilityData.resumen.horariosDisponibles === 0) {
                availabilitySummary.className = 'p-4 rounded-lg bg-red-50 border border-red-200';
      } else if (availabilityData.resumen.horariosDisponibles <= 3) {
        availabilitySummary.className = 'p-4 rounded-lg bg-orange-50 border border-orange-200';
      } else {
        availabilitySummary.className = 'p-4 rounded-lg bg-green-50 border border-green-200';
      }
    }
    
    // Actualizar selector de personas según hora seleccionada
    function updatePersonasSelector(hora) {
      if (!hora || !availabilityData) {
        personasSelect.innerHTML = '<option value="">Primero selecciona una hora</option>';
        personasSelect.disabled = true;
        submitBtn.disabled = true;
        return;
      }
      
      const horaInfo = availabilityData.horarios[hora];
      if (!horaInfo || horaInfo.espaciosDisponibles === 0) {
        personasSelect.innerHTML = '<option value="">No hay disponibilidad para esta hora</option>';
        personasSelect.disabled = true;
        submitBtn.disabled = true;
        return;
      }
      
      personasSelect.innerHTML = '<option value="">Selecciona número de personas</option>';
      personasSelect.disabled = false;
      
      // Generar opciones según disponibilidad
      const maxPersonas = Math.min(8, horaInfo.espaciosDisponibles);
      for (let i = 1; i <= maxPersonas; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i === 1 ? '1 persona' : `${i} personas`;
        personasSelect.appendChild(option);
      }
      
      // Actualizar info
      document.getElementById('personasInfo').textContent = `(máx. ${maxPersonas} disponibles)`;
      
      // Guardar hora seleccionada
      selectedHour = hora;
    }
    
    // Event listener para cambio de fecha
    fechaInput.addEventListener('change', (e) => {
      const fecha = e.target.value;
      if (fecha) {
        checkAvailability(fecha);
      } else {
        // Reset si no hay fecha
        horaSelect.innerHTML = '<option value="">Primero selecciona una fecha</option>';
        horaSelect.disabled = true;
        personasSelect.innerHTML = '<option value="">Primero selecciona fecha y hora</option>';
        personasSelect.disabled = true;
        submitBtn.disabled = true;
        availabilitySummary.classList.add('hidden');
      }
    });
    
    // Event listener para cambio de hora
    horaSelect.addEventListener('change', (e) => {
      updatePersonasSelector(e.target.value);
    });
    
    // Event listener para cambio de personas
    personasSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        submitBtn.disabled = false;
      } else {
        submitBtn.disabled = true;
      }
    });
    
    // Manejo del envío del formulario
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Deshabilitar el botón durante el envío
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
        
        // Obtener datos del formulario
        const formData = new FormData(form);
        const reservationData = {
          nombre: formData.get('nombre'),
          telefono: formData.get('telefono'),
          email: formData.get('email'),
          fecha: formData.get('fecha'),
          hora: formData.get('hora'),
          personas: formData.get('personas'),
          comentarios: formData.get('comentarios') || null
        };
        
        console.log('Enviando datos de reserva:', reservationData);
        
        try {
          const response = await fetch('/api/reservations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(reservationData)
          });
          
          console.log('Respuesta del servidor:', response);
          
          if (response.ok) {
            const result = await response.json();
            console.log('Reserva creada:', result);
            
            // Mostrar mensaje de éxito
            alert('¡Reserva recibida con éxito! Te contactaremos para confirmar tu reserva.');
            
            // Resetear formulario
            form.reset();
            horaSelect.innerHTML = '<option value="">Primero selecciona una fecha</option>';
            horaSelect.disabled = true;
            personasSelect.innerHTML = '<option value="">Primero selecciona fecha y hora</option>';
            personasSelect.disabled = true;
            submitBtn.disabled = true;
            availabilitySummary.classList.add('hidden');
            availabilityData = null;
            selectedHour = null;
            
          } else {
            const errorData = await response.json();
            console.error('Error al enviar reserva:', errorData);
            
            if (response.status === 409) {
              // Capacidad insuficiente - actualizar disponibilidad
              alert(`Lo sentimos, la capacidad ha cambiado. Solo quedan ${errorData.disponibles} lugares disponibles para este horario.`);
              // Recargar disponibilidad
              checkAvailability(formData.get('fecha'));
            } else {
              alert('Error al procesar la reserva. Por favor, intenta de nuevo.');
            }
          }
        } catch (error) {
          console.error('Error de red:', error);
          alert('Error de conexión. Por favor, verifica tu conexión a internet e inténtalo de nuevo.');
        } finally {
          // Rehabilitar el botón
          submitBtn.disabled = false;
          submitBtn.textContent = 'Confirmar reserva';
        }
      });
    }
  });
</script>

<style>
  /* Estilos para las opciones del select */
  option:disabled {
    color: #9ca3af;
  }
  
  option.text-red-500 {
    color: #ef4444;
  }
  
  option.text-orange-500 {
    color: #f97316;
  }
  
  option.text-green-600 {
    color: #16a34a;
  }
  
  /* Animación para el indicador de carga */
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  
  #availabilityIndicator {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
</style> 