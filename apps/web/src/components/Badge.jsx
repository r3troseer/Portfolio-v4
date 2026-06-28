import "../styles/badge.css";

export const Badge = ({
  text,
  type = "default",
  size = "medium",
  className = "",
}) => {
  // Validate text prop
  if (!text) {
    console.warn("Badge: text prop is required");
    return null;
  }

  const typeClasses = {
    live: "badge-live",
    private: "badge-private",
    unfinished: "badge-unfinished",
    mvp: "badge-mvp",
    primary: "badge-primary",
    secondary: "badge-secondary",
    tertiary: "badge-tertiary",
    default: "badge-default",
  };

  const sizeClasses = {
    small: "badge-small",
    medium: "badge-medium",
    large: "badge-large",
  };

  const typeClass = typeClasses[type] || typeClasses.default;
  const sizeClass = sizeClasses[size] || sizeClasses.medium;

  return (
    <span className={`badge ${typeClass} ${sizeClass} ${className}`.trim()}>
      {text}
    </span>
  );
};

// Enhanced BadgeGroup component
export const BadgeGroup = ({
  badges = [],
  className = "",
  size = "medium",
}) => {
  if (!badges.length) return null;

  return (
    <div className={`badge-group ${className}`.trim()}>
      {badges.map((badge, index) => (
        <Badge
          key={`${badge.text}-${index}`} // Better key for potential duplicates
          text={badge.text}
          type={badge.type || "default"}
          size={badge.size || size}
        />
      ))}
    </div>
  );
};
