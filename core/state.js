// core/state.js

/* ════════════════════════════════════════════════
   GLOBAL APP STATE
   [Shared across all phases]
════════════════════════════════════════════════ */

export let state = {
    product: {
        name: "",
        tagline: "",
        category: "",
        audience: "",
        description: "",
        market: "India", // India | Global
        segment: "B2C",  // B2C | B2B | Enterprise
        pricing: {
            type: "paid",       // free | freemium | paid
            billing: "monthly", // monthly | yearly | one-time
            amount: 0,
            currency: "INR"     // auto
        },
        differentiator: "",
        features: [] // Each: { name, category, priority }
    },
    competitors: [],
    analysisData: null,
    simResults: [],
    simSummary: null
};

// Make it globally accessible for transition convenience if needed
window.state = state;

/**
 * Update the global state and optionally trigger UI refreshes
 */
export function updateState(newState) {
    Object.assign(state, newState);
    console.log('[STATE UPDATE]', state);
}
