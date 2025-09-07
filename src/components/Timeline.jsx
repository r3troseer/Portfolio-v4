export const Timeline = ({ items }) => {
  return (
    <div className="timeline">
      {items.map((item, index) => (
        <div key={index} className="timeline-item">
          <h4>{item.title}</h4>
          <p>{item.description}</p>
        </div>
      ))}
    </div>
  );
};

// merge timeline with experience
