# SmartVenue AI — Full Deployment Guide
## Google Cloud Platform | Application Service Deployment

---

## PREREQUISITES

Before you begin, install and configure the following tools on your local machine:

```bash
# 1. Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init

# 2. Terraform
brew install terraform          # macOS
# OR
sudo apt-get install terraform  # Ubuntu/Debian

# 3. Docker Desktop
# Download from https://www.docker.com/products/docker-desktop

# 4. Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 5. Python 3.11+
sudo apt-get install python3.11 python3.11-pip

# 6. jq (JSON processor)
sudo apt-get install jq          # Linux
brew install jq                  # macOS
```

---

## STEP 1 — Create and Configure GCP Project

```bash
# Set your project ID (must be globally unique)
export PROJECT_ID="smartvenue-ai-$(date +%s)"
export REGION="us-central1"
export REPO_NAME="smartvenue-repo"

# Create the project
gcloud projects create $PROJECT_ID --name="SmartVenue AI"
gcloud config set project $PROJECT_ID

# Link billing account (required for all paid services)
# List your billing accounts:
gcloud billing accounts list
# Link billing (replace BILLING_ACCOUNT_ID):
gcloud billing projects link $PROJECT_ID \
  --billing-account=BILLING_ACCOUNT_ID

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  pubsub.googleapis.com \
  bigquery.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  aiplatform.googleapis.com \
  firebase.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com

echo "APIs enabled successfully"
```

---

## STEP 2 — Set Up Firebase

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Add Firebase to the project
firebase projects:addfirebase $PROJECT_ID

# Initialize Firestore in Native mode (select us-central region)
gcloud firestore databases create --location=nam5

# Initialize Firebase in the project directory
cd smartvenue-ai
firebase init

# When prompted:
# - Select: Firestore, Hosting (for each frontend app), Functions (optional)
# - Use existing project: $PROJECT_ID
# - Accept defaults for Firestore rules file
# - Set public directory to 'dist' for each app

echo "Firebase configured"
```

---

## STEP 3 — Deploy Infrastructure with Terraform

```bash
cd smartvenue-ai/terraform

# Initialize Terraform
terraform init

# Set variables
cat > terraform.tfvars <<EOF
project_id = "$PROJECT_ID"
region     = "$REGION"
EOF

# Review the plan
terraform plan

# Apply infrastructure (approx. 5-10 minutes)
terraform apply -auto-approve

# Export Terraform outputs for use in later steps
export DB_INSTANCE=$(terraform output -raw cloud_sql_instance_connection)
export REDIS_HOST=$(terraform output -raw redis_host)
export PUBSUB_PREFIX=$(terraform output -raw pubsub_topic_prefix)

echo "Infrastructure deployed"
```

---

## STEP 4 — Create Artifact Registry and Push Docker Images

```bash
cd smartvenue-ai

# Create Artifact Registry repository
gcloud artifacts repositories create $REPO_NAME \
  --repository-format=docker \
  --location=$REGION \
  --description="SmartVenue AI Docker images"

# Configure Docker to use gcloud credentials
gcloud auth configure-docker $REGION-docker.pkg.dev

# Build and push each service
REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME"

services=("attendee-api" "queue-service" "crowd-service" "order-service" "staff-service" "notification-service" "analytics-service")

for svc in "${services[@]}"; do
  echo "Building $svc..."
  docker build -t "$REGISTRY/$svc:latest" ./services/$svc
  docker push "$REGISTRY/$svc:latest"
  echo "$svc pushed"
done

# Build and push frontend apps
apps=("attendee-app" "staff-app" "ops-dashboard")
for app in "${apps[@]}"; do
  echo "Building $app..."
  docker build -t "$REGISTRY/$app:latest" ./apps/$app
  docker push "$REGISTRY/$app:latest"
  echo "$app pushed"
done

echo "All images pushed to Artifact Registry"
```

---

## STEP 5 — Create Secrets in Secret Manager

```bash
# Firebase service account key (download from Firebase Console > Project Settings > Service Accounts)
# Place the downloaded JSON as firebase-sa-key.json then:
gcloud secrets create firebase-sa-key \
  --data-file=firebase-sa-key.json

# Cloud SQL password
DB_PASSWORD=$(openssl rand -base64 32)
echo -n "$DB_PASSWORD" | gcloud secrets create db-password --data-file=-

# JWT signing secret
JWT_SECRET=$(openssl rand -base64 64)
echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=-

# Store project config
echo -n "$PROJECT_ID" | gcloud secrets create gcp-project-id --data-file=-

echo "Secrets created"
```

---

## STEP 6 — Set Up Cloud SQL Database

```bash
# Create Cloud SQL instance (PostgreSQL 16)
gcloud sql instances create smartvenue-db \
  --database-version=POSTGRES_16 \
  --tier=db-g1-small \
  --region=$REGION \
  --storage-auto-increase \
  --backup-start-time=02:00 \
  --enable-point-in-time-recovery

# Create database
gcloud sql databases create smartvenue \
  --instance=smartvenue-db

# Create database user
gcloud sql users create smartvenue-user \
  --instance=smartvenue-db \
  --password=$DB_PASSWORD

# Initialize schema (connect via Cloud SQL Proxy)
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy
./cloud-sql-proxy $PROJECT_ID:$REGION:smartvenue-db &
sleep 5

PGPASSWORD=$DB_PASSWORD psql -h 127.0.0.1 -U smartvenue-user -d smartvenue -f scripts/schema.sql
kill %1

echo "Database initialized"
```

---

## STEP 7 — Set Up Pub/Sub Topics

```bash
topics=("app-events" "crowd-alerts" "order-events" "staff-tasks")

for topic in "${topics[@]}"; do
  gcloud pubsub topics create $topic
  gcloud pubsub subscriptions create "${topic}-sub" \
    --topic=$topic \
    --ack-deadline=60
  echo "Created topic: $topic"
done

echo "Pub/Sub configured"
```

---

## STEP 8 — Deploy Backend Services to Cloud Run

```bash
REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME"

# Create a service account for Cloud Run services
gcloud iam service-accounts create smartvenue-run-sa \
  --display-name="SmartVenue Cloud Run SA"

SA_EMAIL="smartvenue-run-sa@$PROJECT_ID.iam.gserviceaccount.com"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/pubsub.publisher"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/pubsub.subscriber"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/bigquery.dataEditor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/aiplatform.user"

# Deploy attendee-api
gcloud run deploy attendee-api \
  --image="$REGISTRY/attendee-api:latest" \
  --platform=managed \
  --region=$REGION \
  --service-account=$SA_EMAIL \
  --set-env-vars="PROJECT_ID=$PROJECT_ID,REGION=$REGION" \
  --set-secrets="JWT_SECRET=jwt-secret:latest,FIREBASE_KEY=firebase-sa-key:latest" \
  --min-instances=1 \
  --max-instances=50 \
  --memory=512Mi \
  --cpu=1 \
  --allow-unauthenticated

# Deploy queue-service
gcloud run deploy queue-service \
  --image="$REGISTRY/queue-service:latest" \
  --platform=managed \
  --region=$REGION \
  --service-account=$SA_EMAIL \
  --set-env-vars="PROJECT_ID=$PROJECT_ID,REGION=$REGION" \
  --set-secrets="JWT_SECRET=jwt-secret:latest,FIREBASE_KEY=firebase-sa-key:latest" \
  --min-instances=1 \
  --max-instances=50 \
  --memory=512Mi \
  --allow-unauthenticated

# Deploy crowd-service
gcloud run deploy crowd-service \
  --image="$REGISTRY/crowd-service:latest" \
  --platform=managed \
  --region=$REGION \
  --service-account=$SA_EMAIL \
  --set-env-vars="PROJECT_ID=$PROJECT_ID,REGION=$REGION" \
  --set-secrets="FIREBASE_KEY=firebase-sa-key:latest" \
  --min-instances=1 \
  --max-instances=30 \
  --memory=1Gi \
  --cpu=2 \
  --allow-unauthenticated

# Deploy order-service
gcloud run deploy order-service \
  --image="$REGISTRY/order-service:latest" \
  --platform=managed \
  --region=$REGION \
  --service-account=$SA_EMAIL \
  --set-env-vars="PROJECT_ID=$PROJECT_ID,REGION=$REGION,DB_HOST=127.0.0.1" \
  --set-secrets="JWT_SECRET=jwt-secret:latest,FIREBASE_KEY=firebase-sa-key:latest,DB_PASSWORD=db-password:latest" \
  --add-cloudsql-instances="$PROJECT_ID:$REGION:smartvenue-db" \
  --min-instances=1 \
  --max-instances=30 \
  --memory=512Mi \
  --allow-unauthenticated

# Deploy staff-service
gcloud run deploy staff-service \
  --image="$REGISTRY/staff-service:latest" \
  --platform=managed \
  --region=$REGION \
  --service-account=$SA_EMAIL \
  --set-env-vars="PROJECT_ID=$PROJECT_ID,REGION=$REGION" \
  --set-secrets="JWT_SECRET=jwt-secret:latest,FIREBASE_KEY=firebase-sa-key:latest" \
  --min-instances=1 \
  --max-instances=20 \
  --memory=512Mi \
  --allow-unauthenticated

# Deploy notification-service
gcloud run deploy notification-service \
  --image="$REGISTRY/notification-service:latest" \
  --platform=managed \
  --region=$REGION \
  --service-account=$SA_EMAIL \
  --set-env-vars="PROJECT_ID=$PROJECT_ID,REGION=$REGION" \
  --set-secrets="FIREBASE_KEY=firebase-sa-key:latest" \
  --min-instances=1 \
  --max-instances=20 \
  --memory=512Mi \
  --allow-unauthenticated

# Deploy analytics-service
gcloud run deploy analytics-service \
  --image="$REGISTRY/analytics-service:latest" \
  --platform=managed \
  --region=$REGION \
  --service-account=$SA_EMAIL \
  --set-env-vars="PROJECT_ID=$PROJECT_ID,REGION=$REGION,BQ_DATASET=smartvenue_analytics" \
  --set-secrets="FIREBASE_KEY=firebase-sa-key:latest" \
  --min-instances=1 \
  --max-instances=20 \
  --memory=512Mi \
  --allow-unauthenticated

echo "All backend services deployed"
```

---

## STEP 9 — Get Service URLs and Configure Frontend

```bash
# Get all service URLs
ATTENDEE_URL=$(gcloud run services describe attendee-api --region=$REGION --format='value(status.url)')
QUEUE_URL=$(gcloud run services describe queue-service --region=$REGION --format='value(status.url)')
CROWD_URL=$(gcloud run services describe crowd-service --region=$REGION --format='value(status.url)')
ORDER_URL=$(gcloud run services describe order-service --region=$REGION --format='value(status.url)')
STAFF_URL=$(gcloud run services describe staff-service --region=$REGION --format='value(status.url)')
NOTIFY_URL=$(gcloud run services describe notification-service --region=$REGION --format='value(status.url)')

echo "Service URLs:"
echo "  attendee-api:       $ATTENDEE_URL"
echo "  queue-service:      $QUEUE_URL"
echo "  crowd-service:      $CROWD_URL"
echo "  order-service:      $ORDER_URL"
echo "  staff-service:      $STAFF_URL"
echo "  notification-svc:   $NOTIFY_URL"

# Create .env files for each frontend app
cat > apps/attendee-app/.env.production <<EOF
VITE_ATTENDEE_API=$ATTENDEE_URL
VITE_QUEUE_API=$QUEUE_URL
VITE_CROWD_API=$CROWD_URL
VITE_ORDER_API=$ORDER_URL
VITE_FIREBASE_PROJECT_ID=$PROJECT_ID
EOF

cat > apps/staff-app/.env.production <<EOF
VITE_STAFF_API=$STAFF_URL
VITE_CROWD_API=$CROWD_URL
VITE_QUEUE_API=$QUEUE_URL
VITE_FIREBASE_PROJECT_ID=$PROJECT_ID
EOF

cat > apps/ops-dashboard/.env.production <<EOF
VITE_ATTENDEE_API=$ATTENDEE_URL
VITE_QUEUE_API=$QUEUE_URL
VITE_CROWD_API=$CROWD_URL
VITE_ORDER_API=$ORDER_URL
VITE_STAFF_API=$STAFF_URL
VITE_NOTIFY_API=$NOTIFY_URL
VITE_FIREBASE_PROJECT_ID=$PROJECT_ID
EOF
```

---

## STEP 10 — Build and Deploy Frontend Apps

```bash
# Build and deploy Attendee App
cd apps/attendee-app
npm install
npm run build
firebase deploy --only hosting:attendee-app --project $PROJECT_ID
cd ../..

# Build and deploy Staff App
cd apps/staff-app
npm install
npm run build
firebase deploy --only hosting:staff-app --project $PROJECT_ID
cd ../..

# Build and deploy Ops Dashboard
cd apps/ops-dashboard
npm install
npm run build
firebase deploy --only hosting:ops-dashboard --project $PROJECT_ID
cd ../..

echo "All frontend apps deployed to Firebase Hosting"
```

---

## STEP 11 — Set Up BigQuery Analytics

```bash
# Create BigQuery dataset
bq --project_id=$PROJECT_ID mk \
  --dataset \
  --location=US \
  --description="SmartVenue AI Analytics" \
  smartvenue_analytics

# Create tables
bq mk --table $PROJECT_ID:smartvenue_analytics.app_events \
  scripts/bq_schemas/app_events.json

bq mk --table $PROJECT_ID:smartvenue_analytics.queue_history \
  scripts/bq_schemas/queue_history.json

bq mk --table $PROJECT_ID:smartvenue_analytics.crowd_density_history \
  scripts/bq_schemas/crowd_density_history.json

bq mk --table $PROJECT_ID:smartvenue_analytics.order_history \
  scripts/bq_schemas/order_history.json

echo "BigQuery datasets and tables created"
```

---

## STEP 12 — Deploy Pub/Sub Push Subscriptions (Connect Services)

```bash
# Push crowd-alerts to notification-service
gcloud pubsub subscriptions modify-push-config crowd-alerts-sub \
  --push-endpoint="$NOTIFY_URL/internal/crowd-alert" \
  --push-auth-service-account=$SA_EMAIL

# Push app-events to analytics-service
gcloud pubsub subscriptions modify-push-config app-events-sub \
  --push-endpoint="$(gcloud run services describe analytics-service --region=$REGION --format='value(status.url)')/internal/ingest" \
  --push-auth-service-account=$SA_EMAIL

echo "Pub/Sub push subscriptions configured"
```

---

## VERIFICATION

```bash
# Test each service health endpoint
for svc in attendee-api queue-service crowd-service order-service staff-service notification-service; do
  URL=$(gcloud run services describe $svc --region=$REGION --format='value(status.url)')
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" $URL/health)
  echo "$svc: HTTP $STATUS"
done

# View logs for any service
gcloud logs read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=crowd-service" \
  --limit=50 \
  --project=$PROJECT_ID

echo "Deployment verification complete"
```

---

## URLS SUMMARY

After deployment, find your app URLs:

```bash
echo "=== SmartVenue AI Live URLs ==="
echo "Attendee App:    https://attendee-app.$PROJECT_ID.web.app"
echo "Staff App:       https://staff-app.$PROJECT_ID.web.app"
echo "Ops Dashboard:   https://ops-dashboard.$PROJECT_ID.web.app"
```

---

## TEARDOWN (to avoid charges)

```bash
# Delete Cloud Run services
for svc in attendee-api queue-service crowd-service order-service staff-service notification-service analytics-service attendee-app staff-app ops-dashboard; do
  gcloud run services delete $svc --region=$REGION --quiet
done

# Destroy Terraform infrastructure
cd terraform && terraform destroy -auto-approve

# Delete the project entirely
gcloud projects delete $PROJECT_ID
```
