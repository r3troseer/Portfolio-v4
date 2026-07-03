export const Timeline = ({ items }) => {
  return (
    <div className="pf-pd-timeline">
      {items.map((item, index) => (
        <div key={index} className="pf-pd-tl-item">
          <span className="pf-pd-tl-dot" />
          <h4>{item.title}</h4>
          <p>{item.description}</p>
        </div>
      ))}
    </div>
  );
};
