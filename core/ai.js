// core/ai.js

// Stores all AI/LLM fallback logic

const KEYS = {
    gemini: '',
    groq: '',
    openrouter: ''
};

// 7-step fallback chain
export const FALLBACK_CHAIN = [
    'gemini', 'groq_reason', 'groq_general',
    'openrouter_trinity', 'openrouter_step', 'groq_fast', 'ollama'
];

export let activeLLM = 'Gemini 2.0 Flash';
export let activeProviderKey = 'gemini';

export const PROVIDERS = {
    gemini: {
        name: 'Gemini 2.0 Flash',
        badge: 'badge-blue',
        call: async (prompt, maxTokens = 4096) => {
            const model = 'gemini-2.0-flash';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEYS.gemini}`;
            const r = await fetch(url, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens } })
            });
            const d = await r.json();
            const t = d?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!t) throw new Error(`Gemini: ${d?.error?.message || 'empty response'}`);
            return t;
        }
    },
    groq_reason: {
        name: 'Groq QwQ-32B',
        badge: 'badge-blue',
        call: async (prompt, maxTokens = 4096) => groqCall('qwen-qwq-32b', prompt, maxTokens)
    },
    groq_general: {
        name: 'Groq Llama-3.3 70B',
        badge: 'badge-blue',
        call: async (prompt, maxTokens = 4096) => groqCall('llama-3.3-70b-versatile', prompt, maxTokens)
    },
    groq_fast: {
        name: 'Groq Llama-3.1 8B',
        badge: 'badge-blue',
        call: async (prompt, maxTokens = 2048) => groqCall('llama-3.1-8b-instant', prompt, maxTokens)
    },
    openrouter_trinity: {
        name: 'OpenRouter Trinity',
        badge: 'badge-blue',
        call: async (prompt, maxTokens = 4096) => openrouterCall('arcee-ai/trinity-large-preview:free', prompt, maxTokens)
    },
    openrouter_step: {
        name: 'OpenRouter StepFlash',
        badge: 'badge-yellow',
        call: async (prompt, maxTokens = 4096) => openrouterCall('stepfun/step-3.5-flash:free', prompt, maxTokens)
    },
    ollama: {
        name: 'Ollama qwen3:8b',
        badge: 'badge-yellow',
        call: async (prompt) => {
            const r = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'qwen3:8b', prompt, stream: false })
            });
            const d = await r.json();
            if (!d?.response) throw new Error('Ollama: empty response');
            return d.response;
        }
    }
};

async function groqCall(model, prompt, maxTokens) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEYS.groq}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0.4 })
    });
    const d = await r.json();
    if (d?.error) throw new Error(`Groq(${model}): ${d.error.message}`);
    const t = d?.choices?.[0]?.message?.content;
    if (!t) throw new Error(`Groq(${model}): empty`);
    return t;
}

async function openrouterCall(model, prompt, maxTokens) {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json', 'Authorization': `Bearer ${KEYS.openrouter}`,
            'HTTP-Referer': 'http://localhost:5500', 'X-Title': 'ProductScope'
        },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens })
    });
    const d = await r.json();
    if (d?.error) throw new Error(`OpenRouter(${model}): ${d.error.message}`);
    const t = d?.choices?.[0]?.message?.content;
    if (!t) throw new Error(`OpenRouter(${model}): empty`);
    return t;
}

// Function to call LLM globally inside the app
export async function callLLM(prompt, preferredKey = null, maxTokens = 4096) {
    const chain = preferredKey
        ? [preferredKey, ...FALLBACK_CHAIN.filter(k => k !== preferredKey)]
        : FALLBACK_CHAIN;

    for (const key of chain) {
        const provider = PROVIDERS[key];
        try {
            console.log(`[LLM] Trying ${provider.name}...`);
            const text = await provider.call(prompt, maxTokens);
            activeLLM = provider.name;
            activeProviderKey = key;
            updateBadgeUI(provider);
            return text;
        } catch (e) {
            console.warn(`[${provider.name}] failed:`, e.message);
        }
    }
    throw new Error('All LLM providers exhausted.');
}

// Ensure keys are loaded dynamically if backend handles it
export async function initAIEnvs() {
    try {
        const res = await fetch('.env');
        const text = await res.text();
        text.split('\n').forEach(line => {
             const parts = line.split('=');
             if (parts.length >= 2) {
                 const key = parts[0].trim();
                 const val = parts.slice(1).join('=').trim().replace(/['"]/g, '');
                 if (key === 'GOOGLE_GEMINI_API_KEY') KEYS.gemini = val;
                 if (key === 'GROQ_API_KEY') KEYS.groq = val;
                 if (key === 'OPEN_ROUTER_API_KEY') KEYS.openrouter = val;
             }
        });
    } catch(e) {
        console.warn('Failed to load local frontend envs (using backend instead)');
    }
}

function updateBadgeUI(provider) {
    const badge = document.getElementById('model-badge');
    if (badge) {
        badge.textContent = provider.name;
        badge.className = `badge ${provider.badge}`;
    }
}

initAIEnvs();
