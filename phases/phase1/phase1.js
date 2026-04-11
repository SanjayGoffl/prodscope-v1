// phases/phase1/phase1.js
import { state } from '../../core/state.js';
import { goTo } from '../../core/router.js';

/* ════════════════════════════════════════════════
   PHASE 1 — PRODUCT CHIPS
   [Logic extracted from full.html:1716]
════════════════════════════════════════════════ */

export function init() {
    const featInput = document.getElementById('p-feat-input');
    const featChips = document.getElementById('feat-chips');
    const btnNext = document.getElementById('btn-p1-next');

    // Restore existing state if any
    if (state.product.name) document.getElementById('p-name').value = state.product.name;
    if (state.product.price) document.getElementById('p-price').value = state.product.price;
    if (state.product.desc) document.getElementById('p-desc').value = state.product.desc;
    renderChips();

    function addFeature(val) {
        val = val.trim().replace(/,+$/, '');
        if (!val || state.product.features.includes(val)) return;
        state.product.features.push(val);
        renderChips();
    }

    // Expose to window for onclick in HTML
    window.removeFeature = (val) => {
        state.product.features = state.product.features.filter(f => f !== val);
        renderChips();
    };

    function renderChips() {
        if (!featChips) return;
        featChips.innerHTML = state.product.features.map(f =>
            `<span class="chip">${f}<button onclick="removeFeature('${f}')">×</button></span>`
        ).join('');
    }

    featInput?.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addFeature(featInput.value);
            featInput.value = '';
        }
    });

    featInput?.addEventListener('blur', () => {
        if (featInput.value.trim()) {
            addFeature(featInput.value);
            featInput.value = '';
        }
    });

    btnNext?.addEventListener('click', () => {
        const name = document.getElementById('p-name').value.trim();
        const price = parseFloat(document.getElementById('p-price').value);
        const desc = document.getElementById('p-desc').value.trim();

        if (!name) return alert('Please enter a product name.');
        if (!desc) return alert('Please enter a product description.');

        state.product.name = name;
        state.product.price = isNaN(price) ? 0 : price;
        state.product.desc = desc;

        goTo(2);
    });
}
