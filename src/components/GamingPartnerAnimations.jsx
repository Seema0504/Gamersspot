import React from 'react';

const GamingPartnerAnimations = () => {
  return (
    <div className="relative flex items-center justify-center">
      {/* Floating Game Icons */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* PS5 Controller Icon - Floating */}
        <div className="absolute top-0 left-0 w-8 h-8 animate-float" style={{ animationDelay: '0s', animationDuration: '3s' }}>
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-blue-500 opacity-60">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor"/>
            <circle cx="9" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="15" cy="12" r="1.5" fill="currentColor"/>
            <path d="M12 8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" fill="currentColor"/>
          </svg>
        </div>

        {/* Gamepad Icon - Rotating */}
        <div className="absolute top-0 right-0 w-6 h-6 animate-tilt" style={{ animationDelay: '0.5s', animationDuration: '2s' }}>
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-purple-500 opacity-70">
            <path d="M15.75 8l-1.5-1.5L12 9l-2.25-2.5-1.5 1.5L10.5 12l-2.25 2.5 1.5 1.5L12 15l2.25 2.5 1.5-1.5L13.5 12l2.25-4z" fill="currentColor"/>
            <circle cx="7" cy="12" r="1" fill="currentColor"/>
            <circle cx="17" cy="12" r="1" fill="currentColor"/>
          </svg>
        </div>

        {/* Trophy Icon - Pulsing */}
        <div className="absolute bottom-0 left-0 w-7 h-7 animate-pulse-glow" style={{ animationDelay: '1s' }}>
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-yellow-500 opacity-80">
            <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" fill="currentColor"/>
          </svg>
        </div>

        {/* Star Icon - Twinkling */}
        <div className="absolute bottom-0 right-0 w-6 h-6 animate-float" style={{ animationDelay: '1.5s', animationDuration: '2.5s' }}>
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-pink-500 opacity-70">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/>
          </svg>
        </div>

        {/* Floating Particles */}
        <div className="absolute top-1/2 left-1/4 w-2 h-2 bg-blue-400 rounded-full animate-particle-1 opacity-60"></div>
        <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-purple-400 rounded-full animate-particle-2 opacity-60"></div>
        <div className="absolute bottom-1/3 left-1/3 w-2 h-2 bg-pink-400 rounded-full animate-particle-3 opacity-60"></div>
      </div>

      {/* Pulsing Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-full blur-xl animate-pulse-glow opacity-50"></div>
    </div>
  );
};

export default GamingPartnerAnimations;

