// phases/phase5/phase5.js
import { state } from '../../core/state.js';
import { goTo } from '../../core/router.js';
import { saveToHistory, showToast } from '../../core/shell.js';

/* ════════════════════════════════════════════════
   PHASE 5 — ANALYSIS RESULTS
   [Logic extracted from full.html]
════════════════════════════════════════════════ */

let chartInstances = {};

export function init() {
    if (!state.analysisData) return;
    
    renderKPIs();
    renderCharts();
    renderSummary();
    renderOverviewTable();

    // Automatically save to history when reaching results
    saveToHistory();

    document.getElementById('btn-p5-back')?.addEventListener('click', () => goTo(4));
    document.getElementById('btn-p5-simulate')?.addEventListener('click', () => {
        goTo(6);
    });
    document.getElementById('btn-new-analysis')?.addEventListener('click', () => location.reload());
    
    document.getElementById('btn-export')?.addEventListener('click', () => {
        const { features, matrix } = state.analysisData;
        let txt = `ProductScope Report — ${state.product.name}\n${'='.repeat(50)}\n\n`;
        txt += `Price: $${state.product.price}\nDescription: ${state.product.desc}\n\nFEATURE MATRIX\n`;
        txt += ['Feature', ...matrix.map(p => p.name)].join('\t') + '\n';
        features.forEach((f, fi) => { txt += [f.name, ...matrix.map(p => p.features[fi])].join('\t') + '\n'; });
        const blob = new Blob([txt], { type: 'text/plain' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `productscope-${state.product.name.replace(/\s+/g, '-')}.txt`;
        a.click();
    });
}

function renderKPIs() {
    const { features, matrix } = state.analysisData;
    const ours = matrix[0];
    const comps = matrix.slice(1);
    
    const ourCount = ours.features.filter(f => f !== 'no').length;
    const avgComp = comps.length ? comps.reduce((s, c) => s + c.features.filter(f => f !== 'no').length, 0) / comps.length : 0;
    const coverage = Math.round((ourCount / features.length) * 100);
    
    document.getElementById('kpi-strip').innerHTML = `
        <div class="kpi"><div class="label">Feature Coverage</div><div class="val blue">${coverage}%</div></div>
        <div class="kpi"><div class="label">Features Available</div><div class="val purple">${ourCount} / ${features.length}</div></div>
        <div class="kpi"><div class="label">Avg Competitor Features</div><div class="val yellow">${avgComp.toFixed(1)}</div></div>
        <div class="kpi"><div class="label">Market Position</div><div class="val green">${state.product.price > 0 ? 'Analyzed' : 'Free'}</div></div>
    `;
}

function renderCharts() {
    const { matrix } = state.analysisData;
    Object.values(chartInstances).forEach(c => c.destroy && c.destroy());

    // Scatter
    const ctxScatter = document.getElementById('chart-scatter')?.getContext('2d');
    if(ctxScatter) {
        chartInstances.scatter = new Chart(ctxScatter, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Products',
                    data: matrix.map(p => ({ x: p.features.filter(f => f !== 'no').length, y: p.price || 0, label: p.name })),
                    backgroundColor: matrix.map(p => p.isOurs ? '#3b82f6' : '#8b5cf6'),
                    pointRadius: 8
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    x: { title: { display: true, text: 'Feature Count', color: '#7b8ba4' }, ticks: { color: '#7b8ba4' } },
                    y: { title: { display: true, text: 'Price (USD)', color: '#7b8ba4' }, ticks: { color: '#7b8ba4' } }
                }
            }
        });
    }

    // Pricing Dist
    const ctxPrice = document.getElementById('chart-price-dist')?.getContext('2d');
    if(ctxPrice) {
        chartInstances.price = new Chart(ctxPrice, {
            type: 'bar',
            data: {
                labels: matrix.map(p => p.name.slice(0, 12)),
                datasets: [{ data: matrix.map(p => p.price || 0), backgroundColor: matrix.map(p => p.isOurs ? '#3b82f6' : '#94a3b8') }]
            },
            options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#7b8ba4' } }, y: { ticks: { color: '#7b8ba4' } } } }
        });
    }
}

function renderSummary() {
    const { features, matrix } = state.analysisData;
    const comps = matrix.slice(1);
    const summary = document.getElementById('summary-list');
    if(!summary) return;

    const list = [
        `Analysis includes ${comps.length} competitors and ${features.length} feature areas.`,
        `Your product "${state.product.name}" covers ${Math.round((matrix[0].features.filter(f => f !== 'no').length / features.length) * 100)}% of the identified feature space.`,
        comps.length > 0 ? `Competitor prices range from $${Math.min(...comps.map(c => c.price || 0))} to $${Math.max(...comps.map(c => c.price || 0))}.` : 'No competitor pricing found.'
    ];

    summary.innerHTML = list.map(item => `<li>${item}</li>`).join('');
}

function renderOverviewTable() {
    const { features, matrix } = state.analysisData;
    const tbody = document.getElementById('overview-body');
    if(!tbody) return;

    tbody.innerHTML = matrix.slice(1).map(c => {
        const cnt = c.features.filter(f => f !== 'no').length;
        const cov = Math.round((cnt / features.length) * 100);
        const diff = (c.price || 0) - state.product.price;
        const diffStr = diff > 0 ? `<span class="yes">+$${diff} more</span>` : diff < 0 ? `<span class="no">-$${Math.abs(diff)} less</span>` : '<span class="badge badge-yellow">Same</span>';
        return `<tr><td><strong>${c.name}</strong></td><td>${c.price ? '$' + c.price : '—'}</td><td>${cnt}</td><td>${cov}%</td><td>${diffStr}</td></tr>`;
    }).join('');
}
