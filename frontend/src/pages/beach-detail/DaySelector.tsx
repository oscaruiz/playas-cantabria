import React from 'react';
import { useLanguage } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';
import { dayTitle, daySubtitle } from '../../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/dates';

/** Editorial tabs with underline: Today / Tomorrow / Day after tomorrow. */
const DaySelector: React.FC<{
  dates: string[];
  selectedDay: number;
  onSelect: (i: number) => void;
}> = ({ dates, selectedDay, onSelect }) => {
  const { t, language } = useLanguage();
  return (
    <div className="day-selector" role="tablist">
      {dates.map((date, i) => (
        <button
          key={date}
          className={`day-tab${i === selectedDay ? ' active' : ''}`}
          onClick={() => onSelect(i)}
          role="tab"
          aria-selected={i === selectedDay}
        >
          <span className="day-tab-title">{dayTitle(date, t, language)}</span>
          <span className="day-tab-date">{daySubtitle(date, language)}</span>
        </button>
      ))}
    </div>
  );
};

export default DaySelector;
