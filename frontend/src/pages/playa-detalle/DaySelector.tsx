import React from 'react';
import { useIdioma } from '../../i18n/IdiomaContext';
import { dayTitle, daySubtitle } from './dates';

/** Editorial tabs with underline: Today / Tomorrow / Day after tomorrow. */
const DaySelector: React.FC<{
  fechas: string[];
  selectedDay: number;
  onSelect: (i: number) => void;
}> = ({ fechas, selectedDay, onSelect }) => {
  const { t, idioma } = useIdioma();
  return (
    <div className="day-selector" role="tablist">
      {fechas.map((fecha, i) => (
        <button
          key={fecha}
          className={`day-tab${i === selectedDay ? ' active' : ''}`}
          onClick={() => onSelect(i)}
          role="tab"
          aria-selected={i === selectedDay}
        >
          <span className="day-tab-title">{dayTitle(fecha, t, idioma)}</span>
          <span className="day-tab-date">{daySubtitle(fecha, idioma)}</span>
        </button>
      ))}
    </div>
  );
};

export default DaySelector;
