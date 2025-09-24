import { DynamicIcon } from "lucide-react/dynamic";
import { Badge } from "./Badge";

const iconMap = {
  github: "github",
  docs: "bookOpen",
  demo: "playCircle",
  website: "globe",
};

export const ProjectHeader = ({ title, subtitle, overview, links, badge }) => {
  return (
    <div className="project-header">
      <h2 className="project-title">{title}</h2>
      {badge && <Badge text={badge.text} type={badge.type} />}
      <p className="project-subtitle">{subtitle}</p>
      <div className="project-overview">
        <p>{overview}</p>
      </div>
      <div className="project-links">
        {links.map((link, index) => {
          const iconName = iconMap[link.icon] || link.icon;
          return (
            <a
              key={index}
              href={link.href}
              className="project-link flex items-center gap-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              <DynamicIcon name={iconName} className="w-5 h-5" />
              {link.text}
            </a>
          );
        })}
      </div>
    </div>
  );
};
