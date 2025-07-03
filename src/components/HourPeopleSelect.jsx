import { useState, useEffect } from 'react';

export default function HourPeopleSelect({ fecha, onSubmit }) {
  const [horarios, setHorarios] = useState({});
  const [hora, setHora] = useState('');
  const [personas, setPersonas] = useState(1);

  useEffect(() => {
    if (!fecha) return;

    fetch(`/api/availability?fecha=${fecha}&personas=${personas}`)
      .then(res => res.json())
      .then(data => setHorarios(data.horarios || {}));
  }, [fecha, personas]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (hora) {
      onSubmit?.({ fecha, hora, personas });
    }
  };

  const maxPara = (h) => horarios[h]?.espaciosDisponibles || 1;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Selector de hora */}
      <select
        value={hora}
        onChange={(e) => {
          const h = e.target.value;
          setHora(h);
          if (personas > maxPara(h)) setPersonas(maxPara(h));
        }}
        required
        className="border rounded p-2 w-full"
      >
        <option value="" disabled>Selecciona hora</option>
        {Object.entries(horarios).map(([h, info]) => (
          <option key={h} value={h} disabled={info.disabled}>
            {h} {info.disabled ? '— no disponible' : ''}
          </option>
        ))}
      </select>

      {/* Número de personas */}
      <input
        type="number"
        value={personas}
        onChange={(e) => setPersonas(Number(e.target.value))}
        min={1}
        max={hora ? maxPara(hora) : 1}
        required
        className="border rounded p-2 w-full"
      />

      <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
        Reservar
      </button>
    </form>
  );
}
