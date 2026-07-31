export const EVIDENCE_ORIGIN = Object.freeze({
  PLAYGROUND: "playground",
  ASSISTANT: "assistant",
});

export function safeReturnPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}
