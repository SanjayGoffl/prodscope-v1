// core/state.js

/* ════════════════════════════════════════════════
   GLOBAL APP STATE
   [Shared across all phases]
════════════════════════════════════════════════ */

export let state = {
    product: {
        name: '',
        price: 0,
        desc: '',
        features: []
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
