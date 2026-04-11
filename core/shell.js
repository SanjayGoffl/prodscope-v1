// core/shell.js
import { state, updateState } from './state.js';
import { callLLM, activeLLM, activeProviderKey } from './ai.js';
import { goTo } from './router.js';

/* ════════════════════════════════════════════════
   TOAST HELPER
   [Used by: All Phases for notifications]
════════════════════════════════════════════════ */
export function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
}
window.showToast = showToast;

/* ════════════════════════════════════════════════
   HISTORY ENGINE
   [Global component]
════════════════════════════════════════════════ */
const HISTORY_KEY = 'ps_history';

export function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
    catch { return []; }
}

export function saveToHistory() {
    if (!state.analysisData) return;
    const scans = loadHistory();
    const entry = {
        id: Date.now().toString(36),
        timestamp: new Date().toISOString(),
        product: { ...state.product, features: [...state.product.features] },
        competitors: state.competitors.map(c => ({ ...c })),
        analysisData: JSON.parse(JSON.stringify(state.analysisData))
    };
    scans.unshift(entry);
    if (scans.length > 20) scans.pop(); 
    localStorage.setItem(HISTORY_KEY, JSON.stringify(scans));
    updateHistoryBadges();
    renderHistoryDrawer();
    renderChatCtxList();
    showToast(`✅ Saved "${entry.product.name}" to history`);
}
window.saveToHistory = saveToHistory;

function updateHistoryBadges() {
    const n = loadHistory().length;
    const badge = document.getElementById('fab-badge');
    const navBadge = document.getElementById('hist-nav-badge');
    const countBadge = document.getElementById('hist-count-badge');
    if(badge) {
        badge.textContent = n;
        badge.classList.toggle('hidden', n === 0);
    }
    if(navBadge) {
        navBadge.textContent = n;
        navBadge.classList.toggle('hidden', n === 0);
    }
    if (countBadge) countBadge.textContent = `${n} scan${n !== 1 ? 's' : ''}`;
}

function renderHistoryDrawer() {
    const scans = loadHistory();
    const list = document.getElementById('history-list');
    if (!list) return;
    if (scans.length === 0) {
        list.innerHTML = `<div class="hist-empty"><i class="fa-solid fa-box-open" style="font-size:2rem;margin-bottom:.5rem;display:block;"></i>No saved scans yet.<br>Complete an analysis to save it here.</div>`;
        return;
    }
    list.innerHTML = scans.map(s => {
        const dt = new Date(s.timestamp);
        const dateStr = dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const compCount = s.competitors.length;
        const featCount = s.analysisData?.features?.length || 0;
        return `
            <div class="hist-card" id="hc-${s.id}">
                <button class="hist-del" onclick="deleteHistory('${s.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                <div class="h-name"><i class="fa-solid fa-box" style="color:var(--accent);margin-right:.35rem;"></i>${s.product.name}</div>
                <div class="h-meta">
                    <span><i class="fa-solid fa-calendar-days"></i> ${dateStr}</span>
                    <span><i class="fa-solid fa-users"></i> ${compCount} competitors</span>
                    <span><i class="fa-solid fa-list-check"></i> ${featCount} features</span>
                    ${s.product.price ? `<span><i class="fa-solid fa-tag"></i> $${s.product.price}</span>` : ''}
                </div>
                <div class="h-actions">
                    <button class="btn btn-outline btn-sm" onclick="loadScanIntoChat('${s.id}')"><i class="fa-solid fa-comments"></i> Chat</button>
                    <button class="btn btn-secondary btn-sm" onclick="exportScan('${s.id}')"><i class="fa-solid fa-download"></i> Export</button>
                </div>
            </div>`;
    }).join('');
}

window.deleteHistory = (id) => {
    const scans = loadHistory().filter(s => s.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(scans));
    updateHistoryBadges();
    renderHistoryDrawer();
    renderChatCtxList();
};

window.loadScanIntoChat = (id) => {
    document.querySelectorAll('.ctx-chk').forEach(cb => {
        cb.checked = cb.dataset.id === id;
    });
    closeDrawer();
    openChat();
};

window.exportScan = (id) => {
    const scan = loadHistory().find(s => s.id === id);
    if (!scan) return;
    const { features, matrix } = scan.analysisData;
    let txt = `ProductScope Export\nProduct: ${scan.product.name}\nPrice: $${scan.product.price}\n${scan.product.desc}\nDate: ${scan.timestamp}\n\nFEATURE MATRIX\n`;
    txt += ['Feature', ...matrix.map(p => p.name)].join('\t') + '\n';
    features.forEach((f, fi) => { txt += [f.name, ...matrix.map(p => p.features[fi])].join('\t') + '\n'; });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = `scan-${scan.product.name.replace(/\s+/g, '-')}-${scan.id}.txt`; a.click();
};

function openDrawer() {
    renderHistoryDrawer();
    document.getElementById('history-drawer').classList.add('open');
    document.getElementById('overlay').classList.add('show');
}
function closeDrawer() {
    document.getElementById('history-drawer').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
}

/* ════════════════════════════════════════════════
   CHAT ENGINE
   [Global component]
════════════════════════════════════════════════ */
let chatMessages = [];

function renderChatCtxList() {
    const scans = loadHistory();
    const list = document.getElementById('ctx-list');
    if (!list) return;
    if (scans.length === 0) {
        list.innerHTML = `<div style="color:var(--text-secondary);font-size:.76rem;">No history yet. Run an analysis first.</div>`;
        return;
    }
    list.innerHTML = scans.map(s => {
        const dt = new Date(s.timestamp).toLocaleDateString();
        return `
            <label class="ctx-item">
                <input type="checkbox" class="ctx-chk" data-id="${s.id}" checked />
                <span>${s.product.name} <span style="color:var(--text-secondary);">(${dt})</span></span>
            </label>`;
    }).join('');
}

function getSelectedScans() {
    const checks = document.querySelectorAll('.ctx-chk:checked');
    const allScans = loadHistory();
    const ids = new Set([...checks].map(c => c.dataset.id));
    return allScans.filter(s => ids.has(s.id));
}

function buildSystemPrompt(scans) {
    if (scans.length === 0) return 'You are a helpful market analyst assistant. No scan data has been provided.';
    let ctx = `You are an expert market analyst assistant. The user is asking about their product analysis results. Answer concisely and factually — no recommendations, just neutral insights based on the data.\n\nANALYSIS DATA: \n`;
    scans.forEach((s, idx) => {
        ctx += `\n--- SCAN ${idx + 1}: "${s.product.name}" (${new Date(s.timestamp).toLocaleDateString()}) ---\n`;
        ctx += `Product: ${s.product.name} \nPrice: $${s.product.price} \nDescription: ${s.product.desc} \n`;
        ctx += `Key Features: ${s.product.features.join(', ')} \n`;
        ctx += `Competitors (${s.competitors.length}): ${s.competitors.map(c => `${c.name} ($${c.price || '?'})`).join(', ')} \n`;
        if (s.analysisData?.features) {
            ctx += `Features analyzed: ${s.analysisData.features.map(f => f.name).join(', ')} \n`;
            if (s.analysisData?.matrix) {
                s.analysisData.matrix.forEach(prod => {
                    const yesCount = (prod.features || []).filter(f => f === 'yes').length;
                    ctx += `  ${prod.name}: ${yesCount}/${s.analysisData.features.length} features\n`;
                });
            }
        }
    });
    ctx += `\nAnswer the user's question based strictly on this data.`;
    return ctx;
}

function appendChatMsg(role, text, model = '') {
    chatMessages.push({ role, text, model });
    const box = document.getElementById('chat-messages');
    if (!box) return;
    const empty = box.querySelector('.chat-empty');
    if (empty) empty.remove();
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    if (role === 'ai') {
        div.innerHTML = `<div class="msg-model"><i class="fa-solid fa-robot"></i> ${model || activeLLM}</div>${text.replace(/\n/g, '<br>')}`;
    } else {
        div.textContent = text;
    }
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const userMsg = input.value.trim();
    if (!userMsg) return;

    const selectedScans = getSelectedScans();
    if (selectedScans.length === 0) {
        appendChatMsg('ai', '⚠️ Please select at least one scan from the context list above.', 'System');
        return;
    }

    input.value = '';
    input.style.height = 'auto';
    document.getElementById('chat-send').disabled = true;
    appendChatMsg('user', userMsg);

    const systemPrompt = buildSystemPrompt(selectedScans);
    const historyText = chatMessages.slice(-8)
        .filter(m => m.role !== 'user' || m.text !== userMsg)
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
        .join('\n');
    const fullPrompt = `${systemPrompt}\n\nCONVERSATION:\n${historyText}\nUser: ${userMsg}\nAssistant:`;

    const box = document.getElementById('chat-messages');
    const typing = document.createElement('div');
    typing.className = 'msg ai'; typing.id = 'typing-ind';
    typing.innerHTML = `<div class="msg-model"><i class="fa-solid fa-robot"></i> Thinking...</div><i class="fa-solid fa-circle-notch fa-spin"></i>`;
    box.appendChild(typing); box.scrollTop = box.scrollHeight;

    try {
        const reply = await callLLM(fullPrompt, 'groq_general', 2048);
        document.getElementById('chat-model-badge').textContent = activeLLM;
        typing.remove();
        appendChatMsg('ai', reply.trim(), activeLLM);
    } catch (err) {
        typing.remove();
        appendChatMsg('ai', `❌ Error: ${err.message}`, 'System');
    } finally {
        document.getElementById('chat-send').disabled = false;
        input.focus();
    }
}

function openChat() {
    renderChatCtxList();
    document.getElementById('chat-panel').classList.add('open');
}
function closeChat() {
    document.getElementById('chat-panel').classList.remove('open');
}

/* ════════════════════════════════════════════════
   SHELL INIT
════════════════════════════════════════════════ */
export function initShell() {
    document.getElementById('btn-history')?.addEventListener('click', openDrawer);
    document.getElementById('btn-close-drawer')?.addEventListener('click', closeDrawer);
    document.getElementById('overlay')?.addEventListener('click', () => { closeDrawer(); closeChat(); });
    
    document.getElementById('chat-fab')?.addEventListener('click', () => {
        const panel = document.getElementById('chat-panel');
        panel.classList.contains('open') ? closeChat() : openChat();
    });
    document.getElementById('btn-close-chat')?.addEventListener('click', closeChat);
    document.getElementById('chat-send')?.addEventListener('click', sendChatMessage);
    document.getElementById('chat-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
    });
    document.getElementById('chat-input')?.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 90) + 'px';
    });

    document.getElementById('btn-reset-all')?.addEventListener('click', () => {
        updateState({
            product: { name: '', price: 0, desc: '', features: [] },
            competitors: [],
            analysisData: null
        });
        goTo(1);
    });

    updateHistoryBadges();
    renderChatCtxList();
}

initShell();
