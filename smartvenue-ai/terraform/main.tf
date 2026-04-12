terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ── ARTIFACT REGISTRY ─────────────────────────────────────────────────────────
resource "google_artifact_registry_repository" "smartvenue" {
  location      = var.region
  repository_id = "smartvenue-repo"
  description   = "SmartVenue AI Docker images"
  format        = "DOCKER"
}

# ── SERVICE ACCOUNT FOR CLOUD RUN ─────────────────────────────────────────────
resource "google_service_account" "cloudrun_sa" {
  account_id   = "smartvenue-run-sa"
  display_name = "SmartVenue Cloud Run Service Account"
}

locals {
  cloudrun_roles = [
    "roles/datastore.user",
    "roles/pubsub.publisher",
    "roles/pubsub.subscriber",
    "roles/bigquery.dataEditor",
    "roles/bigquery.jobUser",
    "roles/secretmanager.secretAccessor",
    "roles/aiplatform.user",
    "roles/cloudsql.client",
    "roles/redis.editor",
  ]
}

resource "google_project_iam_member" "cloudrun_sa_roles" {
  for_each = toset(local.cloudrun_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}

# ── FIRESTORE ─────────────────────────────────────────────────────────────────
resource "google_firestore_database" "smartvenue" {
  project     = var.project_id
  name        = "(default)"
  location_id = "nam5"
  type        = "FIRESTORE_NATIVE"

  concurrency_mode = "OPTIMISTIC"
  app_engine_integration_mode = "DISABLED"
}

# ── PUB/SUB TOPICS ────────────────────────────────────────────────────────────
resource "google_pubsub_topic" "app_events" {
  name = "app-events"
  message_retention_duration = "604800s" # 7 days
}

resource "google_pubsub_topic" "crowd_alerts" {
  name = "crowd-alerts"
  message_retention_duration = "86400s" # 1 day
}

resource "google_pubsub_topic" "order_events" {
  name = "order-events"
  message_retention_duration = "86400s"
}

resource "google_pubsub_topic" "staff_tasks" {
  name = "staff-tasks"
  message_retention_duration = "86400s"
}

# Subscriptions
resource "google_pubsub_subscription" "app_events_sub" {
  name  = "app-events-sub"
  topic = google_pubsub_topic.app_events.name
  ack_deadline_seconds = 60
  retain_acked_messages = false
  message_retention_duration = "86400s"
}

resource "google_pubsub_subscription" "crowd_alerts_sub" {
  name  = "crowd-alerts-sub"
  topic = google_pubsub_topic.crowd_alerts.name
  ack_deadline_seconds = 30
}

resource "google_pubsub_subscription" "order_events_sub" {
  name  = "order-events-sub"
  topic = google_pubsub_topic.order_events.name
  ack_deadline_seconds = 60
}

resource "google_pubsub_subscription" "staff_tasks_sub" {
  name  = "staff-tasks-sub"
  topic = google_pubsub_topic.staff_tasks.name
  ack_deadline_seconds = 30
}

# ── BIGQUERY ──────────────────────────────────────────────────────────────────
resource "google_bigquery_dataset" "smartvenue_analytics" {
  dataset_id  = "smartvenue_analytics"
  description = "SmartVenue AI event analytics and ML training data"
  location    = "US"

  delete_contents_on_destroy = false
}

resource "google_bigquery_table" "app_events" {
  dataset_id          = google_bigquery_dataset.smartvenue_analytics.dataset_id
  table_id            = "app_events"
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "timestamp"
  }

  schema = jsonencode([
    { name = "event_id",   type = "STRING",    mode = "REQUIRED" },
    { name = "event_type", type = "STRING",    mode = "REQUIRED" },
    { name = "user_id",    type = "STRING",    mode = "NULLABLE" },
    { name = "venue_id",   type = "STRING",    mode = "REQUIRED" },
    { name = "zone_id",    type = "STRING",    mode = "NULLABLE" },
    { name = "lat",        type = "FLOAT64",   mode = "NULLABLE" },
    { name = "lng",        type = "FLOAT64",   mode = "NULLABLE" },
    { name = "metadata",   type = "JSON",      mode = "NULLABLE" },
    { name = "timestamp",  type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

resource "google_bigquery_table" "queue_history" {
  dataset_id          = google_bigquery_dataset.smartvenue_analytics.dataset_id
  table_id            = "queue_history"
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "joined_at"
  }

  schema = jsonencode([
    { name = "queue_id",       type = "STRING",    mode = "REQUIRED" },
    { name = "amenity_id",     type = "STRING",    mode = "REQUIRED" },
    { name = "amenity_name",   type = "STRING",    mode = "NULLABLE" },
    { name = "user_id",        type = "STRING",    mode = "NULLABLE" },
    { name = "position",       type = "INTEGER",   mode = "NULLABLE" },
    { name = "wait_mins",      type = "FLOAT64",   mode = "NULLABLE" },
    { name = "actual_wait",    type = "FLOAT64",   mode = "NULLABLE" },
    { name = "joined_at",      type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "served_at",      type = "TIMESTAMP", mode = "NULLABLE" },
    { name = "venue_id",       type = "STRING",    mode = "REQUIRED" },
  ])
}

resource "google_bigquery_table" "crowd_density_history" {
  dataset_id          = google_bigquery_dataset.smartvenue_analytics.dataset_id
  table_id            = "crowd_density_history"
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "recorded_at"
  }

  schema = jsonencode([
    { name = "venue_id",        type = "STRING",    mode = "REQUIRED" },
    { name = "zone_id",         type = "STRING",    mode = "REQUIRED" },
    { name = "density_score",   type = "FLOAT64",   mode = "REQUIRED" },
    { name = "occupancy_count", type = "INTEGER",   mode = "NULLABLE" },
    { name = "status",          type = "STRING",    mode = "NULLABLE" },
    { name = "recorded_at",     type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

resource "google_bigquery_table" "order_history" {
  dataset_id          = google_bigquery_dataset.smartvenue_analytics.dataset_id
  table_id            = "order_history"
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "created_at"
  }

  schema = jsonencode([
    { name = "order_id",    type = "STRING",    mode = "REQUIRED" },
    { name = "user_id",     type = "STRING",    mode = "NULLABLE" },
    { name = "venue_id",    type = "STRING",    mode = "REQUIRED" },
    { name = "stand_id",    type = "STRING",    mode = "NULLABLE" },
    { name = "items",       type = "JSON",      mode = "NULLABLE" },
    { name = "total_amount",type = "FLOAT64",   mode = "NULLABLE" },
    { name = "status",      type = "STRING",    mode = "NULLABLE" },
    { name = "created_at",  type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "ready_at",    type = "TIMESTAMP", mode = "NULLABLE" },
  ])
}

# ── CLOUD SQL ─────────────────────────────────────────────────────────────────
resource "google_sql_database_instance" "smartvenue_db" {
  name             = "smartvenue-db"
  database_version = "POSTGRES_16"
  region           = var.region
  deletion_protection = false

  settings {
    tier = "db-g1-small"

    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"
      point_in_time_recovery_enabled = true
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.smartvenue_vpc.id
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }
  }

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

resource "google_sql_database" "smartvenue" {
  name     = "smartvenue"
  instance = google_sql_database_instance.smartvenue_db.name
}

# ── VPC NETWORK ───────────────────────────────────────────────────────────────
resource "google_compute_network" "smartvenue_vpc" {
  name                    = "smartvenue-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "smartvenue_subnet" {
  name          = "smartvenue-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.smartvenue_vpc.id
}

resource "google_compute_global_address" "private_ip_range" {
  name          = "smartvenue-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.smartvenue_vpc.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.smartvenue_vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

# ── CLOUD MEMORYSTORE (REDIS) ─────────────────────────────────────────────────
resource "google_redis_instance" "smartvenue_cache" {
  name           = "smartvenue-cache"
  memory_size_gb = 1
  region         = var.region
  tier           = "BASIC"

  authorized_network = google_compute_network.smartvenue_vpc.id

  redis_configs = {
    maxmemory-policy = "allkeys-lru"
  }
}

# ── SECRET MANAGER ────────────────────────────────────────────────────────────
resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "jwt-secret"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "db-password"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "firebase_sa_key" {
  secret_id = "firebase-sa-key"
  replication {
    auto {}
  }
}
