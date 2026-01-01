import React from 'react';

const StickmanGamer = ({ className = "" }) => {
    return (
        <div className={`relative w-16 h-16 sm:w-20 sm:h-20 ${className}`}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-lg">
                {/* Floor Shadow */}
                <ellipse cx="50" cy="85" rx="30" ry="5" fill="black" fillOpacity="0.1" />

                {/* Beanbag Chair */}
                <path
                    d="M25 80 C20 80 15 70 20 60 C25 50 40 45 50 50 C60 45 75 50 80 60 C85 70 80 80 75 80 Z"
                    fill="#B026FF"
                    opacity="0.8"
                />

                {/* Stickman Body Group - Sways slightly */}
                <g className="animate-body origin-bottom">
                    {/* Legs */}
                    <path d="M50 65 L35 75" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
                    <path d="M50 65 L65 75" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />

                    {/* Torso */}
                    <path d="M50 65 L50 45" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />

                    {/* Arms holding controller */}
                    <path d="M50 50 L35 55" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
                    <path d="M50 50 L65 55" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />

                    {/* Head - Bobs */}
                    <circle cx="50" cy="38" r="7" fill="#1f2937" className="animate-head origin-bottom" />

                    {/* Headphones */}
                    <path d="M42 38 C42 32 58 32 58 38" stroke="#00D9FF" strokeWidth="2" fill="none" className="animate-head origin-bottom" />
                    <rect x="40" y="35" width="3" height="6" rx="1" fill="#00D9FF" className="animate-head origin-bottom" />
                    <rect x="57" y="35" width="3" height="6" rx="1" fill="#00D9FF" className="animate-head origin-bottom" />

                    {/* Controller */}
                    <g transform="translate(35, 52)">
                        <rect x="0" y="0" width="30" height="12" rx="4" fill="#1a1a2e" stroke="#00D9FF" strokeWidth="1" />

                        {/* Thumbs Mashing Buttons */}
                        <circle cx="8" cy="6" r="3" fill="#B026FF" className="animate-thumb" />
                        <circle cx="22" cy="6" r="3" fill="#FF6B9D" className="animate-thumb" style={{ animationDelay: '0.1s' }} />
                    </g>
                </g>

                {/* Floating Game Particles */}
                <g transform="translate(50, 40)">
                    {/* Triangle */}
                    <path
                        d="M-20 0 L-15 -10 L-10 0 Z"
                        stroke="#00D9FF"
                        strokeWidth="1.5"
                        fill="none"
                        className="animate-particle-1"
                    />

                    {/* Circle */}
                    <circle
                        cx="20"
                        cy="-5"
                        r="4"
                        stroke="#FF6B9D"
                        strokeWidth="1.5"
                        fill="none"
                        className="animate-particle-2"
                    />

                    {/* Cross */}
                    <g className="animate-particle-3" transform="translate(0, -10)">
                        <path d="M-3 -3 L3 3 M-3 3 L3 -3" stroke="#B026FF" strokeWidth="1.5" />
                    </g>
                </g>
            </svg>
        </div>
    );
};

export default StickmanGamer;
