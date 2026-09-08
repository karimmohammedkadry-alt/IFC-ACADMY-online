import React, { useState } from 'react';

interface IFCLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'custom';
  withGlow?: boolean;
  customLogoUrl?: string;
}

export const IFCLogo: React.FC<IFCLogoProps> = ({
  className = '',
  size = 'md',
  withGlow = false,
  customLogoUrl,
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    xs: 'w-7 h-7 min-w-[28px]',
    sm: 'w-9 h-9 min-w-[36px]',
    md: 'w-12 h-12 min-w-[48px]',
    lg: 'w-16 h-16 min-w-[64px]',
    xl: 'w-24 h-24 min-w-[96px]',
    '2xl': 'w-36 h-36 sm:w-48 sm:h-48 md:w-64 md:h-64',
    custom: '',
  };

  const selectedSize = sizeClasses[size] || sizeClasses.md;

  const logoSrc = customLogoUrl || '/ifc_logo.jpg';

  // Render SVG fallback if image fails, or render image directly
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full select-none ${selectedSize} ${className}`}
    >
      {withGlow && (
        <div className="absolute inset-0 rounded-full bg-yellow-500/25 blur-xl pointer-events-none scale-110" />
      )}

      {!imgError ? (
        <img
          src={logoSrc}
          alt="IFC International Fight Club"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover rounded-full shadow-lg border-2 border-yellow-400/80 transition-transform duration-300 hover:scale-105"
        />
      ) : (
        /* High-fidelity Vector SVG Fallback with Kickboxer silhouette and curved text */
        <svg
          viewBox="0 0 400 400"
          className="w-full h-full rounded-full shadow-lg border-2 border-yellow-400"
        >
          {/* Yellow Background */}
          <circle cx="200" cy="200" r="196" fill="#FACC15" />

          {/* Concentric Black Rings */}
          <circle
            cx="200"
            cy="200"
            r="190"
            fill="none"
            stroke="#000000"
            strokeWidth="10"
          />
          <circle
            cx="200"
            cy="200"
            r="174"
            fill="none"
            stroke="#000000"
            strokeWidth="5"
          />

          {/* Kickboxer Fighter Silhouette */}
          <g fill="#000000">
            {/* Head & Guard */}
            <circle cx="165" cy="115" r="22" />
            {/* Torso */}
            <path d="M150,140 Q180,150 195,190 L170,225 Q150,180 140,155 Z" />
            {/* Left Arm / Guard Glove */}
            <path d="M145,145 L120,135 Q115,120 128,115 L145,130 Z" />
            <circle cx="118" cy="125" r="12" />
            {/* Supporting Leg */}
            <path d="M170,225 L160,290 L150,330 L172,330 L180,285 L188,225 Z" />
            {/* Extended High Kick Leg */}
            <path d="M190,195 Q230,170 280,140 L310,115 L320,130 L290,165 Q240,195 200,215 Z" />
            {/* Foot in high kick */}
            <path d="M305,110 L330,105 L335,125 L310,135 Z" />
            {/* Right Glove Punching/Counterbalancing */}
            <path d="M180,150 L220,160 Q235,165 240,155 L225,145 Z" />
            <circle cx="238" cy="158" r="11" />
          </g>

          {/* Stylized IFC Letters */}
          <g fill="#000000" fontWeight="900" fontFamily="sans-serif">
            <path d="M110,230 H145 V245 H132 V295 H145 V310 H110 V295 H122 V245 H110 Z" />
            <path d="M165,230 H215 V245 H180 V265 H208 V280 H180 V310 H165 Z" />
            <path d="M235,230 H280 V245 H250 Q245,270 250,295 H280 V310 H235 Q225,270 235,230 Z" />
          </g>

          {/* Curved Text: international fight club */}
          <path
            id="textPathCurve"
            d="M 60,260 A 155,155 0 0,0 340,260"
            fill="none"
          />
          <text
            fill="#000000"
            fontSize="21"
            fontWeight="bold"
            fontFamily="Arial, sans-serif"
            letterSpacing="2"
          >
            <textPath href="#textPathCurve" startOffset="50%" textAnchor="middle">
              international fight club
            </textPath>
          </text>
        </svg>
      )}
    </div>
  );
};
