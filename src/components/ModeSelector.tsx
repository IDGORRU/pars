import React from 'react';
import { Zap, Mail, Code, Database } from 'lucide-react';

export type ParseMode = 'email' | 'html' | 'data' | 'links';

interface ModeSelectorProps {
  selectedMode: ParseMode;
  onModeChange: (mode: ParseMode) => void;
}

const modes = [
  { id: 'email' as ParseMode, label: 'Извлечение Email', icon: Mail, color: 'blue' },
  { id: 'html' as ParseMode, label: 'Парсинг HTML', icon: Code, color: 'purple' },
  { id: 'data' as ParseMode, label: 'Извлечение данных', icon: Database, color: 'green' },
  { id: 'links' as ParseMode, label: 'Извлечение ссылок', icon: Zap, color: 'orange' }
];

export const ModeSelector: React.FC<ModeSelectorProps> = ({ selectedMode, onModeChange }) => {
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-800">Режим парсинга</h3>
      <div className="grid grid-cols-2 gap-3">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isSelected = selectedMode === mode.id;
          
          return (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                isSelected
                  ? `border-${mode.color}-500 bg-${mode.color}-50 text-${mode.color}-700`
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              <Icon size={24} className="mx-auto mb-2" />
              <p className="text-sm font-medium">{mode.label}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};