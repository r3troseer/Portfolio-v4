import "../styles/badge.css";

const badgeTypeMap = {
  default: "badge badge-default",
  warning: "badge badge-warning",
  secondary: "badge badge-secondary",
  outline: "badge badge-outline",
};

export const Badge = ({ text, type = "default" }) => {
  const className = badgeTypeMap[type] || badgeTypeMap.default;
  return <span className={className}>{text}</span>;
};
