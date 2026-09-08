import React from 'react';

interface CircularProgressProps {
  value: number; // 0 - 100
  size?: number; // size in px, default 36
  strokeWidth?: number; // default 3.5
  color?: string; // hex or tailwind class
  showText?: boolean;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  size = 36,
  strokeWidth = 3.5,
  color = '#F5A524',
  showText = false,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(100, Math.max(0, value));
  const offset = circumference - (clampedValue / 100) * circumference;

  // Pick color according to rate if not forced
  let strokeColor = color;
  if (color === 'auto') {
    if (clampedValue >= 75) strokeColor = '#22C55E';
    else if (clampedValue >= 50) strokeColor = '#F5A524';
    else strokeColor = '#EF4444';
  }

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {showText && (
        <span className="absolute text-[11px] font-bold text-slate-200">
          {clampedValue}%
        </span>
      )}
    </div>
  );
};
