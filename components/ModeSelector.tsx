import React from 'react';
import { MODES } from '../constants';
import * as Icons from 'lucide-react';

interface ModeSelectorProps {
  onSelectMode: (prompt: string) => void;
  disabled: boolean;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({ onSelectMode, disabled }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {MODES.map((mode) => {
        const IconComponent = (Icons as any)[mode.icon] || Icons.HelpCircle;
        
        return (
          <button
            key={mode.id}
            onClick={() => onSelectMode(mode.prompt)}
            disabled={disabled}
            className={`
              group flex flex-col items-center p-5 rounded-2xl border transition-all duration-200
              ${disabled 
                ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed opacity-70' 
                : 'border-slate-100 bg-white shadow-sm hover:border-indigo-200 hover:shadow-indigo-100 hover:shadow-lg hover:-translate-y-1'
              }
            `}
          >
            <div className={`
              p-3 rounded-xl mb-3 transition-colors duration-200
              ${disabled ? 'bg-slate-100 text-slate-300' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'}
            `}>
              <IconComponent size={24} strokeWidth={2} />
            </div>
            <h3 className={`font-bold text-sm mb-1 ${disabled ? 'text-slate-400' : 'text-slate-800 group-hover:text-indigo-700'}`}>
              {mode.label}
            </h3>
            <p className="text-xs text-center text-slate-500 leading-snug px-1">
              {mode.description}
            </p>
          </button>
        );
      })}
    </div>
  );
};