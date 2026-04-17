const ROVCopilotApp = (() => {
    async function fetchJSON(url) {
        const resp = await fetch(url);
        return resp.json();
    }

    async function loadAll() {
        const [platforms, icebergs, threatData] = await Promise.all([
            fetchJSON('/api/platforms'),
            fetchJSON('/api/icebergs'),
            fetchJSON('/api/threats'),
        ]);

        // Update map
        ROVCopilotMap.update(platforms, icebergs, threatData.results);

        // Update charts
        ROVCopilotCharts.update(threatData.summary);

        // Update summary cards
        updateSummaryCards(threatData.summary.total);

        // Update threat matrix
        updateThreatMatrix(threatData.results);

        // Update iceberg list
        updateIcebergList(icebergs);
    }

    function updateSummaryCards(total) {
        document.getElementById('count-red').textContent = total.red;
        document.getElementById('count-yellow').textContent = total.yellow;
        document.getElementById('count-green').textContent = total.green;
    }

    function threatBadge(level) {
        const styles = {
            red: 'background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3)',
            yellow: 'background:rgba(234,179,8,0.15);color:#eab308;border:1px solid rgba(234,179,8,0.3)',
            green: 'background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3)',
        };
        return `<span style="${styles[level] || ''};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">${level.toUpperCase()}</span>`;
    }

    function updateThreatMatrix(results) {
        const tbody = document.getElementById('threat-matrix-body');
        const platformOrder = ['hibernia', 'sea_rose', 'terra_nova', 'hebron'];

        tbody.innerHTML = results.map(r => {
            const name = r.iceberg.name;
            const cells = platformOrder.map(pid => {
                const pt = r.platform_threats[pid];
                const st = r.subsea_threats[pid];
                return `
                    <td class="py-1.5 px-2 text-center">${threatBadge(pt.level)}</td>
                    <td class="py-1.5 px-2 text-center">${threatBadge(st.level)}</td>
                `;
            }).join('');
            return `<tr class="border-b border-border hover:bg-muted/50 transition-colors">
                <td class="py-1.5 px-3 font-medium text-sm">${name}</td>
                ${cells}
            </tr>`;
        }).join('');
    }

    function updateIcebergList(icebergs) {
        const tbody = document.getElementById('iceberg-list-body');
        tbody.innerHTML = icebergs.map(ib => `
            <tr class="border-b border-border/50 hover:bg-muted/50 transition-colors">
                <td class="py-1.5 px-2 font-medium">${ib.name}${ib.is_example ? ' <span style="color:#64748b;font-size:9px;">EXAMPLE</span>' : ''}</td>
                <td class="py-1.5 px-2 text-right text-muted-foreground">${ib.latitude.toFixed(4)}</td>
                <td class="py-1.5 px-2 text-right text-muted-foreground">${ib.longitude.toFixed(4)}</td>
                <td class="py-1.5 px-2 text-right text-muted-foreground">${ib.heading}°</td>
                <td class="py-1.5 px-2 text-right text-muted-foreground">${ib.keel_depth_m}m</td>
                <td class="py-1.5 px-2 text-right">
                    ${!ib.is_example ? `<button onclick="ROVCopilotApp.deleteIceberg('${ib.id}')" class="text-red-400 hover:text-red-300 transition-colors">
                        <svg class="h-3.5 w-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>` : ''}
                </td>
            </tr>
        `).join('');
    }

    async function deleteIceberg(id) {
        try {
            const resp = await fetch(`/api/icebergs/${id}`, { method: 'DELETE' });
            if (!resp.ok) {
                ROVCopilotForm.showToast('Failed to delete iceberg', 'error');
                return;
            }
            ROVCopilotForm.showToast('Iceberg removed', 'success');
            await loadAll();
        } catch (err) {
            ROVCopilotForm.showToast('Error: ' + err.message, 'error');
        }
    }

    function setupThemeToggle() {
        const btn = document.getElementById('btn-theme-toggle');
        btn.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            // Refresh charts for new color scheme
            fetchJSON('/api/threats').then(data => {
                ROVCopilotCharts.update(data.summary);
            });
        });
    }

    function setupExport() {
        document.getElementById('btn-export-pdf').addEventListener('click', () => {
            window.open('/api/export/pdf', '_blank');
        });
        document.getElementById('btn-export-csv').addEventListener('click', () => {
            window.open('/api/export/csv', '_blank');
        });
    }

    async function init() {
        const mapCenter = [46.7, -48.5];
        const mapZoom = 7;

        ROVCopilotMap.init(mapCenter, mapZoom);
        ROVCopilotCharts.init();
        ROVCopilotForm.init(loadAll);

        setupThemeToggle();
        setupExport();

        await loadAll();

        // Fit map to show all markers
        setTimeout(() => ROVCopilotMap.fitToMarkers(), 500);
    }

    return { init, deleteIceberg, loadAll };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    ROVCopilotApp.init();
});
