import uuid
from datetime import datetime, timezone

from flask import Flask, jsonify, render_template, request, Response

from config import FREQUENCY_SPECIES, PLATFORMS, MAP_CENTER, MAP_ZOOM
from threat_engine import assess_all_threats, threat_summary, predict_trajectory_points
from export import generate_pdf, generate_csv, generate_frequency_pdf

app = Flask(__name__)

icebergs = []


def normalize_latitude(value, hemisphere=None):
    """Normalize latitude using an optional hemisphere marker."""
    latitude = float(value)
    if hemisphere:
        hemisphere = hemisphere.strip().upper()
        if hemisphere == "S":
            return -abs(latitude)
        if hemisphere == "N":
            return abs(latitude)
    return latitude


def normalize_longitude(value, hemisphere=None):
    """
    Normalize longitude for the competition operating area.

    The provided PDFs use west longitudes. If no hemisphere is supplied, a
    positive longitude is treated as west so PDF examples can be entered
    directly as `48.6167` instead of `-48.6167`.
    """
    longitude = float(value)
    if hemisphere:
        hemisphere = hemisphere.strip().upper()
        if hemisphere == "W":
            return -abs(longitude)
        if hemisphere == "E":
            return abs(longitude)
    return -abs(longitude) if longitude > 0 else longitude


def canonicalize_iceberg(iceberg):
    """Keep stored iceberg coordinates aligned with the competition region."""
    iceberg["latitude"] = normalize_latitude(iceberg["latitude"], iceberg.get("latitude_hemisphere"))
    iceberg["longitude"] = normalize_longitude(iceberg["longitude"], iceberg.get("longitude_hemisphere"))
    iceberg.pop("latitude_hemisphere", None)
    iceberg.pop("longitude_hemisphere", None)
    return iceberg


@app.route("/")
def index():
    return render_template(
        "index.html",
        active_page="dashboard",
        map_center=MAP_CENTER,
        map_zoom=MAP_ZOOM,
        show_export_buttons=True,
    )


@app.route("/frequency")
def frequency():
    return render_template(
        "frequency.html",
        active_page="frequency",
        frequency_species=FREQUENCY_SPECIES,
        show_export_buttons=False,
    )


@app.route("/api/platforms", methods=["GET"])
def get_platforms():
    return jsonify(PLATFORMS)


@app.route("/api/icebergs", methods=["GET"])
def get_icebergs():
    for iceberg in icebergs:
        canonicalize_iceberg(iceberg)
    return jsonify(icebergs)


@app.route("/api/icebergs", methods=["POST"])
def add_iceberg():
    data = request.get_json()
    errors = []

    try:
        lat = normalize_latitude(data.get("latitude", 0), data.get("latitude_hemisphere"))
        if not -90 <= lat <= 90:
            errors.append("Latitude must be between -90 and 90")
    except (TypeError, ValueError):
        errors.append("Invalid latitude value")

    try:
        lon = normalize_longitude(data.get("longitude", 0), data.get("longitude_hemisphere"))
        if not -180 <= lon <= 180:
            errors.append("Longitude must be between -180 and 180")
    except (TypeError, ValueError):
        errors.append("Invalid longitude value")

    try:
        heading = float(data.get("heading", 0))
        if not 0 <= heading <= 360:
            errors.append("Heading must be between 0 and 360")
    except (TypeError, ValueError):
        errors.append("Invalid heading value")

    try:
        keel = float(data.get("keel_depth_m", 0))
        if keel <= 0:
            errors.append("Keel depth must be positive")
    except (TypeError, ValueError):
        errors.append("Invalid keel depth value")

    name = data.get("name", "").strip()
    if not name:
        errors.append("Name is required")

    if errors:
        return jsonify({"errors": errors}), 400

    iceberg = {
        "id": str(uuid.uuid4())[:8],
        "name": name,
        "latitude": lat,
        "longitude": lon,
        "heading": heading,
        "keel_depth_m": keel,
    }
    icebergs.append(canonicalize_iceberg(iceberg))
    return jsonify(iceberg), 201


@app.route("/api/icebergs/<iceberg_id>", methods=["DELETE"])
def delete_iceberg(iceberg_id):
    global icebergs
    before = len(icebergs)
    icebergs = [ib for ib in icebergs if ib["id"] != iceberg_id]
    if len(icebergs) == before:
        return jsonify({"error": "Iceberg not found"}), 404
    return jsonify({"status": "deleted"})


@app.route("/api/threats", methods=["GET"])
def get_threats():
    for iceberg in icebergs:
        canonicalize_iceberg(iceberg)
    results = assess_all_threats(icebergs, PLATFORMS)
    summary = threat_summary(results)
    return jsonify({"results": results, "summary": summary})


@app.route("/api/trajectory/<iceberg_id>", methods=["GET"])
def get_trajectory(iceberg_id):
    iceberg = next((ib for ib in icebergs if ib["id"] == iceberg_id), None)
    if not iceberg:
        return jsonify({"error": "Iceberg not found"}), 404
    canonicalize_iceberg(iceberg)
    points = predict_trajectory_points(iceberg)
    return jsonify({"iceberg_id": iceberg_id, "points": points})


@app.route("/api/export/pdf", methods=["GET"])
def export_pdf():
    for iceberg in icebergs:
        canonicalize_iceberg(iceberg)
    results = assess_all_threats(icebergs, PLATFORMS)
    summary = threat_summary(results)
    pdf_bytes = generate_pdf(results, summary, PLATFORMS, icebergs)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=threat_report_{timestamp}.pdf"},
    )


@app.route("/api/export/csv", methods=["GET"])
def export_csv():
    for iceberg in icebergs:
        canonicalize_iceberg(iceberg)
    results = assess_all_threats(icebergs, PLATFORMS)
    csv_str = generate_csv(results)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return Response(
        csv_str,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename=threat_report_{timestamp}.csv"},
    )


@app.route("/api/frequency/export/pdf", methods=["POST"])
def export_frequency_pdf():
    data = request.get_json(silent=True) or {}
    raw_counts = data.get("counts", [])

    if not isinstance(raw_counts, list):
        return jsonify({"error": "counts must be an array"}), 400

    if len(raw_counts) != len(FREQUENCY_SPECIES):
        return jsonify({"error": f"counts must contain exactly {len(FREQUENCY_SPECIES)} values"}), 400

    counts = []
    for value in raw_counts:
        try:
            count = int(value)
            if count < 0:
                raise ValueError
        except (TypeError, ValueError):
            return jsonify({"error": "counts must contain only non-negative integers"}), 400
        counts.append(count)

    pdf_bytes = generate_frequency_pdf(FREQUENCY_SPECIES, counts)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=frequency_report_{timestamp}.pdf"},
    )


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
