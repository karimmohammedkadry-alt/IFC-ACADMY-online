import React from 'react';
import { CalendarDatePicker } from './CalendarDatePicker';

interface DateFilterBarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  className?: string;
  label?: string;
}

/** نفس واجهة اختيار التاريخ الموحدة المستخدمة في كل صفحات النظام. */
export const DateFilterBar: React.FC<DateFilterBarProps> = ({
  selectedDate,
  onSelectDate,
  className = '',
  label = 'فلترة التاريخ / اليوم:',
}) => (
  <CalendarDatePicker
    selectedDate={selectedDate}
    onSelectDate={onSelectDate}
    label={label}
    className={className}
  />
);
