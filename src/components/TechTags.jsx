export const TechTags = ({ tags }) => {
  return (
    <div className="tech-tags">
      {tags.map((tag, idx) => (
        <span className="tech-tag" key={idx}>
          {tag}
        </span>
      ))}
    </div>
  );
};
