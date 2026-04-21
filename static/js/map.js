const ROVCopilotMap = (() => {
    let container = null;
    let lastPlatforms = [];
    let lastIcebergs = [];
    let lastThreats = [];
    let resizeBound = false;

    const PLATFORM_ORDER = ['hibernia', 'hebron', 'sea_rose', 'terra_nova'];
    const EARTH_RADIUS_M = 6371000;
    const NM_TO_METERS = 1852;
    const GRAPH_PADDING = { top: 36, right: 84, bottom: 54, left: 78 };
    const DEFAULT_BOUNDS = {
        minLat: 46.2,
        maxLat: 48.05,
        minLon: -49.65,
        maxLon: -47.65,
    };
    const RINGS = [
        { nm: 25, stroke: '#60a5fa', dash: '10 8', fill: 'rgba(96,165,250,0.03)' },
        { nm: 10, stroke: '#eab308', dash: '6 4', fill: 'rgba(234,179,8,0.04)' },
        { nm: 5, stroke: '#ef4444', dash: '4 4', fill: 'rgba(239,68,68,0.05)' },
    ];

    function init() {
        container = document.getElementById('map');
        container.classList.add('ops-graph');
        if (!resizeBound) {
            resizeBound = true;
            window.addEventListener('resize', () => {
                if (container && (lastPlatforms.length || lastIcebergs.length)) {
                    render();
                }
            });
        }
        render();
    }

    function update(platforms, icebergs, threats) {
        lastPlatforms = Array.isArray(platforms) ? platforms : [];
        lastIcebergs = Array.isArray(icebergs) ? icebergs : [];
        lastThreats = Array.isArray(threats) ? threats : [];
        render();
    }

    function fitToMarkers() {
        render();
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function worstThreat(threat) {
        if (!threat) {
            return 'green';
        }

        const levels = [
            ...Object.values(threat.platform_threats || {}).map((item) => item.level),
            ...Object.values(threat.subsea_threats || {}).map((item) => item.level),
        ];
        if (levels.includes('red')) return 'red';
        if (levels.includes('yellow')) return 'yellow';
        return 'green';
    }

    function threatColor(level) {
        const colors = {
            red: '#ef4444',
            yellow: '#facc15',
            green: '#22c55e',
        };
        return colors[level] || '#94a3b8';
    }

    function computeBounds(platforms, icebergs) {
        const bounds = { ...DEFAULT_BOUNDS };
        const points = [...platforms, ...icebergs];

        if (points.length > 0) {
            bounds.minLat = Math.min(bounds.minLat, ...points.map((point) => point.latitude));
            bounds.maxLat = Math.max(bounds.maxLat, ...points.map((point) => point.latitude));
            bounds.minLon = Math.min(bounds.minLon, ...points.map((point) => point.longitude));
            bounds.maxLon = Math.max(bounds.maxLon, ...points.map((point) => point.longitude));
        }

        const latPad = Math.max(0.08, (bounds.maxLat - bounds.minLat) * 0.08);
        const lonPad = Math.max(0.08, (bounds.maxLon - bounds.minLon) * 0.08);

        return {
            minLat: bounds.minLat - latPad,
            maxLat: bounds.maxLat + latPad,
            minLon: bounds.minLon - lonPad,
            maxLon: bounds.maxLon + lonPad,
        };
    }

    function buildTicks(min, max, step) {
        const ticks = [];
        const epsilon = step / 100;
        const start = Math.ceil((min - epsilon) / step) * step;

        for (let value = start; value <= max + epsilon; value += step) {
            ticks.push(Number(value.toFixed(6)));
        }
        return ticks;
    }

    function formatCoordinate(value, axis) {
        const hemisphere = axis === 'lat'
            ? (value >= 0 ? 'N' : 'S')
            : (value >= 0 ? 'E' : 'W');
        const absolute = Math.abs(value);
        let degrees = Math.floor(absolute);
        let minutes = Number(((absolute - degrees) * 60).toFixed(3));

        if (minutes >= 60) {
            degrees += 1;
            minutes = 0;
        }

        const minutesText = minutes.toFixed(3).replace(/\.?0+$/, '');
        const [minuteWhole, minuteFraction = ''] = minutesText.split('.');
        return `${degrees}.${String(minuteWhole).padStart(2, '0')}${minuteFraction}${hemisphere}`;
    }

    function formatAxisLabel(value, axis) {
        return formatCoordinate(value, axis);
    }

    function destinationPoint(lat, lon, bearingDeg, distanceNm) {
        const distance = (distanceNm * NM_TO_METERS) / EARTH_RADIUS_M;
        const bearing = (bearingDeg * Math.PI) / 180;
        const lat1 = (lat * Math.PI) / 180;
        const lon1 = (lon * Math.PI) / 180;

        const lat2 = Math.asin(
            Math.sin(lat1) * Math.cos(distance) +
            Math.cos(lat1) * Math.sin(distance) * Math.cos(bearing)
        );
        const lon2 = lon1 + Math.atan2(
            Math.sin(bearing) * Math.sin(distance) * Math.cos(lat1),
            Math.cos(distance) - Math.sin(lat1) * Math.sin(lat2)
        );

        return {
            latitude: (lat2 * 180) / Math.PI,
            longitude: (lon2 * 180) / Math.PI,
        };
    }

    function render() {
        if (!container) {
            return;
        }

        const width = Math.max(container.clientWidth, 640);
        const height = Math.max(container.clientHeight, 520);
        const plotWidth = width - GRAPH_PADDING.left - GRAPH_PADDING.right;
        const plotHeight = height - GRAPH_PADDING.top - GRAPH_PADDING.bottom;
        const bounds = computeBounds(lastPlatforms, lastIcebergs);
        const lonTicks = buildTicks(bounds.minLon, bounds.maxLon, 0.5);
        const latTicks = buildTicks(bounds.minLat, bounds.maxLat, 0.5);
        const threatMap = Object.fromEntries(lastThreats.map((threat) => [threat.iceberg.id, threat]));

        const project = (latitude, longitude) => ({
            x: GRAPH_PADDING.left + ((longitude - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * plotWidth,
            y: GRAPH_PADDING.top + ((bounds.maxLat - latitude) / (bounds.maxLat - bounds.minLat)) * plotHeight,
        });

        const svg = [];
        svg.push(`<svg class="ops-graph-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Operations graph">`);
        svg.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>`);

        lonTicks.forEach((tick) => {
            const { x } = project(bounds.minLat, tick);
            svg.push(`<line x1="${x}" y1="${GRAPH_PADDING.top}" x2="${x}" y2="${height - GRAPH_PADDING.bottom}" class="ops-graph-grid"></line>`);
            svg.push(`<text x="${x}" y="${height - 18}" text-anchor="middle" class="ops-graph-axis-label">${escapeHtml(formatAxisLabel(tick, 'lon'))}</text>`);
        });

        latTicks.forEach((tick) => {
            const { y } = project(tick, bounds.minLon);
            svg.push(`<line x1="${GRAPH_PADDING.left}" y1="${y}" x2="${width - GRAPH_PADDING.right}" y2="${y}" class="ops-graph-grid"></line>`);
            svg.push(`<text x="${width - 8}" y="${y + 4}" text-anchor="end" class="ops-graph-axis-label">${escapeHtml(formatAxisLabel(tick, 'lat'))}</text>`);
        });

        svg.push(
            `<rect x="${GRAPH_PADDING.left}" y="${GRAPH_PADDING.top}" width="${plotWidth}" height="${plotHeight}" class="ops-graph-frame"></rect>`
        );

        lastPlatforms.forEach((platform) => {
            const center = project(platform.latitude, platform.longitude);

            RINGS.forEach((ring) => {
                const latOffset = ring.nm / 60;
                const lonOffset = ring.nm / (60 * Math.cos((platform.latitude * Math.PI) / 180));
                const north = project(platform.latitude + latOffset, platform.longitude);
                const east = project(platform.latitude, platform.longitude + lonOffset);
                const rx = Math.abs(east.x - center.x);
                const ry = Math.abs(north.y - center.y);
                svg.push(
                    `<ellipse cx="${center.x}" cy="${center.y}" rx="${rx}" ry="${ry}" stroke="${ring.stroke}" fill="${ring.fill}" stroke-dasharray="${ring.dash}" class="ops-graph-ring"></ellipse>`
                );
            });
        });

        lastPlatforms.forEach((platform) => {
            const point = project(platform.latitude, platform.longitude);
            svg.push(`
                <g>
                    <title>${escapeHtml(`${platform.name} | ${formatCoordinate(platform.latitude, 'lat')} ${formatCoordinate(platform.longitude, 'lon')} | Depth ${platform.depth_m}m`)}</title>
                    <circle cx="${point.x}" cy="${point.y}" r="8" class="ops-graph-platform"></circle>
                    <circle cx="${point.x}" cy="${point.y}" r="4.5" class="ops-graph-platform-core"></circle>
                    <text x="${point.x + 14}" y="${point.y + 5}" class="ops-graph-label">${escapeHtml(platform.name)}</text>
                </g>
            `);
        });

        lastIcebergs.forEach((iceberg) => {
            const threat = threatMap[iceberg.id];
            const point = project(iceberg.latitude, iceberg.longitude);
            const rayPointGeo = destinationPoint(iceberg.latitude, iceberg.longitude, iceberg.heading, 240);
            const farPoint = project(rayPointGeo.latitude, rayPointGeo.longitude);
            const vectorX = farPoint.x - point.x;
            const vectorY = farPoint.y - point.y;
            const minX = GRAPH_PADDING.left;
            const maxX = width - GRAPH_PADDING.right;
            const minY = GRAPH_PADDING.top;
            const maxY = height - GRAPH_PADDING.bottom;
            const candidates = [];

            if (vectorX > 0) candidates.push((maxX - point.x) / vectorX);
            if (vectorX < 0) candidates.push((minX - point.x) / vectorX);
            if (vectorY > 0) candidates.push((maxY - point.y) / vectorY);
            if (vectorY < 0) candidates.push((minY - point.y) / vectorY);

            const t = Math.min(...candidates.filter((value) => value > 0));
            const endX = Number.isFinite(t) ? point.x + vectorX * t : farPoint.x;
            const endY = Number.isFinite(t) ? point.y + vectorY * t : farPoint.y;
            const color = threatColor(worstThreat(threat));

            const tooltipLines = [
                iceberg.name,
                `${formatCoordinate(iceberg.latitude, 'lat')} ${formatCoordinate(iceberg.longitude, 'lon')}`,
                `Heading ${iceberg.heading}°`,
                `Keel ${iceberg.keel_depth_m}m`,
            ];
            PLATFORM_ORDER.forEach((platformId) => {
                const platformThreat = threat?.platform_threats?.[platformId];
                const subseaThreat = threat?.subsea_threats?.[platformId];
                if (platformThreat && subseaThreat) {
                    tooltipLines.push(
                        `${platformThreat.platform_name}: surface ${platformThreat.level.toUpperCase()} (${platformThreat.distance_nm} nm), subsea ${subseaThreat.level.toUpperCase()}`
                    );
                }
            });

            svg.push(`
                <g>
                    <title>${escapeHtml(tooltipLines.join(' | '))}</title>
                    <line x1="${point.x}" y1="${point.y}" x2="${endX}" y2="${endY}" stroke="${color}" stroke-width="3" stroke-linecap="round" class="ops-graph-track"></line>
                    <circle cx="${point.x}" cy="${point.y}" r="7.5" fill="${color}" stroke="white" stroke-width="2.5"></circle>
                    <text x="${point.x + 12}" y="${point.y - 10}" class="ops-graph-iceberg-label">${escapeHtml(iceberg.name)}</text>
                </g>
            `);
        });

        svg.push(
            `<text x="${GRAPH_PADDING.left}" y="18" class="ops-graph-caption">North/West competition operating area</text>`
        );
        svg.push('</svg>');

        container.innerHTML = `
            ${svg.join('')}
            <div class="ops-graph-legend">
                <span><i class="legend-swatch platform"></i>Platform</span>
                <span><i class="legend-swatch iceberg"></i>Iceberg</span>
                <span><i class="legend-line"></i>Heading line</span>
            </div>
        `;
    }

    return { init, update, fitToMarkers };
})();
