export interface ModelMetadata {
  label: string;
  description: string;
  badge?: string;
  category?: "light" | "balanced" | "code" | "heavy";
}

export const MODEL_REGISTRY: Record<string, ModelMetadata> = {
  "qwen3:1.7b": {
    label: "Qwen 3 · 1.7B",
    description: "Quick chats · Lightweight tasks",
    badge: "Fast",
    category: "light",
  },
  "qwen3:4b": {
    label: "Qwen 3 · 4B",
    description: "Balanced reasoning · Daily assistant",
    badge: "Balanced",
    category: "balanced",
  },
  "qwen3:8b": {
    label: "Qwen 3 · 8B",
    description: "General use · Better reasoning",
    badge: "General",
    category: "heavy",
  },
  "qwen2.5-coder:7b": {
    label: "Qwen 2.5 Coder · 7B",
    description: "Programming · Coding assistance",
    badge: "Coder",
    category: "code",
  },
  "gemma3:4b": {
    label: "Gemma 3 · 4B",
    description: "Vision · Image understanding",
    badge: "Vision",
    category: "balanced",
  },
  "phi4-mini:latest": {
    label: "Phi-4 Mini · 3.8B",
    description: "Fast reasoning · Efficient answers",
    badge: "Fast",
    category: "light",
  },
  "phi4-mini": {
    label: "Phi-4 Mini · 3.8B",
    description: "Fast reasoning · Efficient answers",
    badge: "Fast",
    category: "light",
  },
  "llama3.2:latest": {
    label: "Llama 3.2 · 3B",
    description: "Quick chats · Lightweight tasks",
    badge: "Meta",
    category: "light",
  },
  "llama3.2": {
    label: "Llama 3.2 · 3B",
    description: "Quick chats · Lightweight tasks",
    badge: "Meta",
    category: "light",
  },
};

/**
 * Get human-readable display label for a model identifier.
 */
export function getModelLabel(modelId: string): string {
  if (!modelId) return "AI Model";
  if (MODEL_REGISTRY[modelId]) {
    return MODEL_REGISTRY[modelId].label;
  }
  // Try matching without tag
  const baseName = modelId.split(":")[0];
  if (MODEL_REGISTRY[baseName]) {
    return MODEL_REGISTRY[baseName].label;
  }
  // Format slug nicely: "qwen2.5-coder" -> "Qwen2.5 Coder"
  return modelId
    .replace(/:latest$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Get summary description of what the model is optimal for.
 */
export function getModelDescription(modelId: string): string {
  if (!modelId) return "Local AI assistant model";
  if (MODEL_REGISTRY[modelId]) {
    return MODEL_REGISTRY[modelId].description;
  }
  const baseName = modelId.split(":")[0];
  if (MODEL_REGISTRY[baseName]) {
    return MODEL_REGISTRY[baseName].description;
  }
  return "Local AI model running via Ollama";
}

/**
 * Get badge pill text (e.g. "Fast", "Coder", "Powerful").
 */
export function getModelBadge(modelId: string): string {
  if (MODEL_REGISTRY[modelId]?.badge) {
    return MODEL_REGISTRY[modelId].badge!;
  }
  const baseName = modelId.split(":")[0];
  if (MODEL_REGISTRY[baseName]?.badge) {
    return MODEL_REGISTRY[baseName].badge!;
  }
  if (modelId.includes("coder") || modelId.includes("code")) return "Coder";
  if (modelId.includes("1.7b") || modelId.includes("3b")) return "Fast";
  if (modelId.includes("8b") || modelId.includes("14b")) return "Powerful";
  return "Local";
}

