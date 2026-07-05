import { Icon } from "./Icon";
import { getCapabilities } from "../content/adapters/profileAdapter";
import "../styles/profile/capabilities.css";

// Inline **bold** renderer for the niche description (canonical content keeps the
// markdown emphasis; this is presentation only, no extra dependency).
const renderEmphasis = (text) =>
  text.split(/\*\*(.+?)\*\*/g).map((segment, i) =>
    i % 2 === 1 ? <strong key={i}>{segment}</strong> : segment
  );

const cellClassByKey = {
  lang: "pf-cap-lang",
  fw: "pf-cap-fw",
  data: "pf-cap-data",
  pr: "pf-cap-pr",
};

export const Capabilities = () => {
  const { niche, categories } = getCapabilities();

  return (
    <div className="pf-bento-e">
      <div className="pf-bento-hero">
        <div className="pf-bento-head">
          <h4>
            {niche.icon && <Icon name={niche.icon} size={16} />}
            {niche.label}
          </h4>
          <span className="pf-niche-tag">{niche.tag}</span>
        </div>
        <div className="pf-cap-chips pf-niche-chips">
          {niche.chips.map((chip, i) => (
            <span className="pf-chip" key={i}>
              {chip}
            </span>
          ))}
        </div>
        <p className="pf-bento-desc">{renderEmphasis(niche.description)}</p>
        <div className="pf-flow">
          <div className="pf-flow-col">
            {niche.flow.from.map((item, i) => (
              <span className="pf-flow-chip messy" key={i}>
                {item}
              </span>
            ))}
          </div>
          <div className="pf-flow-arrow">
            <span className="dot" />
          </div>
          <div className="pf-flow-col">
            {niche.flow.to.map((item, i) => (
              <span className="pf-flow-chip structured" key={i}>
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {categories.map((cat) => (
        <div className={`pf-cap ${cellClassByKey[cat.key] || ""}`} key={cat.key}>
          <div className="pf-cap-header">
            <Icon name={cat.icon} size={16} />
            {cat.label}
            <span className="pf-cap-count">{cat.count}</span>
          </div>
          <div className="pf-cap-lead">
            <span className="dot" />
            {cat.primary}
          </div>
          <div className="pf-cap-note">{cat.note}</div>
          <div className="pf-cap-rest">
            {cat.items.map((item, i) => (
              <span key={i}>{item}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
