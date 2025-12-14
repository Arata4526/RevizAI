import React from 'react';

interface VisualizerProps {
  volume: number;
  isActive: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({ volume, isActive }) => {
  if (!isActive) {
    return (
      <div className="flex items-center justify-center h-24 gap-2 opacity-50">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
        <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
        <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
      </div>
    );
  }

  // Generate 5 bars with varying heights based on volume
  // Using a gradient for a more premium look
  const bars = Array.from({ length: 5 }).map((_, i) => {
    // Non-linear scaling for better visual feedback on low volumes
    const height = Math.min(100, Math.max(12, volume * 400 * (1 + Math.random() * 0.5)));
    
    return (
      <div
        key={i}
        className="w-4 rounded-full bg-gradient-to-t from-indigo-600 to-violet-400 shadow-lg shadow-indigo-500/30 transition-all duration-100 ease-out"
        style={{ height: `${height}%` }}
      />
    );
  });

  return (
    <div className="flex items-center justify-center h-32 gap-3">
      {bars}
    </div>
  );
};