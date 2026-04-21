const ROVCopilotApp = (() => {
    const PLATFORM_ORDER = ['hibernia', 'hebron', 'sea_rose', 'terra_nova'];

    async function fetchJSON(url) {
        const response = await fetch(url);
        return response.json();
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function threatBadge(level) {
        const styles = {
            red: 'background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3)',
            yellow: 'background:rgba(234,179,8,0.15);color:#eab308;border:1px solid rgba(234,179,8,0.3)',
            green: 'background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3)',
        };
        return `<span style="${styles[level] || ''};display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">${escapeHtml(level).toUpperCase()}</span>`;
    }

    function detailHtml(lines) {
        const filtered = lines.filter(Boolean);
        if (filtered.length === 0) {
            return '';
        }

        return `<div style="margin-top:4px;font-size:10px;line-height:1.35;color:hsl(var(--muted-foreground));">${filtered.map(escapeHtml).join('<br>')}</div>`;
    }

    function formatCoordinate(value, axis) {
        const numericValue = Number(value);
        const hemisphere = axis === 'lat'
            ? (numericValue >= 0 ? 'N' : 'S')
            : (numericValue >= 0 ? 'E' : 'W');
        const absolute = Math.abs(numericValue);
        let degrees = Math.floor(absolute);
        let minutes = Number(((absolute - degrees) * 60).toFixed(3));

        if (minutes >= 60) {
            degrees += 1;
            minutes = 0;
        }

        const minutesText = minutes.toFixed(3).replace(/\.?0+$/, '');
        const [minuteWhole, minuteFraction = ''] = minutesText.split('.');
        const compactMinutes = `${String(minuteWhole).padStart(2, '0')}${minuteFraction}`;
        return `${degrees}.${compactMinutes}${hemisphere}`;
    }

    function formatLatitude(value) {
        return formatCoordinate(value, 'lat');
    }

    function formatLongitude(value) {
        return formatCoordinate(value, 'lon');
    }

    async function loadAll() {
        const [platforms, icebergs, threatData] = await Promise.all([
            fetchJSON('/api/platforms'),
            fetchJSON('/api/icebergs'),
            fetchJSON('/api/threats'),
        ]);

        ROVCopilotMap.update(platforms, icebergs, threatData.results);
        ROVCopilotMap.fitToMarkers();
        ROVCopilotCharts.update(threatData.summary);
        updateSummaryCards(threatData.summary.total);
        updateThreatMatrix(threatData.results);
        updateIcebergList(icebergs);
    }

    function updateSummaryCards(total) {
        document.getElementById('count-red').textContent = total.red;
        document.getElementById('count-yellow').textContent = total.yellow;
        document.getElementById('count-green').textContent = total.green;
    }

    function updateThreatMatrix(results) {
        const tbody = document.getElementById('threat-matrix-body');
        if (results.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-muted-foreground">Add an iceberg to see threat assessment</td></tr>';
            return;
        }

        tbody.innerHTML = results.map((result) => {
            const cells = PLATFORM_ORDER.map((platformId) => {
                const platformThreat = result.platform_threats[platformId];
                const subseaThreat = result.subsea_threats[platformId];

                return `
                    <td class="py-2 px-2 text-center align-top">
                        ${threatBadge(platformThreat.level)}
                        ${detailHtml([
                            `${platformThreat.distance_nm} nm`,
                            platformThreat.note,
                        ])}
                    </td>
                    <td class="py-2 px-2 text-center align-top">
                        ${threatBadge(subseaThreat.level)}
                        ${detailHtml([
                            `${subseaThreat.distance_nm} nm track`,
                            subseaThreat.note,
                        ])}
                    </td>
                `;
            }).join('');

            return `
                <tr class="border-b border-border hover:bg-muted/50 transition-colors">
                    <td class="py-2 px-3 font-medium text-sm align-top">${escapeHtml(result.iceberg.name)}</td>
                    ${cells}
                </tr>
            `;
        }).join('');
    }

    function updateIcebergList(icebergs) {
        const tbody = document.getElementById('iceberg-list-body');
        if (icebergs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted-foreground">No icebergs added yet. Use the form above to add one.</td></tr>';
            return;
        }

        tbody.innerHTML = icebergs.map((iceberg) => `
            <tr class="border-b border-border/50 hover:bg-muted/50 transition-colors">
                <td class="py-1.5 px-2 font-medium">${escapeHtml(iceberg.name)}</td>
                <td class="py-1.5 px-2 text-right text-muted-foreground">${formatLatitude(iceberg.latitude)}</td>
                <td class="py-1.5 px-2 text-right text-muted-foreground">${formatLongitude(iceberg.longitude)}</td>
                <td class="py-1.5 px-2 text-right text-muted-foreground">${iceberg.heading}°</td>
                <td class="py-1.5 px-2 text-right text-muted-foreground">${iceberg.keel_depth_m}m</td>
                <td class="py-1.5 px-2 text-right">
                    <button onclick="ROVCopilotApp.deleteIceberg('${iceberg.id}')" class="text-red-400 hover:text-red-300 transition-colors">
                        <svg class="h-3.5 w-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async function deleteIceberg(id) {
        try {
            const response = await fetch(`/api/icebergs/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                ROVCopilotForm.showToast('Failed to delete iceberg', 'error');
                return;
            }

            ROVCopilotForm.showToast('Iceberg removed', 'success');
            await loadAll();
        } catch (error) {
            ROVCopilotForm.showToast(`Error: ${error.message}`, 'error');
        }
    }

    function setupThemeSync() {
        document.addEventListener('theme:changed', () => {
            ROVCopilotCharts.refresh();
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
        setupThemeSync();
        setupExport();
        await loadAll();
    }

    return { init, deleteIceberg, loadAll };
})();

document.addEventListener('DOMContentLoaded', () => {
    ROVCopilotApp.init();
});
