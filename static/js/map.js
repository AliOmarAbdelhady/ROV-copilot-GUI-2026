const ROVCopilotMap = (() => {
    let map = null;
    let platformMarkers = [];
    let icebergMarkers = [];
    let trajectoryLines = [];
    let threatCircles = [];

    const NM_TO_METERS = 1852;

    function init(center, zoom) {
        map = L.map('map', { zoomControl: true }).setView(center, zoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 18,
        }).addTo(map);

        // Add ocean-themed tile layer option
        L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; Stadia Maps',
            maxZoom: 18,
        }).addTo(map);
    }

    function clearLayers() {
        platformMarkers.forEach(m => map.removeLayer(m));
        icebergMarkers.forEach(m => map.removeLayer(m));
        trajectoryLines.forEach(l => map.removeLayer(l));
        threatCircles.forEach(c => map.removeLayer(c));
        platformMarkers = [];
        icebergMarkers = [];
        trajectoryLines = [];
        threatCircles = [];
    }

    function createPlatformIcon(name) {
        return L.divIcon({
            className: 'platform-marker',
            html: `<div style="
                background: #3b82f6;
                border: 2px solid #1d4ed8;
                border-radius: 50%;
                width: 14px;
                height: 14px;
                box-shadow: 0 0 8px rgba(59,130,246,0.5);
            "></div>
            <div style="
                position: absolute;
                top: -22px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(15,23,42,0.85);
                color: #e2e8f0;
                padding: 1px 6px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: 600;
                white-space: nowrap;
            ">${name}</div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
        });
    }

    function createIcebergIcon(heading, threatLevel) {
        const colors = {
            red: '#ef4444',
            yellow: '#eab308',
            green: '#22c55e',
        };
        const color = colors[threatLevel] || '#6b7280';
        const rad = (heading * Math.PI) / 180;
        const size = 10;
        const cx = size;
        const cy = size;
        const tipX = cx + size * Math.sin(rad);
        const tipY = cy - size * Math.cos(rad);
        const baseLX = cx + (size * 0.5) * Math.sin(rad + 2.5);
        const baseLY = cy - (size * 0.5) * Math.cos(rad + 2.5);
        const baseRX = cx + (size * 0.5) * Math.sin(rad - 2.5);
        const baseRY = cy - (size * 0.5) * Math.cos(rad - 2.5);

        return L.divIcon({
            className: 'iceberg-marker',
            html: `<svg width="${size * 2}" height="${size * 2}" viewBox="0 0 ${size * 2} ${size * 2}">
                <polygon points="${tipX},${tipY} ${baseLX},${baseLY} ${baseRX},${baseRY}"
                    fill="${color}" stroke="white" stroke-width="1.5" opacity="0.9"/>
                <circle cx="${cx}" cy="${cy}" r="2" fill="white"/>
            </svg>`,
            iconSize: [size * 2, size * 2],
            iconAnchor: [size, size],
        });
    }

    function renderPlatforms(platforms) {
        platforms.forEach(p => {
            const marker = L.marker([p.latitude, p.longitude], {
                icon: createPlatformIcon(p.name),
            }).addTo(map);

            marker.bindPopup(`
                <div style="font-family: system-ui; min-width: 160px;">
                    <strong style="font-size: 13px;">${p.name}</strong><br>
                    <span style="font-size: 11px; color: #64748b;">${p.label}</span><br>
                    <span style="font-size: 11px;">Depth: <b>${p.depth_m}m</b></span>
                </div>
            `);
            platformMarkers.push(marker);

            // Threat zone circles
            const yellowCircle = L.circle([p.latitude, p.longitude], {
                radius: 10 * NM_TO_METERS,
                color: '#eab308',
                fillColor: '#eab308',
                fillOpacity: 0.04,
                weight: 1,
                dashArray: '6 4',
            }).addTo(map);
            yellowCircle.bindTooltip(`${p.name}: 10nm zone`, { sticky: true });
            threatCircles.push(yellowCircle);

            const redCircle = L.circle([p.latitude, p.longitude], {
                radius: 5 * NM_TO_METERS,
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.06,
                weight: 1,
                dashArray: '4 4',
            }).addTo(map);
            redCircle.bindTooltip(`${p.name}: 5nm zone`, { sticky: true });
            threatCircles.push(redCircle);
        });
    }

    function renderIcebergs(icebergs, threats) {
        const threatMap = {};
        if (threats) {
            threats.forEach(t => {
                threatMap[t.iceberg.id] = t;
            });
        }

        // Determine worst threat for iceberg icon color
        function worstThreat(iceberg) {
            const t = threatMap[iceberg.id];
            if (!t) return 'green';
            const levels = Object.values(t.platform_threats).map(p => p.level);
            if (levels.includes('red')) return 'red';
            if (levels.includes('yellow')) return 'yellow';
            return 'green';
        }

        icebergs.forEach(ib => {
            const threatLevel = worstThreat(ib);
            const marker = L.marker([ib.latitude, ib.longitude], {
                icon: createIcebergIcon(ib.heading, threatLevel),
            }).addTo(map);

            marker.bindPopup(`
                <div style="font-family: system-ui; min-width: 160px;">
                    <strong style="font-size: 13px;">${ib.name}</strong><br>
                    <span style="font-size: 11px; color: #64748b;">
                        ${ib.latitude.toFixed(4)}°N, ${ib.longitude.toFixed(4)}°W
                    </span><br>
                    <span style="font-size: 11px;">Heading: <b>${ib.heading}°</b> | Keel: <b>${ib.keel_depth_m}m</b></span>
                </div>
            `);
            icebergMarkers.push(marker);
        });
    }

    function renderTrajectories(icebergs) {
        icebergs.forEach(ib => {
            fetch(`/api/trajectory/${ib.id}`)
                .then(r => r.json())
                .then(data => {
                    if (!data.points) return;
                    const latlngs = data.points.map(p => [p.lat, p.lon]);
                    const line = L.polyline(latlngs, {
                        color: '#94a3b8',
                        weight: 1.5,
                        dashArray: '4 6',
                        opacity: 0.6,
                    }).addTo(map);
                    trajectoryLines.push(line);
                })
                .catch(() => {});
        });
    }

    function update(platforms, icebergs, threats) {
        clearLayers();
        renderPlatforms(platforms);
        renderIcebergs(icebergs, threats);
        renderTrajectories(icebergs);
    }

    function fitToMarkers() {
        const all = [...platformMarkers, ...icebergMarkers];
        if (all.length > 0) {
            const group = L.featureGroup(all);
            map.fitBounds(group.getBounds().pad(0.15));
        }
    }

    return { init, update, fitToMarkers };
})();
