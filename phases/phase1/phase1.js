// phases/phase1/phase1.js
import { state, updateState } from '../../core/state.js';
import { goTo } from '../../core/router.js';

/* ════════════════════════════════════════════════
   PHASE 1 — PRODUCT SETUP (UPGRADED)
════════════════════════════════════════════════ */

export function init() {
    // DOM Elements - Identity
    const pName = document.getElementById('p-name');
    const pTagline = document.getElementById('p-tagline');
    const pCategory = document.getElementById('p-category');
    const pCategoryCustom = document.getElementById('p-category-custom');
    const pAudience = document.getElementById('p-audience');
    const pDescription = document.getElementById('p-description');

    // DOM Elements - Context
    const pMarket = document.getElementById('p-market');
    const pSegment = document.getElementById('p-segment');

    // DOM Elements - Pricing
    const priceToggles = document.querySelectorAll('.btn-toggle');
    const pricingFields = document.getElementById('pricing-fields');
    const pBilling = document.getElementById('p-billing');
    const pAmount = document.getElementById('p-amount');
    const pCurrLabel = document.getElementById('p-currency-label');
    const pCurrSymbol = document.getElementById('p-currency-symbol');
    const pCurrDisplay = document.getElementById('p-currency-display');

    // DOM Elements - Differentiation
    const pDiff = document.getElementById('p-differentiator');

    // DOM Elements - Features
    const fName = document.getElementById('f-name');
    const fCategory = document.getElementById('f-category');
    const fPriority = document.getElementById('f-priority');
    const btnAddFeat = document.getElementById('btn-add-feat');
    const featChips = document.getElementById('feat-chips');

    // Restore existing state
    if (state.product.name) {
        pName.value = state.product.name;
        pTagline.value = state.product.tagline;
        pCategory.value = state.product.category;
        pAudience.value = state.product.audience;
        pDescription.value = state.product.description;
        pMarket.value = state.product.market;
        pSegment.value = state.product.segment;
        pBilling.value = state.product.pricing.billing;
        pAmount.value = state.product.pricing.amount;
        pDiff.value = state.product.differentiator;

        // Set price type toggle
        priceToggles.forEach(btn => {
            if (btn.dataset.value === state.product.pricing.type) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Handle custom category visibility
        if (state.product.category && !Array.from(pCategory.options).some(o => o.value === state.product.category)) {
            pCategory.value = 'Other';
            pCategoryCustom.value = state.product.category;
            pCategoryCustom.classList.remove('hidden');
        }

        togglePricingUI(state.product.pricing.type);
    }
    updateCurrencyUI(pMarket.value);
    renderChips();

    // ⚡ Logic: Currency Auto-Switch
    pMarket.addEventListener('change', (e) => {
        updateCurrencyUI(e.target.value);
    });

    // ⚡ Logic: Category Other Toggle
    pCategory.addEventListener('change', (e) => {
        if (e.target.value === 'Other') {
            pCategoryCustom.classList.remove('hidden');
            pCategoryCustom.focus();
        } else {
            pCategoryCustom.classList.add('hidden');
            pCategoryCustom.value = '';
        }
    });

    function updateCurrencyUI(market) {
        if (market === 'India') {
            pCurrLabel.textContent = 'INR';
            pCurrSymbol.textContent = '₹';
            pCurrDisplay.value = 'INR (₹)';
        } else {
            pCurrLabel.textContent = 'USD';
            pCurrSymbol.textContent = '$';
            pCurrDisplay.value = 'USD ($)';
        }
    }

    // ⚡ Logic: Conditional Pricing UI
    priceToggles.forEach(btn => {
        btn.addEventListener('click', () => {
            priceToggles.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            togglePricingUI(btn.dataset.value);
        });
    });

    function togglePricingUI(type) {
        if (type === 'free') {
            pricingFields.style.opacity = '0.3';
            pricingFields.style.pointerEvents = 'none';
        } else {
            pricingFields.style.opacity = '1';
            pricingFields.style.pointerEvents = 'auto';
        }
    }

    // ⚡ Logic: Feature Management
    function addFeature() {
        const name = fName.value.trim();
        const cat = fCategory.value;
        const prio = fPriority.value;

        if (!name) return;
        if (state.product.features.find(f => f.name === name)) return;

        state.product.features.push({ name, category: cat, priority: prio });
        renderChips();
        fName.value = '';
        fName.focus();
    }

    window.removeFeature = (index) => {
        state.product.features.splice(index, 1);
        renderChips();
    };

    function renderChips() {
        if (!featChips) return;
        featChips.innerHTML = state.product.features.map((f, i) => `
            <div class="feat-chip">
                <div class="feat-chip-main">
                    <span class="feat-chip-name">${f.name}</span>
                    <span class="feat-chip-meta">${f.category} · ${f.priority}</span>
                </div>
                <button class="feat-chip-remove" onclick="removeFeature(${i})">&times;</button>
            </div>
        `).join('');
    }

    btnAddFeat.addEventListener('click', addFeature);
    fName.addEventListener('keydown', e => { if (e.key === 'Enter') addFeature(); });

    // ⚡ Logic: Bulk Extraction
    document.getElementById('btn-extract-feat')?.addEventListener('click', async (e) => {
        const text = document.getElementById('f-bulk-input').value.trim();
        if (!text) return;

        const btn = e.currentTarget;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing...';
        btn.disabled = true;

        const prompt = `Extract a list of distinct features from the text below. 
        Categorize each and assign priority (Must-have, Important, Nice-to-have).
        TEXT: ${text}
        
        Return ONLY valid JSON array: 
        [{"name": "Feature", "category": "Core|Integration|Analytics|Security|Technical", "priority": "Must-have"}]`;

        try {
            const raw = await import('../../core/ai.js').then(m => m.callLLM(prompt, 'groq_fast', 1000));
            const data = JSON.parse(raw.replace(/```json/gi, '').replace(/```/g, '').trim());
            state.product.features = [...state.product.features, ...data];
            renderChips();
            document.getElementById('f-bulk-input').value = '';
            import('../../core/shell.js').then(m => m.showToast(`✅ Extracted ${data.length} features`));
        } catch (err) {
            console.error(err);
            import('../../core/shell.js').then(m => m.showToast('❌ Extraction failed. Check Console.'));
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    // ⚡ Logic: Autofill (AI Driven)
    document.getElementById('btn-autofill')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generating Idea...';
        btn.disabled = true;

        const prompt = `Generate a creative and realistic startup product idea. 
        Return ONLY a JSON object: 
        {
          "name": "Product Name",
          "tagline": "Catchy one-liner",
          "category": "One of [SaaS, E-commerce, Fintech, EdTech, HealthTech, Developer Tools, AI/ML]",
          "audience": "Target users (comma separated)",
          "description": "50-word description of value prop",
          "market": "Global",
          "segment": "B2C",
          "amount": 19.99,
          "differentiator": "Unique selling point",
          "features": [
            {"name": "Feature 1", "category": "Core", "priority": "Must-have"},
            {"name": "Feature 2", "category": "Core", "priority": "Must-have"},
            {"name": "Feature 3", "category": "Analytics", "priority": "Important"}
          ]
        }`;

        try {
            const raw = await import('../../core/ai.js').then(m => m.callLLM(prompt, 'groq_fast', 1000));
            const data = JSON.parse(raw.replace(/```json/gi, '').replace(/```/g, '').trim());
            
            pName.value = data.name;
            pTagline.value = data.tagline;
            pCategory.value = data.category;
            pAudience.value = data.audience;
            pDescription.value = data.description;
            pMarket.value = data.market;
            updateCurrencyUI(data.market);
            pSegment.value = data.segment;
            pAmount.value = data.amount;
            pDiff.value = data.differentiator;
            
            state.product.features = data.features;
            renderChips();
            import('../../core/shell.js').then(m => m.showToast(`✨ Generated idea: ${data.name}`));
        } catch (err) {
            console.error(err);
            import('../../core/shell.js').then(m => m.showToast('❌ AI Generation failed. Using fallback.'));
            // Local fallback logic (optional)
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    // ⚡ Logic: Next Step
    document.getElementById('btn-p1-next').addEventListener('click', () => {
        const type = document.querySelector('.btn-toggle.active').dataset.value;
        
        // Basic Validation
        if (!pName.value.trim() || !pTagline.value.trim() || !pCategory.value || !pDescription.value.trim()) {
            return alert('Please fill in all required product identity fields.');
        }
        if (state.product.features.length < 3) {
            return alert('Please add at least 3 features to build a realistic comparison.');
        }

        // Update State
        const finalCategory = pCategory.value === 'Other' ? pCategoryCustom.value.trim() : pCategory.value;
        
        if (pCategory.value === 'Other' && !finalCategory) {
            return alert('Please specify your custom category.');
        }

        state.product = {
            ...state.product,
            name: pName.value.trim(),
            tagline: pTagline.value.trim(),
            category: finalCategory,
            audience: pAudience.value.trim(),
            description: pDescription.value.trim(),
            market: pMarket.value,
            segment: pSegment.value,
            pricing: {
                type: type,
                billing: pBilling.value,
                amount: parseFloat(pAmount.value) || 0,
                currency: pMarket.value === 'India' ? 'INR' : 'USD'
            },
            differentiator: pDiff.value.trim()
        };

        goTo(2);
    });
}
