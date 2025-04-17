/**
 * Match user input against detailed resource content and summaries.
 * Prioritizes deep matches from `fullResourceContent`, then fills in from `resourceDescriptions`.
 * Returns up to 3 top-matching items as formatted snippets.
 *
 * @param {string} userMessage - The user's question or input.
 * @param {object} resourceDescriptions - The summary-level resources (typically from KV).
 * @param {object} fullResourceContent - The detailed indexed content (from build-time parsing).
 * @returns {string} Formatted resource snippets for prompt injection.
 */
function getRelevantResources(userMessage, resourceDescriptions, fullResourceContent) {
  const keywords = userMessage.toLowerCase().split(/\s+/);
  const allMatches = new Map();

  // 🔍 Match full content entries first (higher priority)
  for (const [url, entry] of Object.entries(fullResourceContent)) {
    const title = entry.title?.toLowerCase() || '';
    const content = entry.content?.toLowerCase() || '';

    const score = keywords.filter(word =>
      title.includes(word) || content.includes(word)
    ).length;

    if (score > 0) {
      allMatches.set(url, {
        title: entry.title,
        score,
        excerpt: entry.content.slice(0, 1000) + "…" // Add ellipsis to hint truncation
      });
    }
  }

  // 📝 Fallback to summaries if not already matched
  for (const [category, items] of Object.entries(resourceDescriptions)) {
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      const url = item.url;
      if (!url || allMatches.has(url)) continue; // Skip if already matched from full content

      const title = item.title?.toLowerCase() || '';
      const desc = item.description?.toLowerCase() || '';

      const score = keywords.filter(word =>
        title.includes(word) || desc.includes(word)
      ).length;

      if (score > 0) {
        allMatches.set(url, {
          title: item.title,
          score,
          excerpt: item.description
        });
      }
    }
  }

  // 📊 Rank matches by score, take top 3
  const sorted = Array.from(allMatches.entries())
    .map(([url, match]) => ({ url, ...match }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // 🧠 Return formatted excerpt block
  return sorted.map(match =>
    `From "${match.title}":\n${match.excerpt}`
  ).join("\n\n");
}