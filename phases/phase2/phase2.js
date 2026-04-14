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
        grid.innerHTML = state.competitors.slice(0, 20).map((c, i) => `
            <div class="comp-card ${c.selected ? 'selected' : ''}" id="cc-${i}">
                <button class="remove-btn" onclick="removeCompetitor(${i})"><i class="fa-solid fa-xmark"></i></button>
                <div class="comp-name">
                    ${c.name}
                    ${c.verified ? '<i class="fa-solid fa-circle-check text-green" title="Verified Active"></i>' : ''}
                </div>
                <div class="comp-domain"><i class="fa-solid fa-link"></i> <a href="${c.url}" target="_blank" style="color:inherit;text-decoration:none;">${c.domain || c.url}</a></div>
                ${c.price && c.price !== 'N/A' ? `<span class="badge badge-yellow">${c.price}</span>` : ''}
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
        
        // CLEAR previous state before new run
        updateState({ competitors: [] });
        
        discoveryStatus.textContent = '🤖 Running Advanced AI discovery... (Expanding search to 10-20 competitors)';
        if (grid) grid.innerHTML = `<div class="text-secondary text-sm" style="padding:.5rem;"><i class="fa-solid fa-circle-notch fa-spin"></i> Discovering broad range of competitors via AI agents...</div>`;

        const productFeatures = state.product.features && state.product.features.length 
            ? state.product.features.map(f => f.name || f).join(', ')
            : 'General functionality';

        // STEP 0: Delegate heavy generation to Python backend 
        discoveryStatus.textContent = '🌐 Interacting with high-speed backend execution layer...';
        let finalRawLLM = null;
        let liveContext = "No live context found.";
        try {
            const fullDescWithFeatures = state.product.description + "\nFEATURES: " + productFeatures;
            const searchRes = await fetch('http://127.0.0.1:8000/api/search-competitors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    product_name: state.product.name, 
                    product_description: fullDescWithFeatures 
                })
            });
            if (searchRes.ok) {
                const searchData = await searchRes.json();
                if (searchData.context && searchData.context.startsWith("JSON_PAYLOAD_DIRECT:")) {
                     finalRawLLM = searchData.context.replace("JSON_PAYLOAD_DIRECT:", "");
                } else {
                     liveContext = searchData.context;
                }
            }
        } catch(err) {
            console.warn("Backend rapid execution failed, falling back to local processing.", err);
        }

        // Updated prompt to specifically request 15 active products without hallucination mapping
        const prompt = `You are a professional market research analyst.
Identify EXACTLY the top 15 MOST RELEVANT direct competitors to the product below. 
Ensure they are CURRENTLY ACTIVE products and REAL companies.
CRITICALLY IMPORTANT: Base your extraction ON THE RECENT SEARCH RESULTS CONTEXT below to find the absolute newest models released this year. Do not rely heavily on your old knowledge. Include up-to-date pricing if found. Do not hallucinate URLs.

PRODUCT: ${state.product.name}
DESCRIPTION: ${state.product.description}
FEATURES: ${productFeatures}

RECENT SEARCH RESULTS CONTEXT (USE THIS TO FIND NEWEST RELEASES):
${liveContext}

        Strict JSON format required:
        [
          {
            "name": "Competitor Name",
            "url": "https://www.company.com", // MUST be the root domain only (e.g., https://www.apple.com). Do not provide full product pages as they often 404. Must include https://
            "price": "pricing details or amount"
          }
        ]`;

        try {
            let raw = finalRawLLM;
            if (!raw) {
                 discoveryStatus.textContent = '🤖 Analyzing live search data via frontend AI chain...';
                 raw = await callLLM(prompt, 'groq_general', 2000);
            }
            let cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
            const start = cleaned.indexOf('[');
            const end = cleaned.lastIndexOf(']');
            if (start === -1 || end === -1) throw new Error("Invalid format returned by LLM");
            
            let unverifiedCompetitors = [];
            try {
                unverifiedCompetitors = JSON.parse(cleaned.substring(start, end + 1));
                
                // Format appropriately before sending to backend if JSON parse succeeded
                unverifiedCompetitors = unverifiedCompetitors.map(c => ({
                    name: c.name ? c.name.trim() : "Unknown",
                    url: c.url ? c.url.trim() : "",
                    price: c.price,
                    verified: false
                }));
            } catch(e) {
                console.warn("JSON Parse failed, executing supreme regex extractor", e);
                // Bulletproof regex that finds any object-like structure with a URL
                const urlRegex = /"https?:\/\/[^"]+"/gi;
                
                const lines = cleaned.split('\n');
                let tempComp = {};
                for (let line of lines) {
                    if (line.includes('http')) {
                        let urlMatch = line.match(urlRegex);
                        if (urlMatch) {
                            unverifiedCompetitors.push({
                                name: tempComp.name || "Competitor",
                                url: urlMatch[0].replace(/"/g, ''),
                                price: tempComp.price || "Check website"
                            });
                            tempComp = {}; // reset
                        }
                    } else if (line.toLowerCase().includes('name')) {
                        let parts = line.split(':');
                        if (parts.length > 1) tempComp.name = parts[1].replace(/["',]/g, '').trim();
                    } else if (line.toLowerCase().includes('price')) {
                        let parts = line.split(':');
                        if (parts.length > 1) tempComp.price = parts[1].replace(/["',]/g, '').trim();
                    }
                }
            }

            if (unverifiedCompetitors.length === 0) {
                // Absolute failsafe fallback to ensure UI never freezes on regex misses
                unverifiedCompetitors = finalRawLLM.match(/https?:\/\/[^\s"',)]+/g)?.map((url, i) => ({
                    name: `Competitor ${i+1}`,
                    url: url,
                    price: "See website"
                })) || [];
                 if (unverifiedCompetitors.length === 0) throw new Error("Could not parse competitors from AI.");
            }
            
            discoveryStatus.textContent = `⏳ Verifying and filtering ${unverifiedCompetitors.length} competitors through backend validation layer...`;

            // STEP 2: Verify URLs via Backend API (Filters out dead links/fakes)
            let verifiedCompetitors = [];
            
            const apiRes = await fetch('http://127.0.0.1:8000/api/verify-competitors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ competitors: unverifiedCompetitors })
            });

            if (apiRes.ok) {
                const verificationResponse = await apiRes.json();
                verifiedCompetitors = verificationResponse.verified || [];
            } else {
                throw new Error("Backend verification API failed.");
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
            discoveryStatus.textContent = `❌ Discovery failed: ${e.message}`;
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
