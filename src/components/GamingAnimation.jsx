import React from 'react';

const GamingAnimation = ({ className = "" }) => {
    return (
        <div className={`relative w-12 h-12 sm:w-16 sm:h-16 animate-float ${className}`}>
            <div className="animate-tilt w-full h-full">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-lg">
                    {/* Controller Body */}
                    <path
                        d="M20 35 C20 25 35 25 40 30 L60 30 C65 25 80 25 80 35 C80 55 70 65 60 65 L40 65 C30 65 20 55 20 35 Z"
                        fill="url(#controllerBodyGradient)"
                        stroke="#00D9FF"
                        strokeWidth="2"
                    />

                    {/* Left Grip Shadow */}
                    <path d="M20 35 C20 50 28 60 35 63 L40 65 C30 65 20 55 20 35 Z" fill="black" fillOpacity="0.2" />

                    {/* Right Grip Shadow */}
                    <path d="M80 35 C80 50 72 60 65 63 L60 65 C70 65 80 55 80 35 Z" fill="black" fillOpacity="0.2" />

                    {/* D-Pad */}
                    <g transform="translate(32, 45)">
                        <rect x="-8" y="-3" width="16" height="6" rx="1" fill="#1a1a2e" stroke="#00D9FF" strokeWidth="1" />
                        <rect x="-3" y="-8" width="6" height="16" rx="1" fill="#1a1a2e" stroke="#00D9FF" strokeWidth="1" />
                        <circle cx="0" cy="0" r="2" fill="#00D9FF" className="animate-pulse" />
                    </g>

                    {/* Action Buttons */}
                    <g transform="translate(68, 45)">
                        <circle cx="0" cy="-8" r="3" fill="#B026FF" className="animate-button-1" />
                        <circle cx="8" cy="0" r="3" fill="#00D9FF" className="animate-button-2" />
                        <circle cx="0" cy="8" r="3" fill="#FF6B9D" className="animate-button-1" />
                        <circle cx="-8" cy="0" r="3" fill="#FFD93D" className="animate-button-2" />
                    </g>

                    {/* Joysticks */}
                    <circle cx="42" cy="55" r="6" fill="#1a1a2e" stroke="#00D9FF" strokeWidth="1" />
                    <circle cx="58" cy="55" r="6" fill="#1a1a2e" stroke="#00D9FF" strokeWidth="1" />

                    {/* Joystick Tops */}
                    <circle cx="42" cy="55" r="3" fill="#3b82f6" />
                    <circle cx="58" cy="55" r="3" fill="#3b82f6" />

                    {/* Shoulder Buttons */}
                    <path d="M25 28 L35 28 L35 32 L25 32 Z" fill="#B026FF" />
                    <path d="M65 28 L75 28 L75 32 L65 32 Z" fill="#B026FF" />

                    {/* Gradients */}
                    <defs>
                        <linearGradient id="controllerBodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#1e293b" />
                            <stop offset="100%" stopColor="#0f1729" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>
        </div>
    );
};

export default GamingAnimation;
