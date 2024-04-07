import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

import L from "leaflet";
import "leaflet-routing-machine";

import * as d3 from "d3"; // Import D3.js

function App() {
	const [position, setPosition] = useState([20.5937, 78.9629]); // Approximate center of India
	const zoom = 5; // Adjust the zoom level as needed
	const [markers, setMarkers] = useState([]);
	const [showRoute, setShowRoute] = useState(false);
	const [isMarkerPlacementEnabled, setIsMarkerPlacementEnabled] = useState(false);
	const [selectedMarker, setSelectedMarker] = useState(null);

	const mapRef = useRef(null);
	const routingControlRef = useRef(null);

	const handleMapClick = (e) => {
		if (isMarkerPlacementEnabled) {
			if (markers.length >= 50) {
				return;
			}

			const newMarker = [e.latlng.lat, e.latlng.lng];
			setMarkers([...markers, newMarker]);
		} else {
			if (markers.length == 0) {
				return;
			}

			const clickedCoords = [e.latlng.lat, e.latlng.lng];
			const closestMarker = markers.reduce((prev, curr, index) =>
				getDistance(curr, clickedCoords) < getDistance(prev, clickedCoords) ? [curr, index] : prev
			);
			if (getDistance(closestMarker[0], clickedCoords) < 0.01) {
				setSelectedMarker(closestMarker[1]);
			} else {
				setSelectedMarker(null);
			}
		}
	};

	const clearMarkers = () => {
		setMarkers([]);
	};

	const getDistance = (markerCoords, clickedCoords) => {
		const [lat1, lon1] = markerCoords;
		const [lat2, lon2] = clickedCoords;
		const R = 6371e3; // metres
		const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
		const φ2 = (lat2 * Math.PI) / 180;
		const Δφ = ((lat2 - lat1) * Math.PI) / 180;
		const Δλ = ((lon2 - lon1) * Math.PI) / 180;

		const a =
			Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
			Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

		const d = R * c; // in metres
		return d;
	};

	const toggleMarkerPlacement = () => {
		setIsMarkerPlacementEnabled(!isMarkerPlacementEnabled);
		setSelectedMarker(null);
	};

	const deleteMarker = () => {
		if (selectedMarker !== null) {
			const updatedMarkers = [...markers];
			updatedMarkers.splice(selectedMarker, 1);
			setMarkers(updatedMarkers);
			setSelectedMarker(null);
		}
	};

	// Function to calculate straight-line distance between markers
	function getActualDistance(m1, m2) {
		const [lat1, lon1] = m1;
		const [lat2, lon2] = m2;

		// Convert latitude and longitude to radians
		const radLat1 = (Math.PI * lat1) / 180;
		const radLat2 = (Math.PI * lat2) / 180;
		const dLat = radLat2 - radLat1;
		const dLon = (Math.PI * lon2) / 180 - (Math.PI * lon1) / 180;

		// Apply the haversine formula for straight-line distance on a sphere
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

		// Earth's radius (adjust if needed for higher precision)
		const earthRadius = 6371e3; // meters

		return earthRadius * c; // Distance in meters
	}

	const handleConvertToTSPGraph = () => {
		if (markers.length < 2) {
			console.log("Need at least two markers to calculate distance.");
			return;
		}

		// Assuming markers A and B are the first two markers in the list
		const markerA = markers[0];
		const markerB = markers[1];
		console.log(getActualDistance(markerA, markerB));
	};

	// Custom component to handle map click events
	const MapClickHandler = () => {
		useMapEvents({
			click: handleMapClick,
		});
		return null;
	};

	useEffect(() => {
		const width = document.querySelector(".graph-container").clientWidth;
		const height = document.querySelector(".graph-container").clientHeight;

		const svg = d3
			.select(".graph-container")
			.append("svg")
			.attr("width", width)
			.attr("height", height);

		const data = {
			nodes: markers.map((marker, index) => ({ id: `Node ${index}`, coords: marker })),
			links: [],
		};
		let maxDistance = Number.MIN_VALUE;
		let minDistance = Number.MAX_VALUE;
		for (let i = 0; i < markers.length; i++) {
			for (let j = i + 1; j < markers.length; j++) {
				const distance = getActualDistance(markers[i], markers[j]);
				maxDistance = Math.max(maxDistance, distance);
				minDistance = Math.min(minDistance, distance);
				data.links.push({ source: data.nodes[i], target: data.nodes[j], distance });
			}
		}
		const linkScale = d3
			.scaleLinear()
			.domain([minDistance, maxDistance])
			.range([0, 0.5 * height]);
		data.links.forEach((link) => (link.distance = linkScale(link.distance)));

		const simulation = d3
			.forceSimulation(data.nodes)
			.force(
				"link",
				d3
					.forceLink(data.links)
					.id((d) => d.id)
					.distance((d) => d.distance)
			)

			.force("charge", d3.forceManyBody().strength(-300)) // Increase the charge strength
			.force("center", d3.forceCenter(width / 2, height / 2));

		const link = svg
			.selectAll(".link")
			.data(data.links)
			.enter()
			.append("line")
			.attr("class", "link")
			.attr("stroke", "black");

		const node = svg
			.selectAll(".node")
			.data(data.nodes)
			.enter()
			.append("circle")
			.attr("class", "node")
			.attr("r", 10)
			.attr("fill", (d, i) => (i === 0 ? "green" : "blue")); // Color the first node green

		simulation.on("tick", () => {
			link
				.attr("x1", (d) => d.source.x)
				.attr("y1", (d) => d.source.y)
				.attr("x2", (d) => d.target.x)
				.attr("y2", (d) => d.target.y);

			node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
		});

		return () => {
			svg.remove();
		};
	}, [markers]);

	const solve = () => {
		if (markers.length <= 2) {
			return;
		}

		if (showRoute && routingControlRef) {
			routingControlRef.current.remove();
		}

		setShowRoute(!showRoute);

		const example = [
			[null, 1, 0, 0, 0],
			[0, null, 0, 0, 1],
			[1, 0, null, 0, 0],
			[0, 0, 1, null, 0],
			[0, 0, 0, 1, null],
		];

		const mapInstance = mapRef.current; // Access the map instance using ref

		console.log(mapInstance);
		console.log(showRoute);

		if (mapInstance) {
			const routingControl = L.Routing.control({
				waypoints: markers.map((marker) => L.latLng(marker[0], marker[1])),
				routeWhileDragging: false,
				router: L.Routing.osrmv1({
					language: "en",
					profile: "car",
					serviceUrl: "http://router.project-osrm.org/route/v1",
				}),
				instructions: false,
			}).addTo(mapInstance);

			routingControlRef.current = routingControl;
		}

		// Check for elements with the classname "leaflet-routing-container"
		const routingContainers = document.querySelectorAll(".leaflet-routing-container");

		// If there's only one element found, remove it
		if (routingContainers.length === 1) {
			routingContainers[0].remove();
		}
	};

	return (
		<div className="app-container">
			<div className="map-container">
				<MapContainer
					ref={mapRef}
					center={position}
					zoom={zoom}
					scrollWheelZoom={true}
					className="map"
				>
					<TileLayer
						attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
						url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
					/>
					<MapClickHandler /> {/* Custom component to handle map click events */}
					{markers.map((marker, index) => (
						<Marker
							key={index}
							position={marker}
							eventHandlers={{
								click: () => setSelectedMarker(index),
							}}
						>
							<Popup>Marker {index}</Popup>
						</Marker>
					))}
				</MapContainer>
			</div>
			<div className="sidebar">
				<div className="sidebar-top">
					<div className="button-interactions">
						<button className="marker-placement-toggle" onClick={toggleMarkerPlacement}>
							{isMarkerPlacementEnabled ? "Disable Marker Placement" : "Enable Marker Placement"}
						</button>
						<button
							className="delete-marker"
							onClick={deleteMarker}
							disabled={selectedMarker === null}
						>
							{selectedMarker !== null
								? `Delete Marker ${String.fromCharCode(65 + selectedMarker)}`
								: "Select a Marker to Delete"}
						</button>
					</div>
					<div className="clear-all">
						<button
							onClick={() => {
								clearMarkers();
							}}
							className="clear-markers"
						>
							Clear All Markers
						</button>
					</div>
					<div className="input-container">
						<div className="input-wrapper">
							<label>Distance:</label>
							<input type="text" className="distance-input" />
						</div>
						<div className="input-wrapper">
							<label>Time:</label>
							<input type="decimal" className="time-input" />
						</div>
					</div>
					<div className="input-container">
						<div className="input-wrapper single" id="no-vehicles">
							<label>Number of vehicles:</label>
							<input type="number" className="distance-input" />
						</div>
					</div>
					<div className="button-interactions">
						<button onClick={handleConvertToTSPGraph} className="make-tsp-graph">
							Convert to TSP Graph
						</button>
						<button onClick={() => solve()} className="solve">
							Get Optimised Route
						</button>
					</div>
					<div className="clear-all">
						<button className="reset-all">Reset Route & Optimisation</button>
					</div>
				</div>
				<div className="graph-container"></div>
			</div>
		</div>
	);
}

export default App;
