document.addEventListener('DOMContentLoaded', function () {
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
		updateProgress: function (message, dots) {
			const loadingText = document.getElementById('loading-text')
			if (loadingText) {
				loadingText.textContent = message + '.'.repeat(dots)
			}
		},
	}

	// Language selector functionality
	initLanguageSelector()

	// Form submission with loading state
	initCityForm()

	// Add animation on scroll for feature cards
	initScrollAnimations()

	// Add event listeners for the search box focus effects
	initSearchBoxEffects()
})

// Initialize language selector
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

			// Save selected language in localStorage
			localStorage.setItem('preferredLanguage', lang)
		})
	})

	// Load preferred language from localStorage
	const savedLanguage = localStorage.getItem('preferredLanguage')
	if (savedLanguage) {
		const langLink = document.querySelector(
			`.language-selector a[data-lang="${savedLanguage}"]`
		)
		if (langLink && !langLink.classList.contains('active')) {
			// Trigger click to apply saved language
			langLink.click()
		}
	}
}

// Initialize city form with enhanced loading feedback
function initCityForm() {
	const cityForm = document.getElementById('city-form')

	if (cityForm) {
		cityForm.addEventListener('submit', function (e) {
			e.preventDefault()
			const cityInput = document.getElementById('city-input')
			const sitesCount = document.getElementById('sites-count')

			if (cityInput.value.trim() === '') {
				cityInput.focus()
				// Add shake animation for invalid input
				cityInput.classList.add('shake')
				setTimeout(() => {
					cityInput.classList.remove('shake')
				}, 500)
				return
			}

			// Show loading state
			loadingManager.show("Connexion à l'API...")

			// Create form data for submission
			const formData = new FormData()
			formData.append('ville', cityInput.value)
			formData.append('nombre_sites', sitesCount.value)

			// Start progress animation
			let progressDots = 0
			const loadingMessages = [
				"Connexion à l'API",
				'Recherche des sites touristiques',
				'Analyse des résultats',
				'Préparation des données',
				'Finalisation',
			]
			let messageIndex = 0

			const loadingInterval = setInterval(() => {
				progressDots = (progressDots + 1) % 4

				// Change message periodically to indicate progress
				if (progressDots === 0 && messageIndex < loadingMessages.length - 1) {
					messageIndex++
				}

				loadingManager.updateProgress(
					loadingMessages[messageIndex],
					progressDots
				)
			}, 500)

			// Set timeout for long-running requests
			const fetchTimeout = setTimeout(() => {
				clearInterval(loadingInterval)
				loadingManager.hide()
				showFeedbackModal(
					'La recherche prend plus de temps que prévu. Le serveur pourrait être occupé. Veuillez réessayer dans quelques instants.'
				)
			}, 30000)

			// Submit the form via AJAX
			fetch('/lieux', {
				method: 'POST',
				body: formData,
			})
				.then(response => {
					clearTimeout(fetchTimeout)
					clearInterval(loadingInterval)

					if (response.ok) {
						if (response.redirected) {
							window.location.href = response.url
						} else {
							return response.text().then(html => {
								// Handle non-redirect success response
								document.open()
								document.write(html)
								document.close()
								window.history.pushState(
									{},
									'',
									'/lieux?ville=' + encodeURIComponent(cityInput.value)
								)
							})
						}
					} else {
						// Handle HTTP errors
						throw new Error('HTTP error, status: ' + response.status)
					}
				})
				.catch(error => {
					console.error('Error during form submission:', error)
					clearTimeout(fetchTimeout)
					clearInterval(loadingInterval)
					loadingManager.hide()
					showFeedbackModal(
						'Une erreur est survenue lors de la recherche. Veuillez réessayer.'
					)
				})
		})
	}
}

// Initialize scroll animations
function initScrollAnimations() {
	const featureCards = document.querySelectorAll('.feature-card')

	if (featureCards.length > 0) {
		if ('IntersectionObserver' in window) {
			const observer = new IntersectionObserver(
				entries => {
					entries.forEach(entry => {
						if (entry.isIntersecting) {
							entry.target.classList.add('animate__fadeInUp')
							observer.unobserve(entry.target)
						}
					})
				},
				{
					threshold: 0.1,
				}
			)

			featureCards.forEach(card => {
				observer.observe(card)
			})
		} else {
			// Fallback for browsers that don't support IntersectionObserver
			featureCards.forEach(card => {
				card.classList.add('animate__fadeInUp')
			})
		}
	}
}

// Initialize search box effects
function initSearchBoxEffects() {
	const searchBox = document.querySelector('.search-container')
	const cityInput = document.getElementById('city-input')

	if (searchBox && cityInput) {
		// Add focus effect
		cityInput.addEventListener('focus', () => {
			searchBox.classList.add('focused')
		})

		cityInput.addEventListener('blur', () => {
			searchBox.classList.remove('focused')
		})
	}
}

// Show feedback modal
function showFeedbackModal(message) {
	// Check if modal already exists
	let modal = document.getElementById('feedback-modal')

	if (!modal) {
		// Create modal if it doesn't exist
		modal = document.createElement('div')
		modal.id = 'feedback-modal'
		modal.className = 'feedback-modal'
		modal.innerHTML = `
					<div class="feedback-content">
							<div class="feedback-header">
									<i class="fas fa-exclamation-circle"></i>
									<h3>Information</h3>
							</div>
							<div class="feedback-message"></div>
							<button class="btn-primary close-modal">OK</button>
					</div>
			`
		document.body.appendChild(modal)

		// Add event listener to close button
		modal.querySelector('.close-modal').addEventListener('click', () => {
			modal.classList.remove('active')
		})
	}

	// Update message and show modal
	modal.querySelector('.feedback-message').textContent = message
	modal.classList.add('active')
}

// Function to update UI text based on selected language
function updateUILanguage(lang) {
	const translations = {
		fr: {
			title: 'Découvrez la meilleure façon de visiter',
			subtitle:
				'Planifiez votre itinéraire optimisé avec les meilleurs sites touristiques et obtenez des recommandations de transport entre chaque étape.',
			placeholder: "Entrez le nom d'une ville...",
			button: 'Découvrir',
			sites: 'sites',
			feature1: 'IA Recommandations',
			feature1desc:
				'Découvrez les meilleurs sites touristiques sélectionnés par notre IA.',
			feature2: 'Itinéraires Optimisés',
			feature2desc:
				'Obtenez le parcours le plus efficace entre tous les sites que vous souhaitez visiter.',
			feature3: 'Options de Transport',
			feature3desc:
				'Comparez les différents moyens de transport entre chaque étape.',
			loading: 'Recherche des meilleurs sites touristiques...',
		},
		en: {
			title: 'Discover the best way to visit',
			subtitle:
				'Plan your optimized itinerary with the best tourist attractions and get transportation recommendations between each step.',
			placeholder: 'Enter a city name...',
			button: 'Discover',
			sites: 'sites',
			feature1: 'AI Recommendations',
			feature1desc: 'Discover the best tourist sites selected by our AI.',
			feature2: 'Optimized Routes',
			feature2desc:
				'Get the most efficient route between all the sites you want to visit.',
			feature3: 'Transport Options',
			feature3desc:
				'Compare different modes of transportation between each step.',
			loading: 'Searching for the best tourist sites...',
		},
		ro: {
			title: 'Descoperiți cel mai bun mod de a vizita',
			subtitle:
				'Planificați-vă itinerariul optimizat cu cele mai bune atracții turistice și obțineți recomandări de transport între fiecare etapă.',
			placeholder: 'Introduceți numele unui oraș...',
			button: 'Descoperă',
			sites: 'obiective',
			feature1: 'Recomandări AI',
			feature1desc:
				'Descoperiți cele mai bune obiective turistice selectate de AI-ul nostru.',
			feature2: 'Trasee Optimizate',
			feature2desc:
				'Obțineți cel mai eficient traseu între toate obiectivele pe care doriți să le vizitați.',
			feature3: 'Opțiuni de Transport',
			feature3desc:
				'Comparați diferite mijloace de transport între fiecare etapă.',
			loading: 'Căutarea celor mai bune obiective turistice...',
		},
	}

	try {
		// Update title and subtitle
		const heroTitle = document.querySelector('.hero-section h1')
		const heroSubtitle = document.querySelector('.hero-section p')
		if (heroTitle) {
			heroTitle.innerHTML = `${translations[lang].title} <span class="accent">n'importe quelle ville</span>`
		}
		if (heroSubtitle) {
			heroSubtitle.textContent = translations[lang].subtitle
		}

		// Update form elements
		const cityInput = document.getElementById('city-input')
		const searchButton = document.querySelector('.search-button')
		if (cityInput) {
			cityInput.placeholder = translations[lang].placeholder
		}
		if (searchButton) {
			searchButton.innerHTML =
				translations[lang].button + ' <i class="fas fa-chevron-right"></i>'
		}

		// Update sites count dropdown options
		const sitesCount = document.getElementById('sites-count')
		if (sitesCount) {
			const options = sitesCount.querySelectorAll('option')
			options.forEach(option => {
				const count = option.value
				option.textContent = count + ' ' + translations[lang].sites
			})
		}

		// Update features
		const featureTitles = document.querySelectorAll('.feature-card h3')
		const featureDescs = document.querySelectorAll('.feature-card p')
		if (featureTitles.length >= 3) {
			featureTitles[0].textContent = translations[lang].feature1
			featureTitles[1].textContent = translations[lang].feature2
			featureTitles[2].textContent = translations[lang].feature3
		}
		if (featureDescs.length >= 3) {
			featureDescs[0].textContent = translations[lang].feature1desc
			featureDescs[1].textContent = translations[lang].feature2desc
			featureDescs[2].textContent = translations[lang].feature3desc
		}

		// Update loading text
		const loadingText = document.getElementById('loading-text')
		if (loadingText) {
			loadingText.textContent = translations[lang].loading
		}
	} catch (error) {
		console.error('Error updating UI language:', error)
	}
}
