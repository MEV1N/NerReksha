# Geographic Data Preprocessing Pipeline

This directory contains scripts to generate browser-friendly geographic datasets from OpenStreetMap data. 
Because parsing raw OSM XML/PBF data in the browser is too heavy, we pre-process it.

## Included Scripts

*   `generate-mock-region.js`: Generates a synthetic grid road network and mock places for testing the offline routing and search capabilities without needing full real-world data conversion.

## Planned Scripts (For Future Real-World Implementation)

*   `extract-pois.js`: Would extract points of interest (amenities, hospitals, relief camps) from an OSM file and convert them to our `places.json` format.
*   `build-graph.js`: Would extract routable `highway` ways, detect intersections, and output a compact `nodes` and `edges` graph, pre-calculating Haversine distances.
*   `generate-region.js`: Would bundle the output into a downloadable region package for the browser.

## Running

```bash
node generate-mock-region.js
```
The output will be placed in `../../data/mock_region.json`.
