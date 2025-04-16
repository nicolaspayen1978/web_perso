/**
 * Match user question against both fullResourceContent (deep content) and resources (summaries).
 * Returns the top 3 relevant items with excerpts for prompt enrichment.
 */
function getRelevantResources(userMessage, resourceDescriptions, fullResourceContent) {
    const keywords = userMessage.toLowerCase().split(/\s+/);
    const allMatches = new Map();

    // 🔍 First: Match deep content from resourcesContent.json
    for (const [url, entry] of Object.entries(fullResourceContent)) {
        const title = entry.title.toLowerCase();
        const content = (entry.content || "").toLowerCase();

        let score = keywords.filter(word =>
            title.includes(word) || content.includes(word)
        ).length;

        if (score > 0) {
            allMatches.set(url, {
                title: entry.title,
                score,
                excerpt: entry.content.slice(0, 1000) + "..."
            });
        }
    }

    // 🔍 Then: Match summaries from resources.json (fetched via KV)
    for (const [category, items] of Object.entries(resources)) {
        if (!Array.isArray(items)) continue;

        for (const item of items) {
            const url = item.url;
            if (!url || allMatches.has(url)) continue; // skip if already matched from fullContent

            const title = item.title.toLowerCase();
            const desc = (item.description || "").toLowerCase();

            let score = keywords.filter(word =>
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

    // 📊 Sort matches by score (descending)
    const sorted = Array.from(allMatches.entries())
        .map(([url, match]) => ({ url, ...match }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3); // limit to top 3

    // 🧠 Return a formatted snippet for prompt inclusion
    return sorted.map(match =>
        `From "${match.title}":\n${match.excerpt}`
    ).join("\n\n");
}