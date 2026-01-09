interface QueueScreenProps {
  queueSize: number;
  classCode: string;
  groupSize: number;
}

export function QueueScreen({ queueSize, classCode, groupSize }: QueueScreenProps) {
  const othersNeeded = groupSize - 1;

  return (
    <div className="queue-screen">
      <div className="queue-content">
        <div className="spinner"></div>
        <h1>Finding Your Group...</h1>
        <p className="queue-info">
          {queueSize === 0 ? 'Looking for players' : `${queueSize} player${queueSize === 1 ? '' : 's'} waiting`}
        </p>
        <p className="class-code">Class: {classCode}</p>
        <p className="instruction">You'll be matched with {othersNeeded} other student{othersNeeded === 1 ? '' : 's'} shortly</p>
      </div>
    </div>
  );
}
