const ROVCopilotMap = (() => {
    let container = null;
    let lastPlatforms = [];
    let lastIcebergs = [];
    let lastThreats = [];
    let resizeBound = false;

    const PLATFORM_ORDER = ['hibernia', 'hebron', 'sea_rose', 'terra_nova'];
    const NM_PER_DEGREE = 60;
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

    function buildProjection(bounds, width, height) {
        const availableWidth = width - GRAPH_PADDING.left - GRAPH_PADDING.right;
        const availableHeight = height - GRAPH_PADDING.top - GRAPH_PADDING.bottom;
        const referenceLatitude = (bounds.minLat + bounds.maxLat) / 2;
        const lonNmPerDegree = NM_PER_DEGREE * Math.cos((referenceLatitude * Math.PI) / 180);
        const chartWidthNm = Math.max((bounds.maxLon - bounds.minLon) * lonNmPerDegree, 0.0001);
        const chartHeightNm = Math.max((bounds.maxLat - bounds.minLat) * NM_PER_DEGREE, 0.0001);
        const scale = Math.min(availableWidth / chartWidthNm, availableHeight / chartHeightNm);
        const frameWidth = chartWidthNm * scale;
        const frameHeight = chartHeightNm * scale;
        const frameLeft = GRAPH_PADDING.left + ((availableWidth - frameWidth) / 2);
        const frameTop = GRAPH_PADDING.top + ((availableHeight - frameHeight) / 2);

        return {
            scale,
            frameLeft,
            frameTop,
            frameWidth,
            frameHeight,
            frameRight: frameLeft + frameWidth,
            frameBottom: frameTop + frameHeight,
            project(latitude, longitude) {
                return {
                    x: frameLeft + ((longitude - bounds.minLon) * lonNmPerDegree * scale),
                    y: frameTop + ((bounds.maxLat - latitude) * NM_PER_DEGREE * scale),
                };
            },
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

    function headingEndpoint(point, headingDeg, projection) {
        const bearing = (headingDeg * Math.PI) / 180;
        const vectorX = Math.sin(bearing) * projection.scale;
        const vectorY = -Math.cos(bearing) * projection.scale;
        const candidates = [];

        if (vectorX > 0) candidates.push((projection.frameRight - point.x) / vectorX);
        if (vectorX < 0) candidates.push((projection.frameLeft - point.x) / vectorX);
        if (vectorY > 0) candidates.push((projection.frameBottom - point.y) / vectorY);
        if (vectorY < 0) candidates.push((projection.frameTop - point.y) / vectorY);

        const t = Math.min(...candidates.filter((value) => value > 0));
        return {
            x: Number.isFinite(t) ? point.x + (vectorX * t) : point.x + vectorX,
            y: Number.isFinite(t) ? point.y + (vectorY * t) : point.y + vectorY,
        };
    }

    function render() {
        if (!container) {
            return;
        }

        const width = Math.max(container.clientWidth, 640);
        const height = Math.max(container.clientHeight, 520);
        const bounds = computeBounds(lastPlatforms, lastIcebergs);
        const projection = buildProjection(bounds, width, height);
        const { project, frameLeft, frameTop, frameWidth, frameHeight, scale } = projection;
        const lonTicks = buildTicks(bounds.minLon, bounds.maxLon, 0.5);
        const latTicks = buildTicks(bounds.minLat, bounds.maxLat, 0.5);
        const threatMap = Object.fromEntries(lastThreats.map((threat) => [threat.iceberg.id, threat]));

        const svg = [];
        svg.push(`<svg class="ops-graph-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Operations graph">`);
        svg.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>`);

        lonTicks.forEach((tick) => {
            const { x } = project(bounds.minLat, tick);
            svg.push(`<line x1="${x}" y1="${frameTop}" x2="${x}" y2="${frameTop + frameHeight}" class="ops-graph-grid"></line>`);
            svg.push(`<text x="${x}" y="${height - 18}" text-anchor="middle" class="ops-graph-axis-label">${escapeHtml(formatAxisLabel(tick, 'lon'))}</text>`);
        });

        latTicks.forEach((tick) => {
            const { y } = project(tick, bounds.minLon);
            svg.push(`<line x1="${frameLeft}" y1="${y}" x2="${frameLeft + frameWidth}" y2="${y}" class="ops-graph-grid"></line>`);
            svg.push(`<text x="${width - 8}" y="${y + 4}" text-anchor="end" class="ops-graph-axis-label">${escapeHtml(formatAxisLabel(tick, 'lat'))}</text>`);
        });

        svg.push(
            `<rect x="${frameLeft}" y="${frameTop}" width="${frameWidth}" height="${frameHeight}" class="ops-graph-frame"></rect>`
        );

        lastPlatforms.forEach((platform) => {
            const center = project(platform.latitude, platform.longitude);

            RINGS.forEach((ring) => {
                svg.push(
                    `<circle cx="${center.x}" cy="${center.y}" r="${ring.nm * scale}" stroke="${ring.stroke}" fill="${ring.fill}" stroke-dasharray="${ring.dash}" class="ops-graph-ring"></circle>`
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
            const endPoint = headingEndpoint(point, iceberg.heading, projection);
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
                    <line x1="${point.x}" y1="${point.y}" x2="${endPoint.x}" y2="${endPoint.y}" stroke="${color}" stroke-width="3" stroke-linecap="round" class="ops-graph-track"></line>
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
