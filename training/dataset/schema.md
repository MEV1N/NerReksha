# Training Dataset Schema

The training dataset for the ML risk predictor should be a JSON array of objects.

## Example Object

```json
{
  "roadType": "residential",
  "distance": 350,
  "isOneWay": 0,
  "floodDistance": 120,
  "floodSeverity": 4,
  "landslideDistance": 800,
  "landslideSeverity": 0,
  "hazardCount": 3,
  "confirmationCount": 6,
  "reportAgeHours": 2,
  "label": 1
}
```

## Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `roadType` | string | OSM highway value (e.g. `residential`, `tertiary`) |
| `distance` | number | Length of the road segment in meters |
| `isOneWay` | number | `1` if one-way, `0` otherwise |
| `floodDistance` | number | Distance in meters to the nearest flood hazard (`99999` if none) |
| `floodSeverity` | number | Severity of the nearest flood hazard (0-5) |
| `landslideDistance` | number | Distance in meters to the nearest landslide hazard (`99999` if none) |
| `landslideSeverity` | number | Severity of the nearest landslide hazard (0-5) |
| `hazardCount` | number | Total number of hazards within a 2km radius |
| `confirmationCount` | number | Highest confirmation count of any nearby hazard |
| `reportAgeHours` | number | Age in hours of the most recent nearby hazard report |
| `label` | number | Target label: `0` (passable/lower-risk), `1` (unsafe/impassable) |
