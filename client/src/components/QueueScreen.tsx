interface QueueScreenProps {
  queueSize: number;
  classCode: string;
}

export function QueueScreen({ queueSize, classCode }: QueueScreenProps) {
  return (
    <div className="queue-screen">
      <div className="queue-content">
        <div className="spinner"></div>
        <h1>Finding Your Group...</h1>
        <p className="queue-info">
          {queueSize === 0 ? 'Looking for players' : `${queueSize} player${queueSize === 1 ? '' : 's'} waiting`}
        </p>
        <p className="class-code">Class: {classCode}</p>
        <p className="instruction">You'll be matched with 3 other students shortly</p>
      </div>
    </div>
  );
}
