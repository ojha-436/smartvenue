output "cloud_sql_instance_connection" {
  value = google_sql_database_instance.smartvenue_db.connection_name
}

output "redis_host" {
  value = google_redis_instance.smartvenue_cache.host
}

output "artifact_registry_url" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.smartvenue.repository_id}"
}

output "cloudrun_service_account" {
  value = google_service_account.cloudrun_sa.email
}

output "pubsub_topic_prefix" {
  value = "projects/${var.project_id}/topics"
}

output "bigquery_dataset" {
  value = google_bigquery_dataset.smartvenue_analytics.dataset_id
}
