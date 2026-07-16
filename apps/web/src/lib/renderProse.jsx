import { useEffect, useId, useLayoutEffect, useRef } from "react";
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
function alignCitePopover(popEl, triggerEl) {
  if (!popEl || !triggerEl) return;

  const vw = window.innerWidth;
  const width = Math.min(CITE_POP_MAX_WIDTH, Math.max(0, vw - CITE_POP_GUTTER * 2));

  // Apply responsive width and clear any prior shift before measuring real bounds.
  popEl.style.setProperty("--cite-pop-width", `${width}px`);
  popEl.style.setProperty("--cite-pop-shift", "0px");

  const triggerRect = triggerEl.getBoundingClientRect();
  const centeredLeft = triggerRect.left + triggerRect.width / 2 - width / 2;
  const shift = citePopoverEdgeShift(
    { left: centeredLeft, right: centeredLeft + width },
    vw,
  );
  if (shift === 0) return;

  popEl.style.setProperty("--cite-pop-shift", `${shift}px`);
}

function GenCiteChip({
  citation,
  query,
  roleLens,
  disclosureId,
  isOpen,
  onDisclosureToggle,
}) {
  const popRef = useRef(null);
  const triggerRef = useRef(null);
  const disclosureRef = useRef(null);
  const pinnedRef = useRef(false);
  const reactId = useId();
  const popoverId = `citation-popover-${reactId.replace(/:/g, "")}`;
  const align = () => alignCitePopover(popRef.current, triggerRef.current);
  const label = `[${citation.ref || "?"}]`;
  const popover = (
    <span ref={popRef} className="pf-pg-gen-cite-pop">
      <span className="pf-pg-gen-cite-pop-t">{citation.title}</span>
      <span className="pf-pg-gen-cite-pop-s">{citation.snippet}</span>
    </span>
  );

  useLayoutEffect(() => {
    if (!citation.project_id && isOpen) align();
  }, [citation.project_id, isOpen]);

  useEffect(() => {
    if (!isOpen) pinnedRef.current = false;
    if (citation.project_id || !isOpen) return undefined;

    const dismissOutside = (event) => {
      if (!disclosureRef.current?.contains(event.target)) {
        pinnedRef.current = false;
        onDisclosureToggle(null);
      }
    };
    const dismissEscape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        pinnedRef.current = false;
        onDisclosureToggle(null);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [citation.project_id, isOpen, onDisclosureToggle]);

  if (citation.project_id) {
    return (
      <Link
        ref={triggerRef}
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
      ref={disclosureRef}
      className={`pf-pg-gen-cite-disclosure${isOpen ? " is-open" : ""}`}
      onMouseEnter={() => {
        if (!isOpen) {
          align();
          onDisclosureToggle(disclosureId);
        }
      }}
      onMouseLeave={() => {
        if (!pinnedRef.current) onDisclosureToggle(null);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="pf-pg-gen-cite is-static"
        aria-expanded={isOpen}
        aria-controls={popoverId}
        onFocus={align}
        onClick={() => {
          if (isOpen && pinnedRef.current) {
            pinnedRef.current = false;
            onDisclosureToggle(null);
            return;
          }
          align();
          pinnedRef.current = true;
          onDisclosureToggle(disclosureId);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (isOpen && pinnedRef.current) {
              pinnedRef.current = false;
              onDisclosureToggle(null);
              return;
            }
            align();
            pinnedRef.current = true;
            onDisclosureToggle(disclosureId);
          }
        }}
      >
        {label}
      </button>
      <span
        ref={popRef}
        id={popoverId}
        className="pf-pg-gen-cite-pop"
        role="region"
        aria-label={`Evidence ${label}`}
        hidden={!isOpen}
      >
        <span className="pf-pg-gen-cite-pop-t">{citation.title}</span>
        <span className="pf-pg-gen-cite-pop-s">{citation.snippet}</span>
      </span>
    </span>
  );
}

/**
 * Parse handoff prose mini-markup into React nodes for the playground page.
 * Ported from profile-handoff _renderProse (complete-string parsing only).
 */
export function renderProse(
  text,
  citations,
  {
    query,
    roleLens,
    keyPrefix = "p",
    openCitationId = null,
    onCitationToggle = () => {},
  } = {},
) {
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
        const disclosureId = `${keyPrefix}c${ci}`;
        out.push(
          <GenCiteChip
            key={disclosureId}
            citation={citation}
            query={query}
            roleLens={roleLens}
            disclosureId={disclosureId}
            isOpen={openCitationId === disclosureId}
            onDisclosureToggle={onCitationToggle}
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
