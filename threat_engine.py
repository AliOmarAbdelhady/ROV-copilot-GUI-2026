import math
from config import (
    PLATFORMS,
    THREAT_GREEN_THRESHOLD,
    THREAT_YELLOW_THRESHOLD,
    SUBSEA_INTERSECTION_THRESHOLD_NM,
    SUBSEA_GROUNDING_RATIO,
    SUBSEA_RED_RATIO,
    SUBSEA_YELLOW_RATIO,
    NM_IN_METERS,
    EARTH_RADIUS_M,
)


def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance in meters between two lat/lon points using Haversine formula."""
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    return EARTH_RADIUS_M * c


def distance_nm(pos1, pos2):
    """Distance in nautical miles between two {latitude, longitude} dicts."""
    m = haversine(pos1["latitude"], pos1["longitude"], pos2["latitude"], pos2["longitude"])
    return m / NM_IN_METERS


def bearing_from_to(pos1, pos2):
    """Initial bearing in degrees from pos1 to pos2."""
    lat1 = math.radians(pos1["latitude"])
    lat2 = math.radians(pos2["latitude"])
    dlon = math.radians(pos2["longitude"] - pos1["longitude"])
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def destination_point(lat, lon, bearing_deg, distance_nm_val):
    """Calculate destination point given start, bearing, and distance in nm."""
    dist_m = distance_nm_val * NM_IN_METERS
    d = dist_m / EARTH_RADIUS_M
    brng = math.radians(bearing_deg)
    lat1 = math.radians(lat)
    lon1 = math.radians(lon)
    lat2 = math.asin(
        math.sin(lat1) * math.cos(d) + math.cos(lat1) * math.sin(d) * math.cos(brng)
    )
    lon2 = lon1 + math.atan2(
        math.sin(brng) * math.sin(d) * math.cos(lat1),
        math.cos(d) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lat2), math.degrees(lon2)


def angular_difference(a, b):
    """Smallest angle difference between two bearings in degrees."""
    diff = (a - b + 180) % 360 - 180
    return abs(diff)


def closest_approach_metrics(iceberg, platform):
    """
    Return forward-track geometry between the iceberg and a platform.

    The competition treats the iceberg track as a forward heading line from the
    observed point. If the perpendicular intersection falls behind the iceberg,
    the closest approach is the direct distance instead.
    """
    direct_distance = distance_nm(iceberg, platform)
    bearing_to_platform = bearing_from_to(iceberg, platform)
    angle_diff = angular_difference(iceberg["heading"], bearing_to_platform)

    if direct_distance == 0:
        return {
            "closest_distance_nm": 0.0,
            "direct_distance_nm": 0.0,
            "bearing_to_platform_deg": bearing_to_platform,
            "angle_diff_deg": angle_diff,
            "along_track_distance_nm": 0.0,
            "intersects_forward": True,
        }

    angular_distance = (direct_distance * NM_IN_METERS) / EARTH_RADIUS_M
    track_bearing = math.radians(iceberg["heading"])
    platform_bearing = math.radians(bearing_to_platform)

    cross_track = math.asin(
        max(-1.0, min(1.0, math.sin(angular_distance) * math.sin(platform_bearing - track_bearing)))
    )
    along_track = math.atan2(
        math.sin(angular_distance) * math.cos(platform_bearing - track_bearing),
        math.cos(angular_distance),
    )

    if along_track < 0:
        closest_distance = direct_distance
        along_track_nm = -direct_distance
        intersects_forward = False
    else:
        closest_distance = abs(cross_track) * EARTH_RADIUS_M / NM_IN_METERS
        along_track_nm = along_track * EARTH_RADIUS_M / NM_IN_METERS
        intersects_forward = True

    return {
        "closest_distance_nm": closest_distance,
        "direct_distance_nm": direct_distance,
        "bearing_to_platform_deg": bearing_to_platform,
        "angle_diff_deg": angle_diff,
        "along_track_distance_nm": along_track_nm,
        "intersects_forward": intersects_forward,
    }


def classify_threat(distance):
    """Classify threat level based on distance in nautical miles."""
    if distance < THREAT_YELLOW_THRESHOLD:
        return "red"
    elif distance <= THREAT_GREEN_THRESHOLD:
        return "yellow"
    return "green"


def platform_threat(iceberg, platform):
    """Determine surface platform threat level using the competition rules."""
    metrics = closest_approach_metrics(iceberg, platform)
    depth_ratio = iceberg["keel_depth_m"] / platform["depth_m"] if platform["depth_m"] > 0 else 0
    raw_level = classify_threat(metrics["closest_distance_nm"])

    if depth_ratio >= SUBSEA_GROUNDING_RATIO:
        note = "iceberg will ground" if raw_level != "green" else ""
        return "green", metrics, note

    return raw_level, metrics, ""


def subsea_threat(iceberg, platform):
    """
    Determine subsea asset threat level using the 2026 competition rules.

    Any track farther than 25 nm from a platform is not considered a subsea
    intersection. For intersecting tracks, keel-to-depth ratio drives the level.
    """
    metrics = closest_approach_metrics(iceberg, platform)
    depth_ratio = iceberg["keel_depth_m"] / platform["depth_m"] if platform["depth_m"] > 0 else 0
    notes = []

    if metrics["closest_distance_nm"] > SUBSEA_INTERSECTION_THRESHOLD_NM:
        notes.append("does not intersect")

    if depth_ratio >= SUBSEA_GROUNDING_RATIO:
        notes.append("iceberg will ground")

    if metrics["closest_distance_nm"] > SUBSEA_INTERSECTION_THRESHOLD_NM or depth_ratio >= SUBSEA_GROUNDING_RATIO:
        return "green", " / ".join(notes), metrics

    if depth_ratio >= SUBSEA_RED_RATIO:
        return "red", "", metrics

    if depth_ratio >= SUBSEA_YELLOW_RATIO:
        return "yellow", "", metrics

    return "green", "insufficient keel depth", metrics


def predict_trajectory_points(iceberg, distance_nm_max=120, step_nm=2):
    """Generate trajectory points along iceberg heading."""
    points = []
    steps = int(distance_nm_max / step_nm)
    for i in range(steps + 1):
        dist = i * step_nm
        lat, lon = destination_point(
            iceberg["latitude"], iceberg["longitude"], iceberg["heading"], dist
        )
        points.append({"lat": lat, "lon": lon, "distance_nm": dist})
    return points


def assess_all_threats(icebergs, platforms=None):
    """Run full threat assessment. Returns structured results."""
    if platforms is None:
        platforms = PLATFORMS

    results = []
    for iceberg in icebergs:
        iceberg_result = {
            "iceberg": iceberg,
            "platform_threats": {},
            "subsea_threats": {},
        }
        for platform in platforms:
            p_threat, metrics, p_note = platform_threat(iceberg, platform)
            s_threat, s_note, subsea_metrics = subsea_threat(iceberg, platform)
            iceberg_result["platform_threats"][platform["id"]] = {
                "level": p_threat,
                "distance_nm": round(metrics["closest_distance_nm"], 2),
                "direct_distance_nm": round(metrics["direct_distance_nm"], 2),
                "bearing_deg": round(metrics["bearing_to_platform_deg"], 2),
                "angle_diff_deg": round(metrics["angle_diff_deg"], 2),
                "along_track_distance_nm": round(metrics["along_track_distance_nm"], 2),
                "intersects_forward": metrics["intersects_forward"],
                "note": p_note,
                "platform_name": platform["name"],
            }
            iceberg_result["subsea_threats"][platform["id"]] = {
                "level": s_threat,
                "note": s_note,
                "distance_nm": round(subsea_metrics["closest_distance_nm"], 2),
                "intersects_zone": subsea_metrics["closest_distance_nm"] <= SUBSEA_INTERSECTION_THRESHOLD_NM,
                "platform_name": platform["name"],
            }
        results.append(iceberg_result)
    return results


def threat_summary(results):
    """Aggregate threat counts for dashboard."""
    summary = {"red": 0, "yellow": 0, "green": 0}
    per_platform = {p["id"]: {"name": p["name"], "red": 0, "yellow": 0, "green": 0} for p in PLATFORMS}

    for r in results:
        for pid, threat in r["platform_threats"].items():
            level = threat["level"]
            summary[level] += 1
            per_platform[pid][level] += 1

    return {"total": summary, "per_platform": per_platform}
