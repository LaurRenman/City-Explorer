document.addEventListener('DOMContentLoaded', function () {
	// Initialize map with fallback coordinates if needed
	if (typeof itinerairePoints === 'undefined' || !itinerairePoints.length) {
		// Create dummy data if no itinerary points are provided
		window.itinerairePoints = [
			{
				name: 'Point 1',
				category: 'Catégorie',
				address: 'Adresse 1',
				coordinates: [48.8566, 2.3522], // Paris default
			},
			{
				name: 'Point 2',
				category: 'Catégorie',
				address: 'Adresse 2',
				coordinates: [48.8606, 2.3376],
			},
		]
	}

	// Initialize map
	initMap()

	// Load transport options for each step using Socket.IO
	initSocketConnection()

	// Language selector functionality
	initLanguageSelector()

	// Print itinerary button
	initPrintButton()

	// Initialize loading state manager
	window.loadingManager = {
		show: function (message) {
			const loadingOverlay = document.getElementById('loading-overlay')
			const loadingText = document.getElementById('loading-text')
			if (loadingText)
				loadingText.textContent = message || 'Chargement en cours...'
			if (loadingOverlay) loadingOverlay.classList.remove('hidden')
		},
		hide: function () {
			const loadingOverlay = document.getElementById('loading-overlay')
			if (loadingOverlay) loadingOverlay.classList.add('hidden')
		},
	}
})

// Initialize Socket.IO connection for real-time transport options
function initSocketConnection() {
	// Check if Socket.IO is available
	if (typeof io === 'undefined') {
		console.error('Socket.IO is not loaded')
		loadFallbackTransportOptions()
		return
	}

	try {
		// Connect to Socket.IO server
		const socket = io()

		socket.on('connect', function () {
			console.log('Socket.IO connected')

			// Request transport options for each step
			loadTransportOptionsViaSocket(socket)
		})

		socket.on('connect_error', function (error) {
			console.error('Socket.IO connection error:', error)
			loadFallbackTransportOptions()
		})

		socket.on('transport_result', function (data) {
			handleTransportResult(data)
		})

		// Handle disconnection
		socket.on('disconnect', function () {
			console.log('Socket.IO disconnected')
		})
	} catch (error) {
		console.error('Error initializing Socket.IO:', error)
		loadFallbackTransportOptions()
	}
}

// Load transport options via Socket.IO
function loadTransportOptionsViaSocket(socket) {
	const stepCount = itinerairePoints.length

	// For each step (except the last one), request transport options
	for (let i = 0; i < stepCount - 1; i++) {
		const currentStep = itinerairePoints[i]
		const nextStep = itinerairePoints[i + 1]

		const transportSection = document.getElementById(`transport-${i + 1}`)
		if (!transportSection) continue

		// Show loading indicator
		const transportLoading =
			transportSection.querySelector('.transport-loading')
		const transportOptions =
			transportSection.querySelector('.transport-options')

		if (transportLoading) transportLoading.classList.remove('hidden')
		if (transportOptions) transportOptions.classList.add('hidden')

		// Request transport options via Socket.IO
		socket.emit('request_transport', {
			origin: currentStep.address,
			destination: nextStep.address,
			step_id: i + 1,
		})
	}
}

// Handle transport result from Socket.IO
function handleTransportResult(data) {
	const stepId = data.step_id
	const transportSection = document.getElementById(`transport-${stepId}`)
	if (!transportSection) return

	const transportLoading = transportSection.querySelector('.transport-loading')
	const transportOptions = transportSection.querySelector('.transport-options')

	// Hide loading indicator
	if (transportLoading) transportLoading.classList.add('hidden')
	if (transportOptions) transportOptions.classList.remove('hidden')

	// Check if there's an error
	if (data.error) {
		if (transportOptions) {
			transportOptions.innerHTML = `<p class="error-message">${data.error}</p>`
		}
		return
	}

	// Populate transport options
	if (transportOptions && data.options && data.options.length > 0) {
		let optionsHTML = ''

		data.options.forEach(option => {
			const transportType = getTransportType(option)

			optionsHTML += `
					<div class="transport-option">
							<div class="transport-icon">
									<i class="${transportType.icon}"></i>
							</div>
							<div class="transport-details">
									<div class="transport-mode">${transportType.name}</div>
									<div class="transport-info">
											<span><i class="fas fa-clock"></i> ${extractTime(option)}</span>
											<span><i class="fas fa-euro-sign"></i> ${extractPrice(option)}</span>
									</div>
							</div>
					</div>`
		})

		transportOptions.innerHTML = optionsHTML
	} else {
		// No options or empty array
		if (transportOptions) {
			transportOptions.innerHTML =
				'<p class="no-options">Aucune option de transport trouvée. Essayez la marche à pied.</p>'
		}
	}
}

// Fallback for transport options if Socket.IO fails
function loadFallbackTransportOptions() {
	const stepCount = itinerairePoints.length

	// For each step (except the last one), load fallback transport options
	for (let i = 0; i < stepCount - 1; i++) {
		const currentStep = itinerairePoints[i]
		const nextStep = itinerairePoints[i + 1]

		const transportSection = document.getElementById(`transport-${i + 1}`)
		if (!transportSection) continue

		const transportLoading =
			transportSection.querySelector('.transport-loading')
		const transportOptions =
			transportSection.querySelector('.transport-options')

		// Hide loading indicator
		if (transportLoading) transportLoading.classList.add('hidden')
		if (transportOptions) transportOptions.classList.remove('hidden')

		// Generate fallback options
		if (transportOptions) {
			const distance = calculateDistance(
				currentStep.coordinates[0],
				currentStep.coordinates[1],
				nextStep.coordinates[0],
				nextStep.coordinates[1]
			)

			// Generate transport options based on distance
			const options = generateTransportOptions(
				distance,
				currentStep.address,
				nextStep.address
			)

			let optionsHTML = ''
			options.forEach(option => {
				optionsHTML += `
							<div class="transport-option">
									<div class="transport-icon">
											<i class="${option.icon}"></i>
									</div>
									<div class="transport-details">
											<div class="transport-mode">${option.mode}</div>
											<div class="transport-info">
													<span><i class="fas fa-clock"></i> ${option.time}</span>
													<span><i class="fas fa-euro-sign"></i> ${option.price}</span>
											</div>
									</div>
							</div>`
			})

			transportOptions.innerHTML = optionsHTML
		}
	}
}

// Generate transport options based on distance
function generateTransportOptions(distance, origin, destination) {
	const options = []

	// Walking option (5 km/h)
	const walkingMinutes = Math.round(distance * 12) // 5km/h = 12min/km
	options.push({
		mode: 'Marche à pied',
		icon: 'fas fa-walking',
		time:
			walkingMinutes < 60
				? `${walkingMinutes} min`
				: `${Math.floor(walkingMinutes / 60)}h ${walkingMinutes % 60}min`,
		price: '0€',
	})

	// Public transport option
	if (distance > 0.5) {
		const transitMinutes = Math.round(distance * 4) // ~15km/h = 4min/km
		const transitPrice = Math.round(1.5 + distance * 0.2) // Base price + distance factor
		options.push({
			mode: 'Transport public',
			icon: 'fas fa-bus',
			time:
				transitMinutes < 60
					? `${transitMinutes} min`
					: `${Math.floor(transitMinutes / 60)}h ${transitMinutes % 60}min`,
			price: `${transitPrice}€`,
		})
	}

	// Taxi option
	if (distance > 0.3) {
		const taxiMinutes = Math.round(distance * 2) // ~30km/h = 2min/km
		const taxiPrice = Math.round(5 + distance * 1.5) // Base price + distance factor
		options.push({
			mode: 'Taxi',
			icon: 'fas fa-taxi',
			time: `${taxiMinutes} min`,
			price: `${taxiPrice}€`,
		})
	}

	return options
}

// Calculate distance between two points in kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
	const R = 6371 // Radius of the Earth in km
	const dLat = deg2rad(lat2 - lat1)
	const dLon = deg2rad(lon2 - lon1)
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(deg2rad(lat1)) *
			Math.cos(deg2rad(lat2)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2)
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
	return R * c // Distance in km
}

function deg2rad(deg) {
	return deg * (Math.PI / 180)
}

// Initialize Leaflet map
function initMap() {
	try {
		// Create map
		const map = L.map('map', {
			zoomControl: true,
			scrollWheelZoom: true,
			doubleClickZoom: true,
			dragging: true,
			attributionControl: false,
		})

		// Add OpenStreetMap tiles
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19,
		}).addTo(map)

		// Define custom icon for markers
		const customIcon = L.icon({
			iconUrl:
				'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
			iconSize: [25, 41],
			iconAnchor: [12, 41],
			popupAnchor: [1, -34],
			shadowUrl:
				'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
			shadowSize: [41, 41],
		})

		// Create markers for each point in the itinerary
		const markers = []
		const points = []

		// Process itinerary points
		itinerairePoints.forEach((point, index) => {
			try {
				const [lat, lng] = point.coordinates
				points.push([lat, lng])

				// Create marker
				const marker = L.marker([lat, lng], {
					icon: customIcon,
					title: point.name,
				}).addTo(map)

				// Add popup with site info
				marker.bindPopup(`
									<strong>${point.name}</strong><br>
									${point.category}<br>
									<small>${point.address}</small>
							`)

				// Add number on marker
				const markerLabel = L.marker([lat, lng], {
					icon: L.divIcon({
						className: 'custom-marker-label',
						html: `<div style="background-color: white; border-radius: 50%; width: 20px; height: 20px; 
														 display: flex; align-items: center; justify-content: center; font-weight: bold;
														 border: 2px solid #4361ee; color: #4361ee; font-size: 12px;">${
																index + 1
															}</div>`,
						iconSize: [20, 20],
						iconAnchor: [10, 10],
					}),
				}).addTo(map)

				markers.push(marker)
			} catch (error) {
				console.error(`Error processing map point ${index}:`, error)
			}
		})

		// Draw route line between points
		if (points.length > 1) {
			try {
				const polyline = L.polyline(points, {
					color: '#4361ee',
					weight: 4,
				}).addTo(map)

				// Fit map to show all markers
				map.fitBounds(polyline.getBounds(), {
					padding: [50, 50],
				})
			} catch (error) {
				console.error('Error drawing route line:', error)
				// Fallback: center on first point
				if (points.length > 0) {
					map.setView(points[0], 13)
				}
			}
		} else if (points.length === 1) {
			// If only one point, center on it
			map.setView(points[0], 15)
		} else {
			// Fallback to a default location (Paris)
			map.setView([48.8566, 2.3522], 13)
		}

		// Add fullscreen control
		if (L.control.fullscreen) {
			L.control
				.fullscreen({
					position: 'topleft',
					title: 'Afficher en plein écran',
					titleCancel: 'Quitter le mode plein écran',
					content: '<i class="fas fa-expand"></i>',
				})
				.addTo(map)
		}

		// Cache map instance for potential future use
		window.tourGuideMap = map
	} catch (error) {
		console.error('Error initializing map:', error)
		document.getElementById('map').innerHTML =
			'<div class="map-error"><i class="fas fa-exclamation-triangle"></i> Impossible de charger la carte</div>'
	}
}

// Helper function to determine transport type and icon
function getTransportType(option) {
	const text = option.toLowerCase()

	if (text.includes('bus') || text.includes('autobus')) {
		return { name: 'Bus', icon: 'fas fa-bus' }
	} else if (
		text.includes('métro') ||
		text.includes('subway') ||
		text.includes('underground')
	) {
		return { name: 'Métro', icon: 'fas fa-subway' }
	} else if (text.includes('train') || text.includes('rail')) {
		return { name: 'Train', icon: 'fas fa-train' }
	} else if (text.includes('tram')) {
		return { name: 'Tramway', icon: 'fas fa-tram' }
	} else if (text.includes('taxi')) {
		return { name: 'Taxi', icon: 'fas fa-taxi' }
	} else if (
		text.includes('marche') ||
		text.includes('à pied') ||
		text.includes('walk')
	) {
		return { name: 'Marche', icon: 'fas fa-walking' }
	} else if (text.includes('vélo') || text.includes('bike')) {
		return { name: 'Vélo', icon: 'fas fa-bicycle' }
	} else if (text.includes('voiture') || text.includes('car')) {
		return { name: 'Voiture', icon: 'fas fa-car' }
	} else {
		return { name: 'Transport', icon: 'fas fa-shuttle-van' }
	}
}

// Helper function to extract time from the option text
function extractTime(option) {
	const timeMatch = option.match(/\b(\d+)h\s?(\d+)?min?|\b(\d+)\s?min/i)
	if (timeMatch) {
		if (timeMatch[1] && timeMatch[2]) {
			return `${timeMatch[1]}h ${timeMatch[2]}min`
		} else if (timeMatch[1]) {
			return `${timeMatch[1]}h`
		} else if (timeMatch[3]) {
			return `${timeMatch[3]}min`
		}
	}
	return 'Durée inconnue'
}

// Helper function to extract price from the option text
function extractPrice(option) {
	const priceMatch = option.match(/\b(\d+(?:[,.]\d+)?)\s?€/)
	if (priceMatch) {
		return `${priceMatch[1]}€`
	}
	return 'Prix inconnu'
}

// Initialize language selector functionality
function initLanguageSelector() {
	const languageLinks = document.querySelectorAll('.language-selector a')
	languageLinks.forEach(link => {
		link.addEventListener('click', function (e) {
			e.preventDefault()
			// Remove active class from all links
			languageLinks.forEach(l => l.classList.remove('active'))
			// Add active class to clicked link
			this.classList.add('active')

			// Update UI text based on selected language
			const lang = this.getAttribute('data-lang')
			updateUILanguage(lang)
		})
	})
}

// Initialize print button
function initPrintButton() {
	const printButton = document.getElementById('print-itinerary')
	if (printButton) {
		printButton.addEventListener('click', function () {
			// Prepare page for printing
			document.body.classList.add('printing')

			// Call browser print function
			window.print()

			// Remove printing class after delay
			setTimeout(() => {
				document.body.classList.remove('printing')
			}, 1000)
		})
	}
}

// Function to update UI text based on selected language
function updateUILanguage(lang) {
	const translations = {
		fr: {
			title: 'Votre itinéraire optimisé à',
			sites: 'sites',
			totalDistance: 'km au total',
			walkTime: 'à pied',
			steps: 'Étapes de votre parcours',
			nextDistance: "km jusqu'à la prochaine étape",
			loadingTransport: 'Chargement des options de transport...',
			noOptions:
				'Aucune option de transport trouvée. Essayez la marche à pied.',
			error: 'Impossible de charger les options de transport.',
			modify: 'Modifier la sélection',
			print: "Imprimer l'itinéraire",
			hours: 'h',
			minutes: 'min',
		},
		en: {
			title: 'Your optimized itinerary in',
			sites: 'sites',
			totalDistance: 'km total',
			walkTime: 'walking',
			steps: 'Your route steps',
			nextDistance: 'km to the next step',
			loadingTransport: 'Loading transport options...',
			noOptions: 'No transport options found. Try walking.',
			error: 'Unable to load transport options.',
			modify: 'Modify selection',
			print: 'Print itinerary',
			hours: 'h',
			minutes: 'min',
		},
		ro: {
			title: 'Itinerariul dvs. optimizat în',
			sites: 'obiective',
			totalDistance: 'km în total',
			walkTime: 'pe jos',
			steps: 'Etapele traseului dvs.',
			nextDistance: 'km până la următoarea etapă',
			loadingTransport: 'Se încarcă opțiunile de transport...',
			noOptions: 'Nu s-au găsit opțiuni de transport. Încercați mersul pe jos.',
			error: 'Imposibil de încărcat opțiunile de transport.',
			modify: 'Modificați selecția',
			print: 'Imprimați itinerariul',
			hours: 'h',
			minutes: 'min',
		},
	}

	try {
		// Update page title
		const pageTitle = document.querySelector('.page-header h1')
		if (pageTitle) {
			const cityName = pageTitle.querySelector('.accent').textContent
			pageTitle.innerHTML = `${translations[lang].title} <span class="accent">${cityName}</span>`
		}

		// Update stats
		const statsElements = document.querySelectorAll('.stat span')
		if (statsElements.length >= 3) {
			const sitesCount = statsElements[0].textContent.split(' ')[0]
			const distance = statsElements[1].textContent.split(' ')[0]
			const time = statsElements[2].textContent.match(/(\d+)h\s+(\d+)min/)

			statsElements[0].textContent = `${sitesCount} ${translations[lang].sites}`
			statsElements[1].textContent = `${distance} ${translations[lang].totalDistance}`

			if (time && time.length >= 3) {
				statsElements[2].textContent = `${time[1]}${translations[lang].hours} ${time[2]}${translations[lang].minutes} ${translations[lang].walkTime}`
			}
		}

		// Update steps title
		const stepsTitle = document.querySelector('.itinerary-steps h2')
		if (stepsTitle) {
			stepsTitle.textContent = translations[lang].steps
		}

		// Update next distance text
		const nextDistanceElements = document.querySelectorAll(
			'.next-distance span'
		)
		nextDistanceElements.forEach(element => {
			const distance = element.textContent.split(' ')[0]
			element.textContent = `${distance} ${translations[lang].nextDistance}`
		})

		// Update transport loading text
		const transportLoadingElements = document.querySelectorAll(
			'.transport-loading span'
		)
		transportLoadingElements.forEach(element => {
			element.textContent = translations[lang].loadingTransport
		})

		// Update no options message
		const noOptionsElements = document.querySelectorAll('.no-options')
		noOptionsElements.forEach(element => {
			element.textContent = translations[lang].noOptions
		})

		// Update error messages
		const errorElements = document.querySelectorAll('.error-message')
		errorElements.forEach(element => {
			element.textContent = translations[lang].error
		})

		// Update action buttons
		const modifyButton = document.querySelector(
			'.action-buttons .btn-secondary'
		)
		const printButton = document.querySelector('.action-buttons .btn-primary')
		if (modifyButton) {
			modifyButton.innerHTML = `<i class="fas fa-edit"></i> ${translations[lang].modify}`
		}
		if (printButton) {
			printButton.innerHTML = `<i class="fas fa-print"></i> ${translations[lang].print}`
		}
	} catch (error) {
		console.error('Error updating UI language:', error)
	}
}
