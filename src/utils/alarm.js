let alarmAudio = null

const playAlarmSound = (audioContext, volume = 0.7) => {
  return new Promise((resolve) => {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)
    
    setTimeout(() => {
      const oscillator2 = audioContext.createOscillator()
      const gainNode2 = audioContext.createGain()
      
      oscillator2.connect(gainNode2)
      gainNode2.connect(audioContext.destination)
      
      oscillator2.frequency.value = 800
      oscillator2.type = 'sine'
      
      gainNode2.gain.setValueAtTime(volume, audioContext.currentTime)
      gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
      
      oscillator2.start(audioContext.currentTime)
      oscillator2.stop(audioContext.currentTime + 0.5)
      
      setTimeout(resolve, 600)
    }, 600)
  })
}

const speakText = (text, volume = 1.0) => {
  return new Promise((resolve) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.volume = volume
      utterance.rate = 0.9
      utterance.pitch = 1.0
      
      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()
      
      window.speechSynthesis.speak(utterance)
    } else {
      resolve()
    }
  })
}

export const playAlarm = async (messageOrStationName = null, isWarning = false) => {
  try {
    if (alarmAudio) {
      alarmAudio.pause()
      alarmAudio.currentTime = 0
    }
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    
    if (messageOrStationName) {
      // Check if it's a full message (contains "hour", "bonus", "completed", "started", "paused", or "resumed")
      const isFullMessage = messageOrStationName.includes('hour') || 
                           messageOrStationName.includes('bonus') || 
                           messageOrStationName.includes('completed') ||
                           messageOrStationName.includes('started') ||
                           messageOrStationName.includes('paused') ||
                           messageOrStationName.includes('resumed')
      
      if (isFullMessage) {
        // Full milestone, completion, start, pause, or resume message
        const message = messageOrStationName
        
        // Play alarm sound - quieter for completion/start/pause/resume announcements, louder for hour milestones
        let volume = 0.6
        if (messageOrStationName.includes('completed')) {
          volume = 0.4
        } else if (messageOrStationName.includes('started')) {
          volume = 0.5
        } else if (messageOrStationName.includes('paused') || messageOrStationName.includes('resumed')) {
          volume = 0.4 // Quiet for pause/resume
        }
        await playAlarmSound(audioContext, volume)
        
        // Speak the message
        await speakText(message, 1.0)
      } else if (isWarning) {
        // Warning message: "PS5 Station 1 will have 1 min left"
        const message = `${messageOrStationName} will have 1 min left`
        
        // Play warning alarm sound (volume 0.5)
        await playAlarmSound(audioContext, 0.5)
        
        // Speak the warning message
        await speakText(message, 1.0)
      } else {
        // Play station timeout announcement once with louder alarm
        const message = `${messageOrStationName} timeout`
        
        // Play louder alarm sound (volume 0.8)
        await playAlarmSound(audioContext, 0.8)
        
        // Speak the station name timeout message
        await speakText(message, 1.0)
      }
    } else {
      // Fallback: Original alarm behavior
      await playAlarmSound(audioContext, 0.3)
    }
  } catch (error) {
    console.error('Error playing alarm:', error)
  }
}

export const stopAlarm = () => {
  if (alarmAudio) {
    alarmAudio.pause()
    alarmAudio.currentTime = 0
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

