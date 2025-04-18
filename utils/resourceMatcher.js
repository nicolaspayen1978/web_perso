/**
 * Match user input against detailed resource content and summaries.
 * Prioritizes deep matches from `fullResourceContent`, then fills in from `resourceDescriptions`.
 * Returns up to 3 top-matching items as formatted snippets.
 *
 * @param {string} userMessage - The user's question or input.
 * @param {object} resourceDescriptions - The summary-level resources (typically from KV).
 * @param {object} fullResourceContent - The enriched resource content (with keywords, entities, summary).
 * @param {object} [options] - Optional flags, e.g. { includeUrls: true, debug: true }
 * @returns {string|object[]} Formatted resource snippets or array with match details.
 */
function getRelevantResources(userMessage, resourceDescriptions, fullResourceContent, options = {}) {
  const keywords = userMessage.toLowerCase().split(/\s+/);
  const allMatches = new Map();

  // 🔍 Match enriched full content entries first (higher priority)
  for (const [url, entry] of Object.entries(fullResourceContent)) {
    const title = entry.title?.toLowerCase() || '';
    const content = entry.content?.toLowerCase() || '';
    const summary = entry.summary?.toLowerCase() || '';
    const entityList = Array.isArray(entry.entities) ? entry.entities.map(e => e.toLowerCase()) : [];
    const keywordList = Array.isArray(entry.keywords) ? entry.keywords.map(k => k.toLowerCase()) : [];

    let score = 0;
    const reasons = [];

    for (const word of keywords) {
      if (keywordList.includes(word)) {
        score += 3; reasons.push(`+3 keyword: ${word}`);
      }
      if (entityList.includes(word)) {
        score += 2; reasons.push(`+2 entity: ${word}`);
      }
      if (title.includes(word)) {
        score += 1.5; reasons.push(`+1.5 title: ${word}`);
      }
      if (summary.includes(word)) {
        score += 1; reasons.push(`+1 summary: ${word}`);
      }
      if (content.includes(word)) {
        score += 0.5; reasons.push(`+0.5 content: ${word}`);
      }
    }

    if (score > 0) {
      allMatches.set(url, {
        title: entry.title,
        score,
        excerpt: entry.summary || entry.content.slice(0, 1000) + '…',
        reasons
      });
    }
  }

  // 📝 Fallback to resourceDescriptions only if not matched above
  if (allMatches.size === 0) {
    for (const [category, items] of Object.entries(resourceDescriptions)) {
      if (!Array.isArray(items)) continue;

      for (const item of items) {
        const url = item.url;
        if (!url) continue;

        const title = item.title?.toLowerCase() || '';
        const desc = item.description?.toLowerCase() || '';

        const score = keywords.filter(word => title.includes(word) || desc.includes(word)).length;

        if (score > 0) {
          allMatches.set(url, {
            title: item.title,
            score,
            excerpt: item.description,
            reasons: [`fallback from resourceDescriptions (${score} match${score > 1 ? 'es' : ''})`]
          });
        }
      }
    }
  }

  // 📊 Rank matches by score, take top 5
  const sorted = Array.from(allMatches.entries())
    .map(([url, match]) => ({ url, ...match }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (options.debug || options.includeUrls) {
    return sorted; // Return detailed objects if debugging or URLs needed
  }

  // 🧠 Return formatted excerpt block by default
  return sorted.map(match => `From "${match.title}":\n${match.excerpt}`).join("\n\n");
}

export { getRelevantResources };
