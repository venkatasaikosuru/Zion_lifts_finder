  // Zion-Lifts location finder
  // The locations are loaded directly from data.xls. Keep that Excel file beside index.html.
  // Open this folder with VS Code Live Server (not by double-clicking index.html).

  const map = L.map('map', { scrollWheelZoom: true }).setView([17.385, 78.4867], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  let locations = [];
  let userPosition = null;
  let userMarker = null;
  const markerLayer = L.featureGroup().addTo(map);
  // Update these coordinates if you have the exact Zion-Lifts office pin.
  const ADMIN_LOCATION = { name: 'Zion-Lifts Admin', address: 'Balanagar, Hyderabad', latitude: 17.4775, longitude: 78.4482 };
  let adminMarker = null;
  const list = document.getElementById('location-list');
  const radiusSelect = document.getElementById('radius');
  const searchInput = document.getElementById('search');
  const count = document.getElementById('count');
  const status = document.getElementById('map-status');

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }
  function distanceKm(aLat, aLon, bLat, bLon) {
    const rad = n => n * Math.PI / 180;
    const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function directionsURL(location) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.latitude + ',' + location.longitude)}`;
  }
  function filteredLocations() {
    const query = searchInput.value.trim().toLowerCase();
    const radius = radiusSelect.value;
    return locations.map(location => ({
      ...location,
      distance: userPosition ? distanceKm(userPosition.lat, userPosition.lng, location.latitude, location.longitude) : null
    })).filter(location => {
      const matchesSearch = `${location.name} ${location.address}`.toLowerCase().includes(query);
      const matchesRadius = radius === 'all' || !userPosition || location.distance <= Number(radius);
      return matchesSearch && matchesRadius;
    }).sort((a, b) => a.distance == null || b.distance == null ? 0 : a.distance - b.distance);
  }
  function render() {
    const visible = filteredLocations();
    list.innerHTML = '';
    markerLayer.clearLayers();

    // Keep the admin office separate and visually prominent.
    if (adminMarker) map.removeLayer(adminMarker);
    const adminIcon = L.divIcon({
      className: 'admin-marker-wrap',
      html: '<div class="admin-marker-pin"><span>★</span></div>',
      iconSize: [36, 44], iconAnchor: [18, 42]
    });
    adminMarker = L.marker([ADMIN_LOCATION.latitude, ADMIN_LOCATION.longitude], { icon: adminIcon, zIndexOffset: 1000 }).addTo(map);
    adminMarker.bindTooltip('ADMIN · ZION-LIFTS', { permanent: true, direction: 'top', offset: [0, -46], className: 'admin-location-label' });
    // No popup on the admin marker; clicking it goes directly to Google Maps.
    adminMarker.on('click', () => window.open(`https://www.google.com/maps/dir/?api=1&destination=${ADMIN_LOCATION.latitude},${ADMIN_LOCATION.longitude}`, '_blank', 'noopener'));

    const adminCard = document.createElement('article');
    adminCard.className = 'location-card admin-card';
    adminCard.innerHTML = '<div class="admin-card-tag">★ OFFICIAL ADMIN LOCATION</div><h2 class="card-title">Zion Lifts - Admin Zion-Lifts</h2><p class="address">Balanagar, Hyderabad</p><button class="navigate admin-navigate" type="button">Navigate to Admin Office 📍</button>';
    adminCard.querySelector('button').addEventListener('click', () => window.open(`https://www.google.com/maps/dir/?api=1&destination=${ADMIN_LOCATION.latitude},${ADMIN_LOCATION.longitude}`, '_blank', 'noopener'));
    list.appendChild(adminCard);

    visible.forEach(location => {
      const marker = L.marker([location.latitude, location.longitude]).addTo(markerLayer);
      marker.bindTooltip(escapeHTML(location.name), { permanent: true, direction: 'top', offset: [-16, -14], className: 'lift-label' });
      // No popup: clicking a lift marker opens Google Maps directions directly.
      // Clicking a lift marker opens directions to that lift directly.
      marker.on('click', () => window.open(directionsURL(location), '_blank', 'noopener'));

      const card = document.createElement('article');
      card.className = 'location-card';
      const distanceText = location.distance == null ? '' : `<p class="address">${location.distance.toFixed(1)} km away</p>`;
      card.innerHTML = `<h2 class="card-title">${escapeHTML(location.name)}</h2><p class="address">${escapeHTML(location.address)}</p>${distanceText}<button class="navigate" type="button">Navigate 📍</button>`;
      card.querySelector('button').addEventListener('click', () => window.open(directionsURL(location), '_blank', 'noopener'));
      list.appendChild(card);
    });

    count.textContent = `${visible.length} location${visible.length === 1 ? '' : 's'}`;
    status.textContent = userPosition
      ? `Showing locations ${radiusSelect.value === 'all' ? 'at all distances' : `within ${radiusSelect.value} km`}`
      : `Loaded ${locations.length} lift locations · allow location access to find nearest`;
    if (!visible.length) list.innerHTML = '<p class="empty">No matching locations. Try another search or radius.</p>';
  }
  function fitEverything() {
    const points = markerLayer.getLayers().map(m => m.getLatLng());
    points.push(L.latLng(ADMIN_LOCATION.latitude, ADMIN_LOCATION.longitude));
    if (userPosition) points.push(L.latLng(userPosition.lat, userPosition.lng));
    if (points.length) map.fitBounds(L.latLngBounds(points).pad(0.12), { maxZoom: 12 });
  }
  function showAllOnMap() {
    radiusSelect.value = 'all'; searchInput.value = ''; render();
    fitEverything();
  }
  function requestCurrentLocation() {
    if (!navigator.geolocation) { status.textContent = 'This browser does not support location access.'; return; }
    status.textContent = 'Requesting your current location…';
    navigator.geolocation.getCurrentPosition(position => {
      userPosition = { lat: position.coords.latitude, lng: position.coords.longitude };
      if (userMarker) map.removeLayer(userMarker);
      // Red marker with a permanent label identifies the user's current location.
      userMarker = L.circleMarker([userPosition.lat, userPosition.lng], {
        radius: 9, color: '#ffffff', weight: 3, fillColor: '#e53935', fillOpacity: 1
      }).addTo(map).bindTooltip('Your current location', { permanent: true, direction: 'top', offset: [0, -10], className: 'current-location-label' });
      userMarker.bindPopup('Your current location');
      render();
      fitEverything();
    }, error => {
      console.warn('Location access was not granted:', error.message);
      status.textContent = 'Location unavailable. Allow location access and press “Use My Location”.';
      render();
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  // Lift labels are permanent and remain visible at every zoom level.
  radiusSelect.addEventListener('change', render);
  searchInput.addEventListener('input', render);
  document.getElementById('show-all').addEventListener('click', showAllOnMap);
  document.getElementById('locate').addEventListener('click', requestCurrentLocation);

  async function loadExcelFile() {
    try {
      status.textContent = 'Loading lift locations from data.xls…';
      const response = await fetch('./data.xls');
      if (!response.ok) throw new Error(`Could not load data.xls (HTTP ${response.status})`);
      const workbookBytes = await response.arrayBuffer();
      const workbook = XLSX.read(workbookBytes, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      // Column names are taken from the supplied workbook: name, address, lat, lng.
      locations = rows.map(row => ({
        name: String(row.name || row.Name || row.NAME || 'Unnamed lift').trim(),
        address: String(row.address || row.Address || row.ADDRESS || row['mailing address'] || '').trim(),
        latitude: Number(row.lat ?? row.latitude ?? row.Latitude),
        longitude: Number(row.lng ?? row.lon ?? row.longitude ?? row.Longitude)
      })).filter(row => Number.isFinite(row.latitude) && Number.isFinite(row.longitude)
        && row.latitude >= -90 && row.latitude <= 90 && row.longitude >= -180 && row.longitude <= 180);
      render();
      fitEverything();
      requestCurrentLocation();
    } catch (error) {
      console.error(error);
      status.textContent = 'Could not load data.xls';
      list.innerHTML = '<p class="empty">Could not read data.xls. Make sure the Excel file is in the same folder as index.html and open the project with VS Code Live Server. Internet access is required for the map and Excel library.</p>';
    }
  }
  loadExcelFile();
