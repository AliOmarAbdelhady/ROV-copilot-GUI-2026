import csv
import io
import uuid
from datetime import datetime, timezone

from flask import Flask, jsonify, render_template, request, Response

from config import PLATFORMS, EXAMPLE_ICEBERGS, MAP_CENTER, MAP_ZOOM
from threat_engine import assess_all_threats, threat_summary, predict_trajectory_points
from export import generate_pdf, generate_csv

app = Flask(__name__)

custom_icebergs = []


def all_icebergs():
    return EXAMPLE_ICEBERGS + custom_icebergs


@app.route("/")
def index():
    return render_template("index.html", map_center=MAP_CENTER, map_zoom=MAP_ZOOM)


@app.route("/api/platforms", methods=["GET"])
def get_platforms():
    return jsonify(PLATFORMS)


@app.route("/api/icebergs", methods=["GET"])
def get_icebergs():
    return jsonify(all_icebergs())


@app.route("/api/icebergs", methods=["POST"])
def add_iceberg():
    data = request.get_json()
    errors = []

    try:
        lat = float(data.get("latitude", 0))
        if not -90 <= lat <= 90:
            errors.append("Latitude must be between -90 and 90")
    except (TypeError, ValueError):
        errors.append("Invalid latitude value")

    try:
        lon = float(data.get("longitude", 0))
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
        "is_example": False,
    }
    custom_icebergs.append(iceberg)
    return jsonify(iceberg), 201


@app.route("/api/icebergs/<iceberg_id>", methods=["DELETE"])
def delete_iceberg(iceberg_id):
    global custom_icebergs
    before = len(custom_icebergs)
    custom_icebergs = [ib for ib in custom_icebergs if ib["id"] != iceberg_id]
    if len(custom_icebergs) == before:
        return jsonify({"error": "Iceberg not found"}), 404
    return jsonify({"status": "deleted"})


@app.route("/api/threats", methods=["GET"])
def get_threats():
    icebergs = all_icebergs()
    results = assess_all_threats(icebergs, PLATFORMS)
    summary = threat_summary(results)
    return jsonify({"results": results, "summary": summary})


@app.route("/api/trajectory/<iceberg_id>", methods=["GET"])
def get_trajectory(iceberg_id):
    icebergs = all_icebergs()
    iceberg = next((ib for ib in icebergs if ib["id"] == iceberg_id), None)
    if not iceberg:
        return jsonify({"error": "Iceberg not found"}), 404
    points = predict_trajectory_points(iceberg)
    return jsonify({"iceberg_id": iceberg_id, "points": points})


@app.route("/api/export/pdf", methods=["GET"])
def export_pdf():
    icebergs = all_icebergs()
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
    icebergs = all_icebergs()
    results = assess_all_threats(icebergs, PLATFORMS)
    csv_str = generate_csv(results)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return Response(
        csv_str,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename=threat_report_{timestamp}.csv"},
    )


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
