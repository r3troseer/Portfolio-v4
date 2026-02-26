export const TechTags = ({ tags }) => {
  return (
    <div className="tech-tags">
      {tags.map((tag) => (
        <span className="tech-tag" key={tag}>
          {tag}
        </span>
      ))}
    </div>
  );
};
