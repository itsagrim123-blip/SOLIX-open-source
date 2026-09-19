/**
 * Deterministic conversation title generator.
 * Turns user queries like "can you make a python calculator" into "Python Calculator",
 * eliminating conversational filler, greetings, and truncated prefixes.
 */
export function generateConversationTitle(prompt: string, backendTitle?: string): string {
  if (
    backendTitle &&
    backendTitle.trim() &&
    !["New Conversation", "New Chat", "Chat", "Untitled", "Conversation"].includes(backendTitle.trim())
  ) {
    return cleanTitle(backendTitle);
  }

  if (!prompt || !prompt.trim()) {
    return "New Conversation";
  }

  let text = prompt.trim();

  // Strip markdown code fences or backticks
  text = text.replace(/```[\s\S]*?```/g, "").replace(/`([^`]+)`/g, "$1");

  // Strip common conversational openings & greetings
  const fillerPatterns = [
    /^(?:hey|hi|hello|herrlo|greetings|good\s+(?:morning|afternoon|evening))\s*[,!.:-]?\s*/i,
    /^(?:can|could|would)\s+you\s+(?:please\s+)?(?:help\s+me\s+(?:to\s+)?)?(?:make|build|create|write|code|generate|explain|summarize|design|give\s+me|show\s+me)?\s*/i,
    /^(?:please\s+)?(?:help\s+me\s+(?:to\s+)?)?(?:make|build|create|write|code|generate|explain|summarize|analyze|tell\s+me\s+about|show\s+me)\s*/i,
    /^(?:what\s+is|what\s+are|how\s+do|how\s+to|how\s+does|why\s+is|why\s+does)\s*/i,
    /^(?:i\s+want\s+to|i\s+need\s+to|let['’]s|i['’]m\s+trying\s+to)\s*/i,
  ];

  for (const pattern of fillerPatterns) {
    text = text.replace(pattern, "");
  }

  // If text became empty or was solely a greeting
  if (!text.trim()) {
    return "Quick Inquiry";
  }

  // Remove trailing punctuation
  text = text.replace(/[?.!,:;]+$/, "").trim();

  // Extract first meaningful phrase or sentence
  const firstSentence = text.split(/\n|\. |\? /)[0].trim();
  text = firstSentence || text;

  // Split into words
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "New Conversation";

  // Take up to 5 words or 35 characters
  let candidate = "";
  for (const word of words) {
    if ((candidate + " " + word).trim().length > 34) break;
    candidate = (candidate + " " + word).trim();
  }

  if (!candidate) {
    candidate = text.slice(0, 32);
  }

  return cleanTitle(candidate);
}

function cleanTitle(str: string): string {
  const smallWords = new Set(["a", "an", "the", "in", "on", "at", "to", "for", "with", "and", "or", "of"]);
  const words = str.split(/\s+/).map((w, idx) => {
    const lower = w.toLowerCase();
    if (idx > 0 && smallWords.has(lower)) {
      return lower;
    }
    return w.charAt(0).toUpperCase() + w.slice(1);
  });

  const result = words.join(" ").slice(0, 36).trim();
  return result || "New Conversation";
}

/**
 * Sanitize legacy dirty test-like titles ("Hi", "Hello", "Herrlo", "Please summarize and anal...")
 */
export function sanitizeExistingTitle(title: string): string {
  if (!title) return "New Conversation";
  const trimmed = title.trim();
  if (/^(?:hi|hello|herrlo|hey)\s*$/i.test(trimmed)) {
    return "Quick Inquiry";
  }
  if (/^please\s+summarize\s+and\s+anal/i.test(trimmed)) {
    return "Text Summary & Analysis";
  }
  if (trimmed === "New Chat" || trimmed === "Chat" || trimmed === "Conversation") {
    return "New Conversation";
  }
  return trimmed;
}

