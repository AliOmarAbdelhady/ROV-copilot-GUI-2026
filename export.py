import csv
import io
from datetime import datetime, timezone


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


def _threat_badge(level):
    colors = {"red": "#ef4444", "yellow": "#eab308", "green": "#22c55e"}
    color = colors.get(level, "#6b7280")
    return (
        f'<span style="background:{color};color:white;padding:2px 10px;'
        f'border-radius:4px;font-weight:600;font-size:12px;">'
        f"{level.upper()}</span>"
    )


def _build_report_html(results, summary, platforms, icebergs):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    rows = ""
    for r in results:
        iceberg_name = r["iceberg"]["name"]
        for pid, pt in r["platform_threats"].items():
            st = r["subsea_threats"][pid]
            rows += f"""
            <tr>
                <td>{iceberg_name}</td>
                <td>{pt['platform_name']}</td>
                <td>{_threat_badge(pt['level'])}</td>
                <td>{pt['distance_nm']} nm</td>
                <td>{_threat_badge(st['level'])}</td>
                <td>{st['note']}</td>
            </tr>"""

    total = summary["total"]
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; color: #1e293b; }}
            h1 {{ font-size: 24px; margin-bottom: 4px; }}
            h2 {{ font-size: 18px; margin-top: 30px; color: #475569; }}
            .subtitle {{ color: #64748b; font-size: 14px; margin-bottom: 24px; }}
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
                {''.join(f'<tr><td>{p["name"]}</td><td>{p["latitude"]}</td><td>{p["longitude"]}</td><td>{p["depth_m"]}</td></tr>' for p in platforms)}
            </tbody>
        </table>

        <h2>Icebergs Analyzed ({len(icebergs)})</h2>
        <table>
            <thead>
                <tr><th>Name</th><th>Latitude</th><th>Longitude</th><th>Heading</th><th>Keel Depth (m)</th></tr>
            </thead>
            <tbody>
                {''.join(f'<tr><td>{ib["name"]}</td><td>{ib["latitude"]}</td><td>{ib["longitude"]}</td><td>{ib["heading"]}°</td><td>{ib["keel_depth_m"]}</td></tr>' for ib in icebergs)}
            </tbody>
        </table>
    </body>
    </html>
    """
    return html
