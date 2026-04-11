// phases/phase4/phase4.js
import { state } from '../../core/state.js';
import { goTo } from '../../core/router.js';

/* ════════════════════════════════════════════════
   PHASE 4 — MATRIX VISUALIZATION
   [Logic extracted from full.html]
════════════════════════════════════════════════ */

let chartInstances = {};

export function init() {
    if (!state.analysisData) return;
    const { features, matrix } = state.analysisData;

    renderMatrix(features, matrix);
    renderCharts(features, matrix);

    document.getElementById('btn-p4-back')?.addEventListener('click', () => goTo(3));
    document.getElementById('btn-p4-next')?.addEventListener('click', () => {
        goTo(5);
    });
}

function renderMatrix(features, matrix) {
    const head = document.getElementById('matrix-header');
    const body = document.getElementById('matrix-body');
    if(!head || !body) return;

    // Header
    head.innerHTML = `<th>Category</th><th>Feature</th>` + 
        matrix.map(p => `<th class="${p.isOurs ? 'col-ours' : ''}">${p.isOurs ? '⭐ ' : ''}${p.name}</th>`).join('');

    // Body
    body.innerHTML = features.map((f, fi) => {
        const cells = matrix.map(p => {
            const v = p.features[fi];
            const cls = v === 'yes' ? 'yes' : v === 'partial' ? 'partial' : 'no';
            const icon = v === 'yes' ? '✓' : v === 'partial' ? '≈' : '✗';
            return `<td class="${p.isOurs ? 'col-ours' : ''} ${cls}">${icon}</td>`;
        }).join('');
        return `<tr><td><span class="badge badge-blue">${f.category}</span></td><td>${f.name}</td>${cells}</tr>`;
    }).join('');
}

function renderCharts(features, matrix) {
    // Destroy previous if any
    Object.values(chartInstances).forEach(c => c.destroy && c.destroy());
    chartInstances = {};

    const counts = matrix.map(p => p.features.filter(v => v === 'yes' || v === 'partial').length);
    const colors = matrix.map(p => p.isOurs ? '#3b82f6' : '#8b5cf6');

    // Chart 1: Bar
    const ctxBar = document.getElementById('chart-bar')?.getContext('2d');
    if(ctxBar) {
        chartInstances.bar = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: matrix.map(p => p.name.length > 15 ? p.name.slice(0, 15) + '…' : p.name),
                datasets: [{ label: 'Features Available', data: counts, backgroundColor: colors, borderRadius: 5 }]
            },
            options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#7b8ba4' } }, y: { ticks: { color: '#7b8ba4' }, beginAtZero: true } } }
        });
    }

    // Chart 2: Freq (Doughnut)
    const ctxFreq = document.getElementById('chart-freq')?.getContext('2d');
    if(ctxFreq) {
        const freqs = features.map((_, fi) => matrix.filter(p => p.features[fi] !== 'no').length);
        chartInstances.freq = new Chart(ctxFreq, {
            type: 'doughnut',
            data: {
                labels: features.map(f => f.name.slice(0, 15)),
                datasets: [{ data: freqs, backgroundColor: ['#3b82f6', '#8b5cf6', '#22c55e', '#eab308', '#ef4444', '#06b6d4'] }]
            },
            options: { plugins: { legend: { labels: { color: '#7b8ba4', boxWidth: 12, font: { size: 10 } } } } }
        });
    }

    // Chart 3: Coverage (Horizontal Bar)
    const ctxCov = document.getElementById('chart-coverage')?.getContext('2d');
    if(ctxCov) {
        const categories = [...new Set(features.map(f => f.category))];
        const datasets = matrix.map(p => {
            return {
                label: p.name,
                data: categories.map(cat => {
                    const catFeats = features.filter(f => f.category === cat);
                    const catIndices = features.map((f, i) => f.category === cat ? i : -1).filter(i => i !== -1);
                    const yes = catIndices.filter(i => p.features[i] !== 'no').length;
                    return Math.round((yes / catFeats.length) * 100);
                }),
                backgroundColor: p.isOurs ? '#3b82f6' : `hsla(${Math.random()*360}, 60%, 60%, 1)`,
                borderRadius: 4
            };
        });

        chartInstances.cov = new Chart(ctxCov, {
            type: 'bar',
            data: { labels: categories, datasets },
            options: { indexAxis: 'y', scales: { x: { max: 100, ticks: { color: '#7b8ba4' } }, y: { ticks: { color: '#7b8ba4' } } } }
        });
    }
}
