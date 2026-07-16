import { useRef } from "react";
import { Link } from "react-router";
import { EVIDENCE_ORIGIN } from "./evidenceNavigation";

const PROSE_RE = /==([^=]+)==|\[\[\s*([^\]]+?)\s*\]\]/gi;
const EVIDENCE_ID_PREFIX_RE = /^evidence_id:\s*/i;
const CITE_POP_MAX_WIDTH = 232;
const CITE_POP_GUTTER = 10;

function normalizeEvidenceId(raw) {
  return String(raw ?? "")
    .trim()
    .replace(EVIDENCE_ID_PREFIX_RE, "");
}

function cleanPlain(str) {
  return str
    .replace(/==/g, "")
    .replace(/\[\[|\]\]/g, "")
    .replace(/\[(?:\d{1,2})\]/g, "");
}

/** Strip handoff prose markup for modal plain-text display. */
export function stripProseMarkup(text) {
  let s = String(text ?? "");
  s = s.replace(/\[\[[^\]]*$/, "");
  s = s.replace(/==([^=]+)==/g, "$1");
  s = s.replace(/==/g, "");
  s = s.replace(/\[\[[^\]]+\]\]/g, "");
  s = s.replace(/\[\[|\]\]/g, "");
  s = s.replace(/\[(?:exp|\d{2})\]/gi, "");
  s = s.replace(/\s+([.,!?;:])/g, "$1");
  s = s.replace(/ {2,}/g, " ");
  return s.trim();
}

/** Smallest horizontal correction so both popover edges clear the viewport gutters. */
function citePopoverEdgeShift(rect, vw) {
  if (rect.left < CITE_POP_GUTTER) {
    return CITE_POP_GUTTER - rect.left;
  }
  if (rect.right > vw - CITE_POP_GUTTER) {
    return vw - CITE_POP_GUTTER - rect.right;
  }
  return 0;
}

/** Keep the anchored popover within horizontal viewport gutters. */
function alignCitePopover(popEl) {
  if (!popEl) return;

  const vw = window.innerWidth;
  const width = Math.min(CITE_POP_MAX_WIDTH, Math.max(0, vw - CITE_POP_GUTTER * 2));

  // Apply responsive width and clear any prior shift before measuring real bounds.
  popEl.style.setProperty("--cite-pop-width", `${width}px`);
  popEl.style.setProperty("--cite-pop-shift", "0px");

  let shift = citePopoverEdgeShift(popEl.getBoundingClientRect(), vw);
  if (shift === 0) return;

  popEl.style.setProperty("--cite-pop-shift", `${shift}px`);
}

function GenCiteChip({ citation, query, roleLens }) {
  const popRef = useRef(null);
  const align = () => alignCitePopover(popRef.current);
  const label = `[${citation.ref || "?"}]`;
  const popover = (
    <span ref={popRef} className="pf-pg-gen-cite-pop">
      <span className="pf-pg-gen-cite-pop-t">{citation.title}</span>
      <span className="pf-pg-gen-cite-pop-s">{citation.snippet}</span>
    </span>
  );

  if (citation.project_id) {
    return (
      <Link
        to={`/projects/${citation.project_id}`}
        state={{ from: EVIDENCE_ORIGIN.PLAYGROUND, q: query || "", roleLens }}
        className="pf-pg-gen-cite"
        onMouseEnter={align}
        onFocus={align}
      >
        {label}
        {popover}
      </Link>
    );
  }

  return (
    <span
      className="pf-pg-gen-cite is-static"
      onMouseEnter={align}
      onFocus={align}
    >
      {label}
      {popover}
    </span>
  );
}

/**
 * Parse handoff prose mini-markup into React nodes for the playground page.
 * Ported from profile-handoff _renderProse (complete-string parsing only).
 */
export function renderProse(text, citations, { query, roleLens, keyPrefix = "p" } = {}) {
  let s = String(text ?? "");
  s = s.replace(/==([^=]*)$/, "$1");
  s = s.replace(/\[\[[^\]]*$/, "");

  const citeById = new Map((citations || []).map((c) => [c.evidence_id, c]));
  const out = [];
  const re = new RegExp(PROSE_RE.source, PROSE_RE.flags);
  let last = 0;
  let match;
  let ci = 0;

  while ((match = re.exec(s))) {
    if (match.index > last) {
      out.push(cleanPlain(s.slice(last, match.index)));
    }
    if (match[0].startsWith("==")) {
      out.push(
        <span className="pf-pg-ev-mark" key={`${keyPrefix}h${ci}`}>
          {match[1]}
        </span>
      );
    } else if (match[2]) {
      const evidenceId = normalizeEvidenceId(match[2]);
      const citation = citeById.get(evidenceId);
      if (citation) {
        out.push(
          <GenCiteChip
            key={`${keyPrefix}c${ci}`}
            citation={citation}
            query={query}
            roleLens={roleLens}
          />
        );
      }
    }
    ci += 1;
    last = re.lastIndex;
  }

  if (last < s.length) {
    out.push(cleanPlain(s.slice(last)));
  }

  return out;
}

/** Slash-style label for ev-gen-skill (handoff genLabel). */
export function genLabelFromQuery(query) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return "/rag";
  const slug = q
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
  return `/${slug || "query"}`;
}
