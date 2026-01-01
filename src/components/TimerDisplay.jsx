import { formatTime } from '../utils/timer'

const TimerDisplay = ({ elapsedTime }) => {
  return (
    <div className="text-center py-4">
      <div className="text-5xl font-mono font-bold text-gray-800">
        {formatTime(elapsedTime || 0)}
      </div>
      <div className="mt-2 text-sm text-gray-500">
        Elapsed Time
      </div>
    </div>
  )
}

export default TimerDisplay

