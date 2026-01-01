const Logo = ({ className = "", showText = true, textSize = "text-xl sm:text-2xl", iconSize = "w-12 h-12 sm:w-16 sm:h-16", shopName = "GAMERS SPOT" }) => {
  const isVertical = className.includes("flex-col")

  return (
    <div className={`flex ${isVertical ? 'flex-col items-center gap-2' : 'items-center gap-3'} ${className}`}>
      {/* Text-only Logo */}
      <div className={`flex flex-col ${isVertical ? 'items-center' : 'items-start'} ${showText ? '' : 'hidden'} gap-2`}>
        {/* Line 1: Shop Name */}
        <span
          className={`font-black tracking-tight ${textSize} leading-tight uppercase`}
          style={{
            background: 'linear-gradient(135deg, #00D9FF 0%, #B026FF 50%, #FF6B9D 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 2px 10px rgba(0, 217, 255, 0.3)',
            filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
          }}
        >
          {shopName}
        </span>
        {/* Line 2: A Professional Gaming Zone */}
        <span
          className="text-[8px] sm:text-[10px] font-bold tracking-widest uppercase leading-tight whitespace-nowrap"
          style={{
            color: '#6b7280',
            letterSpacing: '0.2em',
            fontFamily: "'Orbitron', 'Poppins', sans-serif",
            fontWeight: 700,
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
          }}
        >
          A Professional Gaming Zone
        </span>
      </div>
    </div>
  )
}

export default Logo
