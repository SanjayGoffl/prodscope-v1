// core/router.js
import { state } from './state.js';

const TOTAL_PHASES = 7;
let currentPhase = 1;

export async function goTo(phaseNum) {
    if (phaseNum < 1 || phaseNum > TOTAL_PHASES) return;
    
    currentPhase = phaseNum;
    updateStepIndicator();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const container = document.getElementById('app-container');
    if (!container) return;

    try {
        // 1. Fetch HTML
        const response = await fetch(`phases/phase${phaseNum}/phase${phaseNum}.html`);
        const html = await response.text();
        container.innerHTML = html;

        // 2. Update Styles
        const styleLink = document.getElementById('phase-styles');
        if (styleLink) {
            styleLink.href = `phases/phase${phaseNum}/phase${phaseNum}.css`;
        }

        // 3. Dynamically import JS to initialize phase logic
        // Use a timestamp to bypass cache during development if needed, 
        // but here we just import the module.
        const module = await import(`../phases/phase${phaseNum}/phase${phaseNum}.js?v=${Date.now()}`);
        if (module.init) {
            module.init();
        }
    } catch (error) {
        console.error(`Failed to load Phase ${phaseNum}:`, error);
        container.innerHTML = `<div class="card"><h2 style="color:var(--red)">Error Loading Phase ${phaseNum}</h2><p>${error.message}</p></div>`;
    }
}

export function updateStepIndicator() {
    for (let i = 1; i <= TOTAL_PHASES; i++) {
        const el = document.getElementById(`sp${i}`);
        if (!el) continue;
        el.className = 'step-pill';
        if (i < currentPhase) el.classList.add('done');
        else if (i === currentPhase) el.classList.add('active');
    }
}

// Initial route
document.addEventListener('DOMContentLoaded', () => {
    goTo(1);
});
