"""
SmartVenue AI — Crowd Service
Aggregates GPS pings + staff zone reports, runs Vertex AI predictions,
and writes crowd state to Firestore + publishes alerts.
"""

import os
import json
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud import pubsub_v1
from google.cloud import aiplatform

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("crowd-service")

# ── Firebase Init ─────────────────────────────────────────────────────────────
_firebase_key = os.environ.get("FIREBASE_KEY", "{}")
try:
    key_dict = json.loads(_firebase_key)
    if key_dict.get("project_id"):
        cred = credentials.Certificate(key_dict)
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()
except Exception:
    firebase_admin.initialize_app()

db = firestore.client()

# ── GCP Config ────────────────────────────────────────────────────────────────
PROJECT_ID = os.environ.get("PROJECT_ID", "smartvenue-ai")
REGION     = os.environ.get("REGION", "us-central1")

publisher  = pubsub_v1.PublisherClient()
CROWD_ALERTS_TOPIC = f"projects/{PROJECT_ID}/topics/crowd-alerts"
APP_EVENTS_TOPIC   = f"projects/{PROJECT_ID}/topics/app-events"

# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(title="SmartVenue Crowd Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Models ────────────────────────────────────────────────────────────────────
class ZoneStatusReport(BaseModel):
    venue_id: str
    zone_id:  str
    staff_id: str
    status:   str   # "clear" | "busy" | "critical"
    note:     Optional[str] = None

class GPSEvent(BaseModel):
    venue_id:  str
    zone_id:   Optional[str] = None
    lat:       float = Field(..., ge=-90, le=90)
    lng:       float = Field(..., ge=-180, le=180)
    timestamp: str

# In-memory sliding window for zone GPS counts
# zone_id -> list of timestamps
_zone_counts: dict = {}

def _prune_window(zone_id: str, window_secs: int = 60):
    """Keep only the last `window_secs` seconds of pings."""
    now = datetime.now(timezone.utc).timestamp()
    if zone_id in _zone_counts:
        _zone_counts[zone_id] = [t for t in _zone_counts[zone_id] if now - t < window_secs]

# ── Helpers ───────────────────────────────────────────────────────────────────
def _compute_density(count: int, capacity: int = 500) -> float:
    """Return 0.0–1.0 density score."""
    return min(1.0, count / capacity)

def _density_to_status(score: float) -> str:
    if score < 0.4: return "clear"
    if score < 0.7: return "busy"
    return "critical"

async def _write_zone_state(venue_id: str, zone_id: str, density: float,
                            count: int, status: str, staff_override: Optional[str] = None):
    """Write or merge zone state into Firestore."""
    zone_ref = (db.collection("venues").document(venue_id)
                  .collection("zones").document(zone_id))
    payload = {
        "densityScore":    density,
        "occupancyCount":  count,
        "status":          staff_override or status,
        "lastUpdated":     datetime.now(timezone.utc).isoformat(),
    }
    zone_ref.set(payload, merge=True)

async def _publish_alert(venue_id: str, zone_id: str, status: str, density: float):
    """Publish crowd alert to Pub/Sub if threshold exceeded."""
    alert = {
        "alertId":     f"{zone_id}-{int(datetime.now().timestamp())}",
        "venueId":     venue_id,
        "zoneId":      zone_id,
        "severity":    "red" if status == "critical" else "amber",
        "densityScore": density,
        "message":     f"Zone {zone_id} is {status} (density {density:.2f})",
        "timestamp":   datetime.now(timezone.utc).isoformat(),
    }
    publisher.publish(CROWD_ALERTS_TOPIC, json.dumps(alert).encode())
    logger.info(f"Alert published: zone={zone_id} status={status}")

async def _call_vertex_ai(venue_id: str, zone_densities: dict) -> dict:
    """
    Call Vertex AI Crowd Flow Predictor endpoint.
    Returns {zone_id: predicted_density_in_15_min}
    Falls back to current densities if endpoint not configured.
    """
    endpoint_id = os.environ.get("VERTEX_ENDPOINT_ID")
    if not endpoint_id:
        logger.warning("VERTEX_ENDPOINT_ID not set — using rule-based fallback")
        return {z: min(1.0, d * 1.1) for z, d in zone_densities.items()}

    try:
        aiplatform.init(project=PROJECT_ID, location=REGION)
        endpoint = aiplatform.Endpoint(endpoint_name=endpoint_id)
        instances = [{"zone_id": z, "density": d} for z, d in zone_densities.items()]
        response = endpoint.predict(instances=instances)
        predictions = response.predictions
        return {inst["zone_id"]: pred for inst, pred in zip(instances, predictions)}
    except Exception as e:
        logger.error(f"Vertex AI call failed: {e}")
        return zone_densities

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "healthy", "service": "crowd-service"}


@app.post("/api/crowd/gps-event")
async def receive_gps_event(event: GPSEvent, background_tasks: BackgroundTasks):
    """Ingest a GPS ping from the Attendee App (already anonymised by attendee-api)."""
    zone_id = event.zone_id or "unknown"

    if zone_id not in _zone_counts:
        _zone_counts[zone_id] = []
    _zone_counts[zone_id].append(datetime.now(timezone.utc).timestamp())
    _prune_window(zone_id)

    count   = len(_zone_counts[zone_id])
    density = _compute_density(count)
    status  = _density_to_status(density)

    background_tasks.add_task(
        _write_zone_state, event.venue_id, zone_id, density, count, status
    )

    if status in ("busy", "critical"):
        background_tasks.add_task(
            _publish_alert, event.venue_id, zone_id, status, density
        )

    return {"success": True, "zone": zone_id, "density": density, "status": status}


@app.post("/api/crowd/zone-report")
async def staff_zone_report(report: ZoneStatusReport, background_tasks: BackgroundTasks):
    """Staff reports zone condition manually via Staff PWA."""
    density_map = {"clear": 0.3, "busy": 0.65, "critical": 0.9}
    density = density_map.get(report.status, 0.5)
    count   = int(density * 500)

    background_tasks.add_task(
        _write_zone_state,
        report.venue_id, report.zone_id,
        density, count, report.status,
        staff_override=report.status
    )

    if report.status == "critical":
        background_tasks.add_task(
            _publish_alert, report.venue_id, report.zone_id, report.status, density
        )

    # Publish to app-events for analytics
    publisher.publish(APP_EVENTS_TOPIC, json.dumps({
        "eventType": "staff_zone_report",
        "venueId":   report.venue_id,
        "zoneId":    report.zone_id,
        "status":    report.status,
        "staffId":   report.staff_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }).encode())

    logger.info(f"Zone report: zone={report.zone_id} status={report.status} staff={report.staff_id}")
    return {"success": True, "zone": report.zone_id, "status": report.status}


@app.get("/api/crowd/venue/{venue_id}")
async def get_venue_crowd(venue_id: str):
    """Get current crowd state for all zones in a venue."""
    zones_ref = db.collection("venues").document(venue_id).collection("zones")
    docs = zones_ref.stream()
    zones = [{"id": doc.id, **doc.to_dict()} for doc in docs]
    return {"venueId": venue_id, "zones": zones, "count": len(zones)}


@app.post("/api/crowd/predict/{venue_id}")
async def predict_crowd(venue_id: str):
    """
    Call Vertex AI to get 15-minute ahead crowd predictions.
    Writes predictions to Firestore and publishes alerts for predicted critical zones.
    """
    zones_ref = db.collection("venues").document(venue_id).collection("zones")
    docs = {doc.id: doc.to_dict().get("densityScore", 0.0) for doc in zones_ref.stream()}

    if not docs:
        return {"message": "No zone data available for prediction", "predictions": {}}

    predictions = await _call_vertex_ai(venue_id, docs)

    # Write predictions back to Firestore
    for zone_id, predicted_density in predictions.items():
        zone_ref = (db.collection("venues").document(venue_id)
                      .collection("zones").document(zone_id))
        zone_ref.set({"predictedDensity15Min": predicted_density}, merge=True)

        # Alert if prediction crosses critical threshold
        if predicted_density >= 0.8:
            await _publish_alert(venue_id, zone_id, "critical", predicted_density)

    logger.info(f"Predictions updated for venue {venue_id}: {len(predictions)} zones")
    return {"venueId": venue_id, "predictions": predictions}


@app.get("/api/crowd/alerts/{venue_id}")
async def get_active_alerts(venue_id: str):
    """Get all active (unacknowledged) crowd alerts for a venue."""
    alerts_ref = (db.collection("venues").document(venue_id)
                    .collection("alerts")
                    .where("acknowledged", "==", False)
                    .order_by("timestamp", direction=firestore.Query.DESCENDING)
                    .limit(50))
    docs = alerts_ref.stream()
    alerts = [{"id": doc.id, **doc.to_dict()} for doc in docs]
    return {"venueId": venue_id, "alerts": alerts}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, log_level="info")
