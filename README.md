<div align="center">
  <video src="./rainroute.mp4" controls autoplay muted loop playsinline width="100%">
    Your browser does not support the video tag.
  </video>

  <br />

  <h1>🌧️ NerReksha</h1>
  
  <h3>Offline-First Emergency Coordination Platform</h3>

  <p>
    <img src="https://img.shields.io/badge/Status-Active-success.svg" alt="Status Active" />
    <img src="https://img.shields.io/badge/Offline-100%25-blue.svg" alt="Offline 100%" />
    <img src="https://img.shields.io/badge/Tech-Vanilla%20JS-F7DF1E.svg" alt="Vanilla JS" />
    <img src="https://img.shields.io/badge/Mapping-Leaflet-199900.svg" alt="Leaflet JS" />
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License MIT" />
  </p>

  <p>
    <strong>Built for emergencies. Designed for resilience. Powered by the community.</strong>
  </p>
</div>

---

## 📖 Overview

**NerReksha** is an **Offline-First Progressive Web Application (PWA)** that helps communities coordinate during natural disasters such as floods, landslides, heavy rainfall, and storms.

Unlike conventional navigation or emergency applications that rely on internet connectivity, NerReksha is designed to remain fully functional even when communication infrastructure fails.

The platform enables users to:

- 🗺️ Navigate using safer routes
- 🚨 Send SOS emergency requests
- ⚠️ Report hazards
- 🏠 Share community resources
- 📍 Find nearby relief facilities

All information is stored locally, making the application completely usable without a backend server.

---

# ✨ Features

## 🗺️ Interactive Emergency Map

The interactive map serves as the command center of NerReksha.

It displays:

- 📍 Your current location
- 🌊 Floods
- ⛰️ Landslides
- 🌳 Fallen Trees
- 🚧 Road Closures
- 🚨 SOS Requests
- 🏠 Community Resources
- 🏥 Relief Camps
- 🍱 Food Distribution
- 💧 Drinking Water
- 🔋 Charging Stations
- 🚻 Public Toilets
- 🚜 Volunteer Resources

Users can filter different marker categories to quickly find the information they need.

---

## 🤖 ML-Assisted Safest Route Navigation

NerReksha now uses a **Machine Learning risk predictor** layered on top of the A* pathfinding engine to find the **lowest-risk viable route** through the actual OSM road network.

### How It Works

```
OSM Road Graph
      ↓
Road Edge
      ↓
Feature Extraction (ml/features.js)
      ↓
ML Risk Model — 5-tree Random Forest (ml/model.js)
      ↓
Risk Score (0.0 – 1.0)
      ↓
Risk-Weighted Edge Cost
      ↓
A* Pathfinding (geo/astar.js)
      ↓
Lowest-Risk Road-Following Route
      ↓
Leaflet Map
```

### What the ML Model Does

- Extracts features from each road edge: road type, length, flood distance/severity, landslide distance/severity, hazard count, confirmation count, report age.
- Predicts a **risk score** between `0.0` (very safe) and `1.0` (very unsafe).
- Edges with a predicted risk above **0.25** are excluded from routing.
- A* then finds the path through the remaining edges with the **lowest combined risk + distance cost**.

### Hard Hazard Overrides

The ML model is only used for **uncertain/probabilistic risk**. Confirmed hard hazards always hard-block a road:

- Confirmed road closure
- Collapsed bridge (`bridge-damaged`, severity ≥ 3)
- Major landslide (`landslide`, severity ≥ 3)
- Confirmed road blockage (`road-blocked`, severity ≥ 3)

`blocked = true` edges are **never traversed**, regardless of ML predictions.

### Route Uncertainty Disclaimer

> The route shown is the **lowest-risk route based on available community data**.
> Actual road conditions may differ. Always exercise your own judgement.

The application never says "100% safe". It always says "Lower-risk route" or "Lowest-risk route based on available data".

---

### No Safe Route

If every possible route has edges with risk above the acceptable threshold or all roads are blocked:

> "No sufficiently safe route is currently available."
> "Conditions may change. Check again when new reports are available."

The application **never silently generates a dangerous route**.

---

## 🔁 Community Feedback Loop

After cancelling or completing a route, users are asked:

> "How was this route?"

Options:
- ✅ Road was Passable
- ⚠️ Partially Blocked
- ⛔ Inaccessible / Dangerous

Feedback is saved locally in IndexedDB (`route_feedback` store) and will form training data for future ML model improvements.

---

## 🚨 SOS Emergency System

Users can send emergency rescue requests within seconds.

Each SOS contains:

- Current GPS location
- Emergency type
- Number of affected people
- Optional contact information
- Additional notes

Submitted SOS requests immediately appear on the map.

Responders can update their status:

- ⏳ Waiting
- 🚑 Rescue On The Way
- ✅ Resolved

Resolved requests remain visible with a different marker style.

---

## ⚠️ Hazard Reporting

Community members can instantly report hazards.

Supported reports include:

- Flood
- Landslide
- Fallen Tree
- Road Blocked
- Bridge Damage
- Other

Every report is immediately:

- Stored locally
- Added to the map
- Saved for future sessions

Each report includes:

- Type
- Description
- Timestamp
- Confirmation Count
- Status

---

## 🏠 Community Resources

Instead of only displaying shelters, NerReksha allows communities to share any useful emergency resource.

Supported resource types include:

- 🏠 Relief Camp
- 🏥 Temporary Medical Camp
- 🍱 Food Distribution
- 💧 Drinking Water
- 🔋 Charging Station
- 🚻 Public Toilet
- 🚜 Volunteer Resource
- ⛽ Fuel Availability
- 📦 Supply Distribution
- 📍 Other

Each resource displays:

- Resource Name
- Type
- Capacity
- Contact Information
- Facilities Available
- Description

Resources can also be removed when they are no longer available.

---

# 🌐 Offline-First Design

Offline capability is the core feature of NerReksha.

## Progressive Web App (PWA)

The application installs directly onto mobile devices.

Using a Service Worker, it caches:

- HTML
- CSS
- JavaScript
- Icons
- Application Assets

The app launches even without internet.

The service worker also caches OpenStreetMap tiles as they are viewed. To prepare an area for offline map viewing, open and pan/zoom through that area while online before losing connectivity. Only previously viewed tiles are available offline; downloading a complete map of an area requires bundled offline map data, which is not included in this lightweight project.

The cache is versioned and old caches are removed during service-worker activation. Optional CDN files no longer prevent the app shell from installing when a network request fails.

---

## IndexedDB Storage

All application data is stored locally using IndexedDB.

Stored information includes:

- Hazard Reports
- SOS Requests
- Community Resources
- User Preferences

This allows the application to continue working even during complete network outages.

---

## GPS Without Internet

GPS continues working even when mobile data is unavailable.

NerReksha uses GPS for:

- Hazard Reports
- SOS Requests
- Community Resources
- User Navigation

GPS coordinates can still be acquired without mobile data, although the device may need a clear view of the sky and location permission must already be granted.

## Demo Data

Use the `Load Demo` button in the header to create sample hazards, SOS requests, and community resources around the current map center. The records are stored locally and remain available offline. Loading demo data again asks whether existing records should be replaced.

---

# 🚀 How It Works

## Report a Hazard

```
Open App

↓

Report

↓

Select Hazard

↓

Submit

↓

Stored Locally

↓

Displayed on Map
```

---

## Request Rescue

```
Open App

↓

SOS

↓

Enter Details

↓

Submit

↓

SOS Appears On Map

↓

Responder Updates Status
```

---

## Add Community Resource

```
Community Resources

↓

+

↓

Enter Details

↓

Save

↓

Displayed On Map
```

---

# 💡 Why NerReksha?

During disasters:

- Internet connectivity is unreliable.
- Roads become blocked unexpectedly.
- Traditional navigation apps become inaccurate.
- Communities struggle to coordinate.

NerReksha solves these challenges by enabling communities to collaboratively build their own emergency map.

Instead of depending on cloud services, users contribute:

- Hazard reports
- rescue requests
- Relief locations
- Community resources

This makes emergency information:

- Faster
- More local
- More accurate
- Available offline

---

# 👥 Who Can Use It?

### 🚶 Civilians

- Find safe routes
- Locate food and water
- Discover nearby relief camps
- Request emergency assistance

---

### 🚑 Emergency Responders

- View hazard reports
- Track SOS requests
- Update rescue status
- Locate affected communities

---

### 🤝 Volunteers

- Report blocked roads
- Add community resources
- Create temporary relief camps
- Help coordinate local response

---

# 🛠️ Technology Stack

| Technology | Purpose |
|------------|---------|
| HTML5 | Structure |
| CSS3 | Styling |
| Vanilla JavaScript | Application Logic |
| Leaflet.js | Interactive Maps |
| OpenStreetMap | Mapping & Road Graph |
| IndexedDB | Offline Storage |
| Service Worker | Offline Caching |
| Progressive Web App | Installable Experience |
| A* Algorithm | Road-following pathfinding |
| Random Forest (Pure JS) | Road risk prediction |

---

# 📂 Project Structure

```
NerReksha/
│
├── index.html              # PWA shell
├── style.css               # Styles
├── manifest.json           # PWA manifest
├── service-worker.js       # Offline caching
│
├── app.js                  # Main app logic & navigation
├── map.js                  # Leaflet map & routing UI
├── report.js               # Hazard reporting UI
├── data.js                 # IndexedDB data layer
├── routing.js              # Routing controller
├── search.js               # Offline place search
├── gps.js                  # GPS location module
│
├── geo/
│   ├── distance.js         # Haversine & segment distance
│   ├── graph.js            # Road graph (nodes + edges)
│   ├── spatial-index.js    # Spatial lookup
│   └── astar.js            # A* pathfinding (ML-integrated)
│
├── ml/
│   ├── features.js         # Road feature extraction
│   ├── model.js            # 5-tree Random Forest (exported)
│   ├── fallback-model.js   # Rule-based fallback predictor
│   └── risk-predictor.js   # Orchestrator (ML + fallback)
│
├── training/
│   ├── train.js            # Training script (generates model.js)
│   ├── evaluate.js         # Evaluation: accuracy, recall, F1, FN rate
│   └── dataset/
│       ├── schema.md       # Training data format definition
│       └── synthetic_data.json  # [DEMO/SYNTHETIC] bootstrap dataset
│
├── tools/
│   └── osm/               # OSM data pipeline
└── offline-region.js      # Offline region download manager
```

---

## 🤖 Training Workflow

The ML model runs **inference only** in the browser. Training happens separately:

```bash
# Step 1: Generate synthetic dataset + train & export model
node training/train.js

# Step 2: Evaluate the model
node training/evaluate.js
```

The `train.js` script generates a synthetic dataset, trains a 5-tree Random Forest, and exports it directly to `ml/model.js` as plain browser-compatible JavaScript.

> The synthetic dataset is clearly marked **[DEMO/SYNTHETIC]**. Replace it with real community feedback data from `NerRekshaData.loadRouteFeedback()` for better real-world performance.

---

# 🚀 Getting Started

Clone the repository

```bash
git clone https://github.com/yourusername/NerReksha.git
```

Navigate into the project

```bash
cd NerReksha
```

Run using a local web server. A server is required because service workers do not run from `file://` pages.

```bash
# VS Code Live Server
```

or

```bash
python -m http.server
```

Open the application in your browser and install it as a Progressive Web App for the best experience.

For offline testing, open the app once while online, allow the service worker to install, and visit the map area you want available offline. Then use the browser's network tools or disable the network and reload the app.

---

# 🔮 Future Improvements

- 🔄 Community synchronization via mesh radio
- ☁️ Optional cloud backup when connectivity resumes
- 🤖 Real-world ML retraining from community feedback data
- 📷 Image attachments for hazard reports
- 📡 Mesh networking (LoRa, BLE)
- 🔔 Push notifications via Service Worker
- 👥 Multi-user community verification system
- 📊 Disaster analytics dashboard
- 🏋️ Improved Random Forest trained on real feedback

---

# ❤️ Built for Communities

> **When infrastructure fails, communities should still be able to help each other.**

NerReksha combines offline resilience, crowdsourced information, and a simple mobile-first experience to help people stay informed, connected, and safe during emergencies.

---

## 📄 License

This project is licensed under the **MIT License**.

---

<p align="center">
Made with ❤️ for disaster resilience and community safety.
</p>
