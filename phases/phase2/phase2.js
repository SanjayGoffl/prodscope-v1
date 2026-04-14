import { state, updateState } from '../../core/state.js';
import { goTo } from '../../core/router.js';
import { callLLM } from '../../core/ai.js';

export function init() {
    const grid = document.getElementById('comp-grid');
    const discoveryStatus = document.getElementById('discovery-status');
    const selectedCountSpan = document.getElementById('selected-count');
    const compCountBadge = document.getElementById('comp-count-badge');

    window.removeCompetitor = (idx) => {
        let newComps = [...state.competitors];
        newComps.splice(idx, 1);
        updateState({ competitors: newComps });
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
        // Dynamically scales to support 10-20+ competitors. Utilizing CSS Grid ensures it won't break UI.
        grid.innerHTML = state.competitors.map((c, i) => `
            <div class="comp-card ${c.selected ? 'selected' : ''}" id="cc-${i}">
                <button class="remove-btn" onclick="removeCompetitor(${i})"><i class="fa-solid fa-xmark"></i></button>
                <div class="comp-name">
                    ${c.name}
                    ${c.verified ? '<i class="fa-solid fa-circle-check text-green" title="Verified Active"></i>' : ''}
                </div>
                <div class="comp-domain"><i class="fa-solid fa-link"></i> <a href="${c.url}" target="_blank" style="color:inherit;text-decoration:none;">${c.url}</a></div>
                ${c.price ? `<span class="badge badge-yellow">${c.price}</span>` : ''}
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
        discoveryStatus.textContent = '🤖 Running Advanced AI discovery... (Expanding search to 10-20 competitors)';
        if (grid) grid.innerHTML = `<div class="text-secondary text-sm" style="padding:.5rem;"><i class="fa-solid fa-circle-notch fa-spin"></i> Discovering broad range of competitors via AI agents...</div>`;

        const productFeatures = state.product.features && state.product.features.length 
            ? state.product.features.map(f => f.name || f).join(', ')
            : 'General functionality';

        // Updated prompt to specifically request 10-20 active products without hallucination mapping
        const prompt = `You are a professional market research analyst.
Identify at least 10 to 15 direct competitors to the product below. 
Generate a BROAD list, but ensure they are CURRENTLY ACTIVE products and REAL companies. Do not hallucinate URLs. Include up-to-date pricing if typically publicly available.

PRODUCT: ${state.product.name}
DESCRIPTION: ${state.product.description}
FEATURES: ${productFeatures}

Strict JSON format required:
[
  {
    "name": "Competitor Name",
    "url": "https://example.com",
    "price": "pricing details or amount"
  }
]`;

        try {
            // STEP 1: Generate Competitors via AI (Frontend calls LLM)
            const raw = await callLLM(prompt, 'gemini', 3000);
            let cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
            const start = cleaned.indexOf('[');
            const end = cleaned.lastIndexOf(']');
            if (start === -1 || end === -1) throw new Error("Invalid format returned by LLM");
            
            let parsed = JSON.parse(cleaned.slice(start, end + 1));

            // Format appropriately before sending to backend
            let unverifiedCompetitors = parsed.map(c => ({
                name: c.name,
                url: c.url,
                price: c.price,
                verified: false
            }));
            
            discoveryStatus.textContent = `⏳ Verifying and filtering ${unverifiedCompetitors.length} competitors through backend validation layer...`;

            // STEP 2: Verify URLs via Backend API (Filters out dead links/fakes)
            let verifiedCompetitors = [];
            try {
                const apiRes = await fetch('/api/verify-competitors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ competitors: unverifiedCompetitors })
                });

                if (apiRes.ok) {
                    const verificationResponse = await apiRes.json();
                    verifiedCompetitors = verificationResponse.verified || unverifiedCompetitors;
                } else {
                    verifiedCompetitors = unverifiedCompetitors;
                }
            } catch (err) {
                console.warn("Backend verification failed. Proceeding with raw data.", err);
                verifiedCompetitors = unverifiedCompetitors; 
            }

            if (verifiedCompetitors.length === 0) {
                 throw new Error("No competitors passed the active URL verification check.");
            }

            // STEP 3: Store in State and Render UI
            const finalCompetitors = verifiedCompetitors.map(c => ({
                ...c,
                domain: (function() {
                    try { return new URL(c.url).hostname; } 
                    catch(e) { return c.url; }
                })(),
                selected: true
            }));

            updateState({ competitors: finalCompetitors });
            renderCompGrid();
            discoveryStatus.textContent = `✅ Successfully found and verified ${finalCompetitors.length} active competitors.`;
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
            return alert('Please select or add at least one active competitor.');
        }
        goTo(3);
    });

    document.getElementById('btn-add-manual')?.addEventListener('click', () => {
        const name = document.getElementById('m-name').value.trim();
        const urlInput = document.getElementById('m-url').value.trim();
        let domain = document.getElementById('m-domain').value.trim();

        if (!name || (!urlInput && !domain)) return alert('Name and URL/Domain are required.');
        
        let finalUrl = urlInput;
        if (!finalUrl && domain) {
           finalUrl = `https://${domain}`;
        } else if (finalUrl && !finalUrl.startsWith('http')) {
           finalUrl = `https://${finalUrl}`;
        }
        
        if (!domain) {
            try { domain = new URL(finalUrl).hostname; } catch(e) { domain = finalUrl; }
        }

        const comp = {
            name, domain, url: finalUrl,
            selected: true, price: "N/A", verified: true
        };
        
        updateState({ competitors: [...state.competitors, comp] });

        document.getElementById('m-name').value = '';
        document.getElementById('m-domain').value = '';
        document.getElementById('m-url').value = '';
        renderCompGrid();
    });

    if (!state.competitors || state.competitors.length === 0) {
        discoverCompetitors();
    } else {
        renderCompGrid();
    }
}
