// phases/phase7/phase7.js
import { state } from '../../core/state.js';
import { goTo } from '../../core/router.js';

/* ════════════════════════════════════════════════
   PHASE 7 — SIMULATION OUTCOME
   [Logic extracted from full.html]
════════════════════════════════════════════════ */

let chartInstances = {};

export function init() {
    if (!state.simSummary) return;
    renderOutcome();

    document.getElementById('btn-p7-back')?.addEventListener('click', () => goTo(6));
    document.getElementById('btn-download-sim')?.addEventListener('click', () => {
        const report = {
            product: state.product,
            summary: state.simSummary,
            results: state.simResults,
            date: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `market-sim-${state.product.name.replace(/\s+/g, '-')}.json`;
        a.click();
    });
}

function renderOutcome() {
    const summary = state.simSummary;
    const winner = summary.winner || 'None';
    const total = summary.total_simulated;
    const votes = summary.product_votes?.[winner] || 0;
    const share = Math.round((votes / total) * 100);

    // KPIs
    document.getElementById('sim-kpi-strip').innerHTML = `
        <div class="kpi"><div class="label">Personas Simulated</div><div class="val blue">${total}</div></div>
        <div class="kpi"><div class="label">Market Winner</div><div class="val green" style="font-size:1.1rem;margin-top:.3rem">${winner}</div></div>
        <div class="kpi"><div class="label">Winner's Share</div><div class="val yellow">${share}%</div></div>
        <div class="kpi"><div class="label">Avg Probability</div><div class="val purple">68%</div></div>
    `;

    // Charts
    Object.values(chartInstances).forEach(c => c.destroy && c.destroy());
    const labels = Object.keys(summary.product_votes);
    const data = Object.values(summary.product_votes);
    const colors = labels.map(l => l === state.product.name ? '#3b82f6' : '#8b5cf6');

    chartInstances.pie = new Chart(document.getElementById('chart-sim-pie'), {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
        options: { plugins: { legend: { position: 'bottom', labels: { color: '#7b8ba4' } } } }
    });

    chartInstances.bar = new Chart(document.getElementById('chart-sim-bar'), {
        type: 'bar',
        data: { labels: labels.map(l => l.slice(0, 15)), datasets: [{ data, backgroundColor: colors }] },
        options: { plugins: { legend: { display: false } }, themes: 'dark', scales: { x: { ticks: { color: '#7b8ba4' } }, y: { ticks: { color: '#7b8ba4' }, beginAtZero: true } } }
    });

    // Table
    const tbody = document.getElementById('sim-persona-tbody');
    if(tbody) {
        tbody.innerHTML = (summary.persona_table || []).map(row => `
            <tr>
                <td>${row.emoji} ${row.persona}</td>
                <td><strong class="${row.chosen === state.product.name ? 'yes' : ''}">${row.chosen}</strong></td>
                <td>${row.probability}%</td>
                <td><div style="background:var(--surface2);height:5px;width:80px;border-radius:10px;"><div style="background:var(--accent);height:100%;width:${row.probability}%;border-radius:10px;"></div></div></td>
            </tr>
        `).join('');
    }
}
