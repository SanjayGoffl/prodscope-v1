// phases/phase2/phase2.js
import { state } from '../../core/state.js';
import { goTo } from '../../core/router.js';
import { callLLM } from '../../core/ai.js';

/* ════════════════════════════════════════════════
   PHASE 2 — COMPETITORS
   [Logic extracted from full.html]
════════════════════════════════════════════════ */

export function init() {
    const grid = document.getElementById('comp-grid');
    const discoveryStatus = document.getElementById('discovery-status');
    const selectedCountSpan = document.getElementById('selected-count');
    const compCountBadge = document.getElementById('comp-count-badge');

    // Expose to window for onclick handlers in HTML
    window.removeCompetitor = (idx) => {
        state.competitors.splice(idx, 1);
        renderCompGrid();
    };

    window.toggleCompetitor = (idx, checked) => {
        if (state.competitors[idx]) {
            state.competitors[idx].selected = checked;
            document.getElementById(`cc-${idx}`)?.classList.toggle('selected', checked);
            updateSelectedCount();
        }
    };

    function updateSelectedCount() {
        const sel = state.competitors.filter(c => c.selected).length;
        if (selectedCountSpan) selectedCountSpan.textContent = sel;
        if (compCountBadge) compCountBadge.textContent = `${state.competitors.length} found`;
    }

    function renderCompGrid() {
        if (!grid) return;
        grid.innerHTML = state.competitors.map((c, i) => `
            <div class="comp-card ${c.selected ? 'selected' : ''}" id="cc-${i}">
                <button class="remove-btn" onclick="removeCompetitor(${i})"><i class="fa-solid fa-xmark"></i></button>
                <div class="comp-name">${c.name}</div>
                <div class="comp-domain"><i class="fa-solid fa-link"></i> ${c.domain}</div>
                ${c.price ? `<span class="badge badge-yellow">$${c.price}</span>` : ''}
                <div class="comp-actions">
                    <label class="comp-check-label">
                        <input type="checkbox" ${c.selected ? 'checked' : ''} onchange="toggleCompetitor(${i}, this.checked)" />
                        Include in analysis
                    </label>
                </div>
            </div>
        `).join('');
        updateSelectedCount();
    }

    async function discoverCompetitors() {
        if (!discoveryStatus) return;
        discoveryStatus.textContent = '🤖 Running AI discovery...';
        if (grid) grid.innerHTML = `<div class="text-secondary text-sm" style="padding:.5rem;"><i class="fa-solid fa-circle-notch fa-spin"></i> Querying AI agents for competitors...</div>`;

        const prompt = `You are a professional market research analyst.
Identify the 5 closest direct competitors to the product below. Return ONLY a JSON array of objects.
PRODUCT: ${state.product.name}
DESCRIPTION: ${state.product.desc}
FEATURES: ${state.product.features.join(', ')}

JSON Schema: [{"name": "Name", "domain": "example.com", "url": "https://...", "price": 99}]`;

        try {
            const raw = await callLLM(prompt, 'gemini', 2000);
            const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
            const start = cleaned.indexOf('[');
            const end = cleaned.lastIndexOf(']');
            const parsed = JSON.parse(cleaned.slice(start, end + 1));

            state.competitors = parsed.map(c => ({ ...c, selected: true }));
            renderCompGrid();
            discoveryStatus.textContent = `✅ Found ${state.competitors.length} competitors using Gemini.`;
        } catch (e) {
            console.error(e);
            discoveryStatus.textContent = '❌ Discovery failed. Please add manually.';
            if (grid) grid.innerHTML = '';
        }
    }

    document.getElementById('btn-discover-again')?.addEventListener('click', discoverCompetitors);
    document.getElementById('btn-p2-back')?.addEventListener('click', () => goTo(1));
    document.getElementById('btn-p2-next')?.addEventListener('click', () => {
        if (state.competitors.filter(c => c.selected).length === 0) {
            return alert('Please select or add at least one competitor.');
        }
        goTo(3);
    });

    document.getElementById('btn-add-manual')?.addEventListener('click', () => {
        const name = document.getElementById('m-name').value.trim();
        const domain = document.getElementById('m-domain').value.trim();
        const url = document.getElementById('m-url').value.trim();

        if (!name || !domain) return alert('Name and Domain are required.');

        state.competitors.push({
            name, domain, url: url || `https://${domain}`,
            selected: true, price: null
        });

        document.getElementById('m-name').value = '';
        document.getElementById('m-domain').value = '';
        document.getElementById('m-url').value = '';
        renderCompGrid();
    });

    // Auto-discover if empty
    if (state.competitors.length === 0) {
        discoverCompetitors();
    } else {
        renderCompGrid();
    }
}
