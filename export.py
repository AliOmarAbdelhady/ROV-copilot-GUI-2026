import csv
import io
import math
from datetime import datetime, timezone
from html import escape

PDF_GRAPH_SIZE = {"width": 760, "height": 760}
PDF_GRAPH_PADDING = {"top": 48, "right": 74, "bottom": 44, "left": 46}
PDF_GRAPH_DEFAULT_BOUNDS = {
    "minLat": 46.2,
    "maxLat": 48.05,
    "minLon": -49.65,
    "maxLon": -47.65,
}
PDF_GRAPH_TICK_STEP = 0.5
PDF_GRAPH_NM_PER_DEGREE = 60


def generate_csv(results):
    """Generate CSV threat report."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Iceberg", "Platform", "Platform Threat", "Platform Distance (nm)",
        "Subsea Threat", "Subsea Note",
    ])
    for r in results:
        iceberg_name = r["iceberg"]["name"]
        for pid, pt in r["platform_threats"].items():
            st = r["subsea_threats"][pid]
            writer.writerow([
                iceberg_name,
                pt["platform_name"],
                pt["level"].upper(),
                pt["distance_nm"],
                st["level"].upper(),
                st["note"],
            ])
    return output.getvalue()


def generate_pdf(results, summary, platforms, icebergs):
    """Generate PDF threat report using WeasyPrint."""
    html = _build_report_html(results, summary, platforms, icebergs)
    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html).write_pdf()
        return pdf_bytes
    except ImportError:
        # Fallback: return HTML as bytes if weasyprint not available
        return html.encode("utf-8")


def generate_frequency_pdf(species, counts):
    """Generate PDF frequency report in a clear tabular style for judges."""
    html = _build_frequency_report_html(species, counts)
    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html).write_pdf()
        return pdf_bytes
    except ImportError:
        # Fallback: return HTML as bytes if weasyprint not available
        return html.encode("utf-8")


def _threat_badge(level):
    colors = {"red": "#ef4444", "yellow": "#eab308", "green": "#22c55e"}
    color = colors.get(level, "#6b7280")
    return (
        f'<span style="background:{color};color:white;padding:2px 10px;'
        f'border-radius:4px;font-weight:600;font-size:12px;">'
        f"{level.upper()}</span>"
    )


def _format_coordinate(value, axis):
    numeric_value = float(value)
    absolute = abs(numeric_value)
    degrees = int(absolute)
    minutes = round((absolute - degrees) * 60, 3)
    if minutes >= 60:
        degrees += 1
        minutes = 0.0

    minutes_text = f"{minutes:.3f}".rstrip("0").rstrip(".")
    minute_whole, _, minute_fraction = minutes_text.partition(".")
    compact_minutes = f"{int(minute_whole):02d}{minute_fraction}"
    hemisphere = (
        "N" if axis == "lat" and numeric_value >= 0
        else "S" if axis == "lat"
        else "E" if numeric_value >= 0
        else "W"
    )
    return f"{degrees}.{compact_minutes}{hemisphere}"


def _format_axis_coordinate(value, axis):
    absolute = abs(float(value))
    degrees = int(absolute)
    minutes = round((absolute - degrees) * 60)
    if minutes >= 60:
        degrees += 1
        minutes = 0

    hemisphere = (
        "N" if axis == "lat" and value >= 0
        else "S" if axis == "lat"
        else "E" if value >= 0
        else "W"
    )
    return f"{degrees}\N{DEGREE SIGN}{minutes:02d}'{hemisphere}"


def _build_graph_ticks(minimum, maximum, step):
    ticks = []
    epsilon = step / 100
    start = math.ceil((minimum - epsilon) / step) * step

    value = start
    while value <= maximum + epsilon:
        ticks.append(round(value, 6))
        value += step

    return ticks


def _compute_pdf_graph_bounds(platforms, icebergs):
    bounds = dict(PDF_GRAPH_DEFAULT_BOUNDS)
    points = list(platforms) + list(icebergs)

    if points:
        bounds["minLat"] = min(bounds["minLat"], *(point["latitude"] for point in points))
        bounds["maxLat"] = max(bounds["maxLat"], *(point["latitude"] for point in points))
        bounds["minLon"] = min(bounds["minLon"], *(point["longitude"] for point in points))
        bounds["maxLon"] = max(bounds["maxLon"], *(point["longitude"] for point in points))

    lat_pad = max(0.08, (bounds["maxLat"] - bounds["minLat"]) * 0.08)
    lon_pad = max(0.08, (bounds["maxLon"] - bounds["minLon"]) * 0.08)

    return {
        "minLat": bounds["minLat"] - lat_pad,
        "maxLat": bounds["maxLat"] + lat_pad,
        "minLon": bounds["minLon"] - lon_pad,
        "maxLon": bounds["maxLon"] + lon_pad,
    }


def _build_pdf_graph_metrics(bounds):
    available_width = PDF_GRAPH_SIZE["width"] - PDF_GRAPH_PADDING["left"] - PDF_GRAPH_PADDING["right"]
    available_height = PDF_GRAPH_SIZE["height"] - PDF_GRAPH_PADDING["top"] - PDF_GRAPH_PADDING["bottom"]
    reference_latitude = (bounds["minLat"] + bounds["maxLat"]) / 2
    lon_nm_per_degree = PDF_GRAPH_NM_PER_DEGREE * math.cos(math.radians(reference_latitude))
    chart_width_nm = max((bounds["maxLon"] - bounds["minLon"]) * lon_nm_per_degree, 0.0001)
    chart_height_nm = max((bounds["maxLat"] - bounds["minLat"]) * PDF_GRAPH_NM_PER_DEGREE, 0.0001)
    scale = min(available_width / chart_width_nm, available_height / chart_height_nm)
    frame_width = chart_width_nm * scale
    frame_height = chart_height_nm * scale
    frame_left = PDF_GRAPH_PADDING["left"] + ((available_width - frame_width) / 2)
    frame_top = PDF_GRAPH_PADDING["top"] + ((available_height - frame_height) / 2)

    return {
        "scale": scale,
        "frame_left": frame_left,
        "frame_top": frame_top,
        "frame_right": frame_left + frame_width,
        "frame_bottom": frame_top + frame_height,
        "frame_width": frame_width,
        "frame_height": frame_height,
        "lon_nm_per_degree": lon_nm_per_degree,
    }


def _build_report_graph_svg(platforms, icebergs):
    width = PDF_GRAPH_SIZE["width"]
    height = PDF_GRAPH_SIZE["height"]
    bounds = _compute_pdf_graph_bounds(platforms, icebergs)
    metrics = _build_pdf_graph_metrics(bounds)
    lon_ticks = _build_graph_ticks(bounds["minLon"], bounds["maxLon"], PDF_GRAPH_TICK_STEP)
    lat_ticks = _build_graph_ticks(bounds["minLat"], bounds["maxLat"], PDF_GRAPH_TICK_STEP)

    def project(latitude, longitude):
        return {
            "x": metrics["frame_left"] + (
                (longitude - bounds["minLon"]) * metrics["lon_nm_per_degree"] * metrics["scale"]
            ),
            "y": metrics["frame_top"] + (
                (bounds["maxLat"] - latitude) * PDF_GRAPH_NM_PER_DEGREE * metrics["scale"]
            ),
        }

    def heading_endpoint(point, iceberg):
        bearing = math.radians(iceberg["heading"])
        vector_x = math.sin(bearing) * metrics["scale"]
        vector_y = -math.cos(bearing) * metrics["scale"]
        candidates = []

        if vector_x > 0:
            candidates.append((metrics["frame_right"] - point["x"]) / vector_x)
        elif vector_x < 0:
            candidates.append((metrics["frame_left"] - point["x"]) / vector_x)

        if vector_y > 0:
            candidates.append((metrics["frame_bottom"] - point["y"]) / vector_y)
        elif vector_y < 0:
            candidates.append((metrics["frame_top"] - point["y"]) / vector_y)

        valid_candidates = [value for value in candidates if value > 0]
        if not valid_candidates:
            return {"x": point["x"] + vector_x, "y": point["y"] + vector_y}

        t_value = min(valid_candidates)
        return {
            "x": point["x"] + (vector_x * t_value),
            "y": point["y"] + (vector_y * t_value),
        }

    svg = [
        (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
            'role="img" aria-label="Operations graph for the PDF report">'
        ),
        f'<rect x="0" y="0" width="{width}" height="{height}" fill="#ffffff"/>',
    ]

    for tick in lon_ticks:
        x_pos = project(bounds["minLat"], tick)["x"]
        svg.append(
            f'<line x1="{x_pos:.2f}" y1="{metrics["frame_top"]:.2f}" '
            f'x2="{x_pos:.2f}" y2="{metrics["frame_bottom"]:.2f}" '
            'stroke="#6b7280" stroke-width="1"/>'
        )
        svg.append(
            f'<text x="{x_pos:.2f}" y="22" text-anchor="middle" '
            'font-family="Arial, Helvetica, sans-serif" font-size="12" '
            f'font-weight="600" fill="#111827">{escape(_format_axis_coordinate(tick, "lon"))}</text>'
        )

    for tick in lat_ticks:
        y_pos = project(tick, bounds["minLon"])["y"]
        label_x = width - 16
        label_y = y_pos + 4
        svg.append(
            f'<line x1="{metrics["frame_left"]:.2f}" y1="{y_pos:.2f}" '
            f'x2="{metrics["frame_right"]:.2f}" y2="{y_pos:.2f}" '
            'stroke="#6b7280" stroke-width="1"/>'
        )
        svg.append(
            f'<text x="{label_x}" y="{label_y:.2f}" '
            'font-family="Arial, Helvetica, sans-serif" font-size="12" '
            f'font-weight="600" fill="#111827" transform="rotate(90 {label_x} {label_y:.2f})">'
            f'{escape(_format_axis_coordinate(tick, "lat"))}</text>'
        )

    for iceberg in icebergs:
        point = project(iceberg["latitude"], iceberg["longitude"])
        end_point = heading_endpoint(point, iceberg)
        svg.append(
            f'<line x1="{point["x"]:.2f}" y1="{point["y"]:.2f}" '
            f'x2="{end_point["x"]:.2f}" y2="{end_point["y"]:.2f}" '
            'stroke="#111827" stroke-width="2.4" stroke-linecap="round"/>'
        )

    for index, platform in enumerate(platforms):
        point = project(platform["latitude"], platform["longitude"])
        label_offset_y = -8 if index % 2 == 0 else 4
        svg.append(
            f'<circle cx="{point["x"]:.2f}" cy="{point["y"]:.2f}" r="5.5" '
            'fill="#ffffff" stroke="#111827" stroke-width="1.5"/>'
        )
        svg.append(
            f'<text x="{point["x"] + 10:.2f}" y="{point["y"] + label_offset_y:.2f}" '
            'font-family="Arial, Helvetica, sans-serif" font-size="13" '
            f'font-weight="700" fill="#111827">{escape(platform["name"])}</text>'
        )

    for index, iceberg in enumerate(icebergs):
        point = project(iceberg["latitude"], iceberg["longitude"])
        x_offset = -6 if index % 2 == 0 else 12
        y_offset = -12 if index % 3 != 1 else 18
        anchor = "end" if x_offset < 0 else "start"
        svg.append(
            f'<circle cx="{point["x"]:.2f}" cy="{point["y"]:.2f}" r="4.8" fill="#111827"/>'
        )
        svg.append(
            f'<text x="{point["x"] + x_offset:.2f}" y="{point["y"] + y_offset:.2f}" '
            'font-family="Arial, Helvetica, sans-serif" font-size="14" '
            f'text-anchor="{anchor}" font-weight="700" fill="#111827">{escape(iceberg["name"])}</text>'
        )

    svg.append("</svg>")
    return "".join(svg)


def _build_report_html(results, summary, platforms, icebergs):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    graph_svg = _build_report_graph_svg(platforms, icebergs)
    rows = ""
    for r in results:
        iceberg_name = escape(r["iceberg"]["name"])
        for pid, pt in r["platform_threats"].items():
            st = r["subsea_threats"][pid]
            rows += f"""
            <tr>
                <td>{iceberg_name}</td>
                <td>{escape(pt['platform_name'])}</td>
                <td>{_threat_badge(pt['level'])}</td>
                <td>{pt['distance_nm']} nm</td>
                <td>{_threat_badge(st['level'])}</td>
                <td>{escape(st['note'])}</td>
            </tr>"""

    total = summary["total"]
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            @page {{ size: A4; margin: 15mm; }}
            body {{ font-family: Arial, Helvetica, sans-serif; margin: 0; color: #1e293b; font-size: 12px; }}
            h1 {{ font-size: 24px; margin: 0 0 4px; }}
            h2 {{ font-size: 17px; margin: 24px 0 10px; color: #334155; }}
            .subtitle {{ color: #64748b; font-size: 13px; margin: 0 0 18px; }}
            .graph-panel {{ border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; margin-bottom: 20px; page-break-inside: avoid; }}
            .graph-section {{ break-before: page; page-break-before: always; }}
            .graph-title {{ margin: 0 0 4px; font-size: 14px; font-weight: 700; color: #0f172a; }}
            .graph-copy {{ margin: 0 0 12px; color: #64748b; font-size: 11px; }}
            .graph-svg {{ width: 100%; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }}
            th {{ background: #f1f5f9; text-align: left; padding: 8px 12px; border-bottom: 2px solid #e2e8f0; }}
            td {{ padding: 6px 12px; border-bottom: 1px solid #e2e8f0; }}
            .summary-grid {{ display: flex; gap: 16px; margin: 16px 0; }}
            .summary-card {{ padding: 12px 20px; border-radius: 8px; color: white; font-weight: 600; }}
            .summary-card.red {{ background: #ef4444; }}
            .summary-card.yellow {{ background: #eab308; }}
            .summary-card.green {{ background: #22c55e; }}
            .summary-card .count {{ font-size: 28px; }}
            .summary-card .label {{ font-size: 12px; opacity: 0.9; }}
        </style>
    </head>
    <body>
        <h1>Iceberg Threat Assessment Report</h1>
        <p class="subtitle">2026 MATE ROV Competition &mdash; Generated {now}</p>

        <h2>Threat Summary</h2>
        <div class="summary-grid">
            <div class="summary-card red">
                <div class="count">{total['red']}</div>
                <div class="label">RED THREATS</div>
            </div>
            <div class="summary-card yellow">
                <div class="count">{total['yellow']}</div>
                <div class="label">YELLOW THREATS</div>
            </div>
            <div class="summary-card green">
                <div class="count">{total['green']}</div>
                <div class="label">GREEN THREATS</div>
            </div>
        </div>

        <h2>Detailed Assessment</h2>
        <table>
            <thead>
                <tr>
                    <th>Iceberg</th>
                    <th>Platform</th>
                    <th>Platform Threat</th>
                    <th>Distance</th>
                    <th>Subsea Threat</th>
                    <th>Note</th>
                </tr>
            </thead>
            <tbody>{rows}</tbody>
        </table>

        <h2>Platforms</h2>
        <table>
            <thead>
                <tr><th>Name</th><th>Latitude</th><th>Longitude</th><th>Depth (m)</th></tr>
            </thead>
            <tbody>
                {''.join(f'<tr><td>{escape(p["name"])}</td><td>{_format_coordinate(p["latitude"], "lat")}</td><td>{_format_coordinate(p["longitude"], "lon")}</td><td>{p["depth_m"]}</td></tr>' for p in platforms)}
            </tbody>
        </table>

        <h2>Icebergs Analyzed ({len(icebergs)})</h2>
        <table>
            <thead>
                <tr><th>Name</th><th>Latitude</th><th>Longitude</th><th>Heading</th><th>Keel Depth (m)</th></tr>
            </thead>
            <tbody>
                {''.join(f'<tr><td>{escape(ib["name"])}</td><td>{_format_coordinate(ib["latitude"], "lat")}</td><td>{_format_coordinate(ib["longitude"], "lon")}</td><td>{ib["heading"]}°</td><td>{ib["keel_depth_m"]}</td></tr>' for ib in icebergs)}
            </tbody>
        </table>

        <div class="graph-section">
            <h2>Operations Graph</h2>
            <div class="graph-panel">
                <p class="graph-copy">Latitude/longitude plot of the current iceberg positions, fixed platforms, and projected heading lines.</p>
                <div class="graph-svg">{graph_svg}</div>
            </div>
        </div>
    </body>
    </html>
    """
    return html


def _format_frequency_value(value):
    if not value:
        return "0"
    return f"{value:.9f}".rstrip("0").rstrip(".")


def _build_frequency_report_html(species, counts):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    total_seen = sum(counts)

    rows = ""
    for item, count in zip(species, counts):
        frequency = (count / total_seen) if total_seen > 0 else 0
        species_label = f"{escape(item['name'])} (<em>{escape(item['scientific_name'])}</em>)"
        rows += f"""
            <tr>
                <td>{species_label}</td>
                <td class=\"number\">{count}</td>
                <td class=\"number\">{_format_frequency_value(frequency)}</td>
            </tr>"""

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset=\"utf-8\">
        <style>
            @page {{
                size: A4;
                margin: 20mm;
            }}

            body {{
                font-family: Arial, Helvetica, sans-serif;
                color: #111111;
                margin: 0;
                font-size: 12pt;
            }}

            h1 {{
                margin: 0 0 6px 0;
                font-size: 19pt;
            }}

            .subtitle {{
                margin: 0 0 14px 0;
                color: #333333;
                font-size: 10pt;
            }}

            table {{
                width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
            }}

            th,
            td {{
                border: 2px solid #000000;
                padding: 8px 10px;
                vertical-align: middle;
                word-wrap: break-word;
            }}

            th {{
                background: #ffffff;
                font-size: 12pt;
                text-align: left;
            }}

            td.number {{
                text-align: center;
                width: 18%;
            }}

            .footer {{
                margin-top: 10px;
                font-size: 10pt;
                color: #333333;
            }}
        </style>
    </head>
    <body>
        <h1>Frequency Mission Report</h1>
        <p class=\"subtitle\">Generated {now}</p>

        <table>
            <thead>
                <tr>
                    <th style=\"width: 64%;\">Species</th>
                    <th style=\"width: 18%; text-align: center;\">Number Seen</th>
                    <th style=\"width: 18%; text-align: center;\">% frequency</th>
                </tr>
            </thead>
            <tbody>
                {rows}
            </tbody>
        </table>

        <p class=\"footer\">Total Seen: {total_seen}</p>
    </body>
    </html>
    """

    return html
