const ROVCopilotCharts = (() => {
    let pieContainer = null;
    let barContainer = null;
    let lastSummary = null;

    const threatColors = {
        red: '#ef4444',
        yellow: '#eab308',
        green: '#22c55e',
    };

    const threatLabels = {
        red: 'Red',
        yellow: 'Yellow',
        green: 'Green',
    };

    const platformOrder = ['hibernia', 'hebron', 'sea_rose', 'terra_nova'];

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatPlatformName(platformId) {
        return String(platformId)
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    function totalThreats(source) {
        return ['red', 'yellow', 'green']
            .map((key) => Number(source?.[key] || 0))
            .reduce((sum, value) => sum + value, 0);
    }

    function donutGradient(total) {
        if (total <= 0) {
            return 'conic-gradient(rgba(148,163,184,0.2) 0deg 360deg)';
        }

        let start = 0;
        const segments = [];
        ['red', 'yellow', 'green'].forEach((key) => {
            const value = Number(lastSummary?.total?.[key] || 0);
            if (value <= 0) {
                return;
            }

            const end = start + ((value / total) * 360);
            segments.push(`${threatColors[key]} ${start}deg ${end}deg`);
            start = end;
        });

        return `conic-gradient(${segments.join(', ')})`;
    }

    function renderPie() {
        if (!pieContainer) {
            return;
        }

        const totals = lastSummary?.total || {};
        const total = totalThreats(totals);
        const legendItems = ['red', 'yellow', 'green'].map((key) => {
            const value = Number(totals[key] || 0);
            const percent = total > 0 ? Math.round((value / total) * 100) : 0;
            return `
                <div class="chart-legend-item">
                    <div class="chart-legend-label">
                        <span class="chart-swatch" style="background:${threatColors[key]}"></span>
                        <span>${threatLabels[key]}</span>
                    </div>
                    <div class="chart-stat">${value} (${percent}%)</div>
                </div>
            `;
        }).join('');

        pieContainer.innerHTML = `
            <div class="chart-donut-layout">
                <div class="chart-donut-wrap">
                    <div class="chart-donut" style="background:${donutGradient(total)}"></div>
                    <div class="chart-donut-hole">
                        <div>
                            <div class="chart-donut-total">${total}</div>
                            <span class="chart-donut-label">Total Threats</span>
                        </div>
                    </div>
                </div>
                <div class="chart-legend" role="list" aria-label="Threat distribution legend">
                    ${legendItems}
                </div>
            </div>
        `;
    }

    function renderBar() {
        if (!barContainer) {
            return;
        }

        const perPlatform = lastSummary?.per_platform || {};
        const rows = platformOrder.map((platformId) => {
            const entry = perPlatform[platformId] || {};
            const name = entry.name || formatPlatformName(platformId);
            const total = totalThreats(entry);

            const segments = total > 0
                ? ['red', 'yellow', 'green'].map((key) => {
                    const value = Number(entry[key] || 0);
                    if (value <= 0) {
                        return '';
                    }

                    const width = ((value / total) * 100).toFixed(2);
                    return `<span class="chart-stack-segment ${key}" style="width:${width}%"></span>`;
                }).join('')
                : '';

            return `
                <div class="chart-stack-row">
                    <div class="chart-stack-head">
                        <div class="chart-stack-name">${escapeHtml(name)}</div>
                        <div class="chart-stack-meta">
                            <span class="chart-mini-badge red">R ${Number(entry.red || 0)}</span>
                            <span class="chart-mini-badge yellow">Y ${Number(entry.yellow || 0)}</span>
                            <span class="chart-mini-badge green">G ${Number(entry.green || 0)}</span>
                            <span class="chart-stack-total">${total} total</span>
                        </div>
                    </div>
                    <div class="chart-stack-track${total === 0 ? ' is-empty' : ''}">
                        ${segments}
                    </div>
                </div>
            `;
        }).join('');

        barContainer.innerHTML = `<div class="chart-stack">${rows}</div>`;
    }

    function init() {
        pieContainer = document.getElementById('chart-pie');
        barContainer = document.getElementById('chart-bar');
        renderPie();
        renderBar();
    }

    function update(summary) {
        lastSummary = summary || null;
        renderPie();
        renderBar();
    }

    function refresh() {
        renderPie();
        renderBar();
    }

    return { init, update, refresh };
})();
