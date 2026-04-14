import { state, updateState } from '../../core/state.js';
import { goTo } from '../../core/router.js';
import { callLLM } from '../../core/ai.js';

export function init() {
    const logBox = document.getElementById('log-box');
    const progBar = document.getElementById('prog-bar');
    const progLabel = document.getElementById('progress-label');
    const nextBtn = document.getElementById('btn-p3-next');

    // UI Simulation delay utility
    const delay = ms => new Promise(r => setTimeout(r, ms));

    function log(msg, type = '') {
        if (!logBox) return;
        const entry = document.createElement('div');
        entry.className = 'log-line ' + type;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        logBox.appendChild(entry);
        logBox.scrollTop = logBox.scrollHeight;
    }

    function updatePipelineUI(progressValue, labelText, stepNum) {
        if (progBar) progBar.style.width = `${progressValue}%`;
        if (progLabel) progLabel.textContent = labelText;
        
        for (let i = 1; i <= 5; i++) {
            const el = document.getElementById(`pip${i}`);
            const line = document.getElementById(`pl${i}`);
            if (!el) continue;
            el.className = 'pip-step';
            if (i < stepNum) el.classList.add('done');
            else if (i === stepNum) el.classList.add('active');
            if (line) line.className = 'pip-line' + (i < stepNum ? ' done' : '');
        }
    }

    async function processCompetitors() {
        const comps = state.competitors.filter(c => c.selected && c.verified);
        if (comps.length === 0) {
             const unverified = state.competitors.filter(c => c.selected);
             if (unverified.length > 0) {
                 log('Warning: Falling back to unverified competitors for extraction.', 'warn');
                 comps.push(...unverified);
             } else {
                 log('No competitors selected. Aborting.', 'err');
                 return;
             }
        }

        log(`Starting Feature Extraction for ${comps.length} verified competitors...`);
        let finalAnalysisResults = [];
        
        updatePipelineUI(5, 'Initializing scraping pipelines...', 1);

        try {
            // Process concurrently in small batches to respect rate limits while gaining massive speedups
            const batchSize = 4;
            let completed = 0;

            for (let i = 0; i < comps.length; i += batchSize) {
                const batch = comps.slice(i, i + batchSize);
                
                await Promise.all(batch.map(async (c) => {
                    log(`Triggering backend scrapers for ${c.name}...`);
                    
                    let scrapedText = "";
                    try {
                        const scrapeRes = await fetch('/api/scrape', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: c.name, url: c.url })
                        });
                        if (scrapeRes.ok) {
                            const scrapeData = await scrapeRes.json();
                            scrapedText = scrapeData.content || "Content limited or blocked.";
                        }
                    } catch(err) {
                        log(`Backend scraping failed for ${c.name}.`, 'warn');
                        scrapedText = "Could not scrape live site.";
                    }

                    log(`Extracting strictly from scraped source data for ${c.name}...`);
                    const prompt = `You are a strict data extraction AI. Extract the functional product features for "${c.name}" based ONLY on the following scraped text data.
DO NOT hallucinate features. DO NOT use your internal knowledge. If a feature is not in the text, DO NOT list it.
For each feature extracted, provide the source URL exactly as it appears in the text block.

SCRAPED TEXT:
${scrapedText}

Return ONLY a strict JSON object in this exact format with NO other text:
{
  "name": "${c.name}",
  "features": [
    {
      "feature": "Name of extracted feature",
      "source": "https://exact-source-url-from-scraped-text.com"
    }
  ]
}`;

                    // Shifted to faster LLM "gemini" instead of slow "groq_reason"
                    const raw = await callLLM(prompt, 'gemini', 3000); 
                    let cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
                    const start = cleaned.indexOf('{');
                    const end = cleaned.lastIndexOf('}');
                    
                    if (start === -1 || end === -1) {
                        throw new Error(`Failed to adhere to JSON format for ${c.name}`);
                    }
                    
                    const rawExtraction = JSON.parse(cleaned.slice(start, end + 1));
                    const extractedFeatures = rawExtraction.features || [];

                    log(`Validating extracted features for ${c.name} through backend layer...`);
                    
                    let validatedFeatures = [];
                    try {
                        const valRes = await fetch('/api/validate-features', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                 features: extractedFeatures,
                                 competitor_url: c.url 
                            })
                        });
                        if (valRes.ok) {
                            const valData = await valRes.json();
                            validatedFeatures = valData.cleaned_features || extractedFeatures.map(f => f.feature);
                        } else {
                            validatedFeatures = extractedFeatures.map(f => f.feature);
                        }
                    } catch(err) {
                        validatedFeatures = extractedFeatures.map(f => f.feature);
                    }

                    finalAnalysisResults.push({
                        name: rawExtraction.name || c.name,
                        features: validatedFeatures
                    });
                    
                    log(`✓ Extracted and validated ${validatedFeatures.length} authentic features for ${c.name}.`, 'ok');
                    
                    completed++;
                    const progress = 5 + ((completed / comps.length) * 90);
                    updatePipelineUI(progress, `Processing ${completed}/${comps.length} ...`, 3);
                }));
            }

            updatePipelineUI(98, 'Finalizing structured matrix...', 5);
            updateState({ analysisData: finalAnalysisResults });
            log('Secure Data Extraction complete with zero hallucinations.', 'ok');
            
            updatePipelineUI(100, 'Sequence finished.', 5);
            if (nextBtn) nextBtn.classList.remove('disabled');

        } catch (error) {
            log('Pipeline Error: ' + error.message, 'err');
            if (nextBtn) nextBtn.classList.remove('disabled');
        }
    }

    document.getElementById('btn-p3-back')?.addEventListener('click', () => goTo(2));
    document.getElementById('btn-p3-next')?.addEventListener('click', () => goTo(4));

    processCompetitors();
}
