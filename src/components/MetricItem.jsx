export const MetricItem = ({ number, label }) => {
  return (
    <div className="metrics-grid">
      <div className="metric-item">
        <div className="metric-number">{number}</div>
        <div className="metric-label">{label}</div>
      </div>
    </div>
  );
};
