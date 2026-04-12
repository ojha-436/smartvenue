#!/usr/bin/env bash
# =============================================================================
# SmartVenue AI — Firestore Seed Data
# Seeds initial venue, zone, amenity and menu data into Firestore.
#
# Prerequisites:
#   - Firebase CLI installed: npm install -g firebase-tools
#   - Logged in:              firebase login
#   - Project set:            firebase use <YOUR_PROJECT_ID>
#
# Usage:
#   chmod +x seed-data.sh
#   ./seed-data.sh <PROJECT_ID>
# =============================================================================

set -euo pipefail

PROJECT_ID="${1:-}"
if [[ -z "$PROJECT_ID" ]]; then
  echo "Usage: $0 <PROJECT_ID>"
  exit 1
fi

echo "🌱  Seeding Firestore for project: $PROJECT_ID"

# ── Helper: write a Firestore document via REST API ───────────────────────────
# Requires: gcloud auth print-access-token
TOKEN=$(gcloud auth print-access-token)
BASE="https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents"

firestore_put() {
  local COLLECTION="$1"
  local DOC_ID="$2"
  local BODY="$3"
  curl -s -X PATCH \
    "${BASE}/${COLLECTION}/${DOC_ID}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$BODY" > /dev/null
  echo "  ✓ ${COLLECTION}/${DOC_ID}"
}

# ── Venue ─────────────────────────────────────────────────────────────────────
VENUE_ID="venue-nsc-delhi-001"
firestore_put "venues" "$VENUE_ID" '{
  "fields": {
    "name":      {"stringValue": "National Sports Complex"},
    "city":      {"stringValue": "New Delhi"},
    "country":   {"stringValue": "IN"},
    "capacity":  {"integerValue": "75000"},
    "timezone":  {"stringValue": "Asia/Kolkata"},
    "active":    {"booleanValue": true},
    "createdAt": {"timestampValue": "2026-01-01T00:00:00Z"}
  }
}'

# ── Zones ─────────────────────────────────────────────────────────────────────
echo "Seeding zones..."

seed_zone() {
  local ZID="$1" NAME="$2" TYPE="$3" CAP="$4" ROW="$5" COL="$6"
  firestore_put "venues/${VENUE_ID}/zones" "$ZID" "{
    \"fields\": {
      \"name\":          {\"stringValue\": \"${NAME}\"},
      \"type\":          {\"stringValue\": \"${TYPE}\"},
      \"capacity\":      {\"integerValue\": \"${CAP}\"},
      \"gridRow\":       {\"integerValue\": \"${ROW}\"},
      \"gridCol\":       {\"integerValue\": \"${COL}\"},
      \"densityScore\":  {\"doubleValue\": 0.0},
      \"occupancyCount\":{\"integerValue\": \"0\"},
      \"status\":        {\"stringValue\": \"clear\"},
      \"venueId\":       {\"stringValue\": \"${VENUE_ID}\"},
      \"updatedAt\":     {\"timestampValue\": \"2026-01-01T00:00:00Z\"}
    }
  }"
}

seed_zone "zone-gate-a"     "Gate A North"     "entrance"  5000 0 0
seed_zone "zone-gate-b"     "Gate B South"     "entrance"  5000 3 0
seed_zone "zone-gate-c"     "Gate C East"      "entrance"  5000 0 3
seed_zone "zone-gate-d"     "Gate D West"      "entrance"  5000 3 3
seed_zone "zone-north-stand" "North Stand"     "seating"  15000 0 1
seed_zone "zone-south-stand" "South Stand"     "seating"  15000 3 1
seed_zone "zone-east-stand"  "East Stand"      "seating"  10000 1 3
seed_zone "zone-west-stand"  "West Stand"      "seating"  10000 1 0
seed_zone "zone-vip"         "VIP Enclosure"   "vip"       2000 1 1
seed_zone "zone-n-concourse" "North Concourse" "concourse" 3000 0 2
seed_zone "zone-s-concourse" "South Concourse" "concourse" 3000 3 2
seed_zone "zone-food-alpha"  "Food Court Alpha" "food"     1500 1 2
seed_zone "zone-food-beta"   "Food Court Beta"  "food"     1500 2 2
seed_zone "zone-rest-n"      "Restrooms North"  "restroom"  500 0 2
seed_zone "zone-rest-s"      "Restrooms South"  "restroom"  500 3 2
seed_zone "zone-parking-p1"  "Parking Zone P1"  "parking"  2000 4 0

# ── Amenities ─────────────────────────────────────────────────────────────────
echo "Seeding amenities..."

seed_amenity() {
  local AID="$1" NAME="$2" TYPE="$3" ZONE="$4" QUEUE="$5" AVG_SECS="$6"
  firestore_put "venues/${VENUE_ID}/amenities" "$AID" "{
    \"fields\": {
      \"name\":         {\"stringValue\": \"${NAME}\"},
      \"type\":         {\"stringValue\": \"${TYPE}\"},
      \"zoneId\":       {\"stringValue\": \"${ZONE}\"},
      \"queueEnabled\": {\"booleanValue\": ${QUEUE}},
      \"avgServeSecs\": {\"integerValue\": \"${AVG_SECS}\"},
      \"venueId\":      {\"stringValue\": \"${VENUE_ID}\"},
      \"orderQueue\":   {\"arrayValue\": {\"values\": []}}
    }
  }"
}

seed_amenity "amenity-food-alpha-1" "Biryani Corner"       "food_stall"   "zone-food-alpha" true  180
seed_amenity "amenity-food-alpha-2" "Pizza Express"        "food_stall"   "zone-food-alpha" true  150
seed_amenity "amenity-food-alpha-3" "Beverages & Snacks"   "food_stall"   "zone-food-alpha" true   90
seed_amenity "amenity-food-beta-1"  "Thali House"          "food_stall"   "zone-food-beta"  true  200
seed_amenity "amenity-food-beta-2"  "Burger Junction"      "food_stall"   "zone-food-beta"  true  120
seed_amenity "amenity-rest-n"       "Restrooms North Block" "restroom"    "zone-rest-n"     false   0
seed_amenity "amenity-rest-s"       "Restrooms South Block" "restroom"    "zone-rest-s"     false   0
seed_amenity "amenity-atm-1"        "ATM — Gate A"          "atm"         "zone-gate-a"     false   0
seed_amenity "amenity-first-aid-1"  "First Aid Post"        "first_aid"   "zone-n-concourse" false  0
seed_amenity "amenity-merch-1"      "Official Merchandise"  "merch_store" "zone-n-concourse" true  120

# ── Menu Items ────────────────────────────────────────────────────────────────
echo "Seeding menu items..."

seed_menu() {
  local MID="$1" AID="$2" NAME="$3" DESC="$4" PRICE="$5" CAT="$6"
  firestore_put "venues/${VENUE_ID}/amenities/${AID}/menuItems" "$MID" "{
    \"fields\": {
      \"name\":        {\"stringValue\": \"${NAME}\"},
      \"description\": {\"stringValue\": \"${DESC}\"},
      \"pricePaise\":  {\"integerValue\": \"${PRICE}\"},
      \"category\":    {\"stringValue\": \"${CAT}\"},
      \"available\":   {\"booleanValue\": true}
    }
  }"
}

# Biryani Corner
seed_menu "menu-bc-1" "amenity-food-alpha-1" "Chicken Biryani"    "Aromatic basmati with tender chicken"   25000 "mains"
seed_menu "menu-bc-2" "amenity-food-alpha-1" "Veg Biryani"        "Garden fresh vegetables with basmati"   18000 "mains"
seed_menu "menu-bc-3" "amenity-food-alpha-1" "Raita"              "Cooling yoghurt side"                    4000 "sides"
seed_menu "menu-bc-4" "amenity-food-alpha-1" "Mineral Water 1L"   "Chilled packaged water"                  2000 "beverages"

# Pizza Express
seed_menu "menu-pe-1" "amenity-food-alpha-2" "Margherita (6\")"   "Classic tomato & mozzarella"            15000 "mains"
seed_menu "menu-pe-2" "amenity-food-alpha-2" "Pepperoni (6\")"    "Loaded with pepperoni slices"           18000 "mains"
seed_menu "menu-pe-3" "amenity-food-alpha-2" "Garlic Bread"       "Toasted with herb butter"                8000 "sides"
seed_menu "menu-pe-4" "amenity-food-alpha-2" "Cold Coffee"        "Blended iced coffee"                     7000 "beverages"

# Beverages & Snacks
seed_menu "menu-bev-1" "amenity-food-alpha-3" "Coca-Cola 500ml"   "Ice-cold cola"                           4000 "beverages"
seed_menu "menu-bev-2" "amenity-food-alpha-3" "Fresh Lime Soda"   "Lime, soda & salt/sugar"                 5000 "beverages"
seed_menu "menu-bev-3" "amenity-food-alpha-3" "Samosa (2 pcs)"    "Crispy potato filled pastry"             4000 "snacks"
seed_menu "menu-bev-4" "amenity-food-alpha-3" "Popcorn (Large)"   "Salted or caramel"                       5000 "snacks"

# Thali House
seed_menu "menu-th-1" "amenity-food-beta-1" "Veg Thali"           "5-item vegetarian meal"                 20000 "mains"
seed_menu "menu-th-2" "amenity-food-beta-1" "Non-Veg Thali"       "5-item non-veg meal with chicken"       28000 "mains"
seed_menu "menu-th-3" "amenity-food-beta-1" "Lassi (Sweet)"       "Thick yoghurt drink"                     6000 "beverages"

# Burger Junction
seed_menu "menu-bj-1" "amenity-food-beta-2" "Classic Veg Burger"  "Aloo tikki patty with veggies"          14000 "mains"
seed_menu "menu-bj-2" "amenity-food-beta-2" "Chicken Zinger"      "Spicy crispy chicken burger"            18000 "mains"
seed_menu "menu-bj-3" "amenity-food-beta-2" "French Fries (Reg)"  "Crispy golden fries"                     7000 "sides"
seed_menu "menu-bj-4" "amenity-food-beta-2" "Milkshake"           "Chocolate / Vanilla / Strawberry"        9000 "beverages"

echo ""
echo "✅  Firestore seed complete!"
echo "    Venue ID : ${VENUE_ID}"
echo "    Zones    : 16"
echo "    Amenities: 10"
echo "    Menu items: 20"
echo ""
echo "Next: open the Attendee App and verify the venue map loads correctly."
