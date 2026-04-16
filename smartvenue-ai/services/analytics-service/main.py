"""
SmartVenue AI — Analytics Service
Receives app events via Pub/Sub push and streams them to BigQuery.
Also exposes summary endpoints for the Ops Dashboard.
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List
import uuid

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.cloud import bigquery
import firebase_admin
from firebase_admin import credentials, firestore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("analytics-service")

# ── Firebase ──────────────────────────────────────────────────────────────────
_key = os.environ.get("FIREBASE_KEY", "{}")
try:
    key_dict = json.loads(_key)
    if key_dict.get("project_id"):
        firebase_admin.initialize_app(credentials.Certificate(key_dict))
    else:
        firebase_admin.initialize_app()
except Exception:
    firebase_admin.initialize_app()

db = firestore.client()

# ── BigQuery ──────────────────────────────────────────────────────────────────
PROJECT_ID = os.environ.get("PROJECT_ID", "smartvenue-ai")
BQ_DATASET = os.environ.get("BQ_DATASET", "smartvenue_analytics")
bq_client  = bigquery.Client(project=PROJECT_ID)

def stream_to_bq(table_id: str, rows: list):
    """Stream rows to BigQuery table."""
    table_ref = f"{PROJECT_ID}.{BQ_DATASET}.{table_id}"
    errors = bq_client.insert_rows_json(table_ref, rows)
    if errors:
        logger.error(f"BigQuery insert errors for {table_id}: {errors}")
    else:
        logger.info(f"Streamed {len(rows)} rows to {table_id}")

# ── FastAPI ───────────────────────────────────────────────────────────────────
app = FastAPI(title="SmartVenue Analytics Service", version="1.0.0")

# Configure CORS with specific origins
allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")
allowed_origins = [o.strip() for o in allowed_origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

class PubSubMessage(BaseModel):
    message: dict
    subscription: Optional[str] = None

# ── POST /internal/ingest ─────────────────────────────────────────────────────
# Pub/Sub push subscription handler — receives all app-events
@app.post("/internal/ingest")
async def ingest_event(payload: PubSubMessage):
    try:
        msg = payload.message

        # Decode base64 Pub/Sub data
        import base64
        data_b64 = msg.get("data", "")
        if data_b64:
            raw = json.loads(base64.b64decode(data_b64).decode())
        else:
            return {"status": "skipped"}

        event_type = raw.get("eventType", "unknown")
        now        = datetime.now(timezone.utc).isoformat()

        # Route to appropriate BQ table
        if event_type in ("gps_ping", "gate_checkin", "queue_join", "staff_zone_report"):
            stream_to_bq("app_events", [{
                "event_id":   raw.get("eventId") or str(uuid.uuid4()),
                "event_type": event_type,
                "user_id":    raw.get("userId"),
                "venue_id":   raw.get("venueId", ""),
                "zone_id":    raw.get("zoneId"),
                "lat":        raw.get("lat"),
                "lng":        raw.get("lng"),
                "metadata":   json.dumps({k: v for k, v in raw.items()
                                          if k not in ("eventId","eventType","userId","venueId","zoneId","lat","lng","timestamp")}),
                "timestamp":  raw.get("timestamp") or now,
            }])

        elif event_type == "order_placed":
            stream_to_bq("order_history", [{
                "order_id":     raw.get("orderId", str(uuid.uuid4())),
                "user_id":      raw.get("userId"),
                "venue_id":     raw.get("venueId", ""),
                "stand_id":     raw.get("standId"),
                "items":        json.dumps(raw.get("items", [])),
                "total_amount": raw.get("totalAmount", 0),
                "status":       "confirmed",
                "created_at":   now,
                "ready_at":     None,
            }])

        logger.info(f"Ingested event: {event_type}")
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Ingest error: {e}")
        return {"status": "error", "detail": str(e)}

# ── POST /api/analytics/crowd-density ────────────────────────────────────────
# crowd-service calls this to persist density snapshots
class DensitySnapshot(BaseModel):
    venue_id: str
    zone_id:  str
    density_score: float
    occupancy_count: Optional[int] = None
    status: Optional[str] = None

@app.post("/api/analytics/crowd-density")
async def record_density(snap: DensitySnapshot):
    stream_to_bq("crowd_density_history", [{
        "venue_id":        snap.venue_id,
        "zone_id":         snap.zone_id,
        "density_score":   snap.density_score,
        "occupancy_count": snap.occupancy_count,
        "status":          snap.status,
        "recorded_at":     datetime.now(timezone.utc).isoformat(),
    }])
    return {"success": True}

# ── GET /api/analytics/venue/:venue_id/summary ────────────────────────────────
@app.get("/api/analytics/venue/{venue_id}/summary")
async def venue_summary(venue_id: str):
    """Returns today's event summary for the Ops Dashboard."""
    try:
        query = f"""
        SELECT
          event_type,
          COUNT(*) AS count,
          DATE(timestamp) AS event_date
        FROM `{PROJECT_ID}.{BQ_DATASET}.app_events`
        WHERE venue_id = @venue_id
          AND DATE(timestamp) = CURRENT_DATE()
        GROUP BY event_type, event_date
        ORDER BY count DESC
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[bigquery.ScalarQueryParameter("venue_id", "STRING", venue_id)]
        )
        result = bq_client.query(query, job_config=job_config).result()
        rows = [dict(row) for row in result]
        return {"venue_id": venue_id, "summary": rows}
    except Exception as e:
        logger.error(f"BQ query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── GET /api/analytics/venue/:venue_id/queue-stats ────────────────────────────
@app.get("/api/analytics/venue/{venue_id}/queue-stats")
async def queue_stats(venue_id: str):
    try:
        query = f"""
        SELECT
          amenity_id,
          amenity_name,
          COUNT(*) AS total_served,
          AVG(actual_wait) AS avg_wait_mins,
          MAX(actual_wait) AS max_wait_mins
        FROM `{PROJECT_ID}.{BQ_DATASET}.queue_history`
        WHERE venue_id = @venue_id
          AND DATE(joined_at) = CURRENT_DATE()
          AND actual_wait IS NOT NULL
        GROUP BY amenity_id, amenity_name
        ORDER BY avg_wait_mins DESC
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[bigquery.ScalarQueryParameter("venue_id", "STRING", venue_id)]
        )
        result = bq_client.query(query, job_config=job_config).result()
        rows = [dict(row) for row in result]
        return {"venue_id": venue_id, "queue_stats": rows}
    except Exception as e:
        logger.error(f"BQ queue stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "healthy", "service": "analytics-service"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, log_level="info")
