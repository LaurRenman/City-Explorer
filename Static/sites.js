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

	// Category filter functionality with debouncing
	initCategoryFilter()

	// Select/Deselect all buttons
	initBulkSelection()

	// Form submission with loading state
	initItineraryForm()

	// Process sites JSON if available
	processSitesData()
})

// Process sites data from JSON if available
function processSitesData() {
	// Check if sites data is available
	const sitesDataElement = document.getElementById('sites-data')
	if (sitesDataElement) {
		try {
			// Parse the JSON data
			const sitesData = JSON.parse(sitesDataElement.textContent)

			// Store in window for potential use
			window.sitesData = sitesData

			// Pre-compute categories for filtering
			const categories = new Set()
			sitesData.forEach(site => {
				if (site.categorie) {
					categories.add(site.categorie)
				}
			})
			window.siteCategories = Array.from(categories).sort()

			// Enhance category filter dropdown
			enhanceCategoryDropdown(window.siteCategories)
		} catch (error) {
			console.error('Error parsing sites data:', error)
		}
	}
}

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

// Initialize category filter with debouncing
function initCategoryFilter() {
	const categoryFilter = document.getElementById('category-filter')

	if (categoryFilter) {
		// Add change event listener with debouncing
		let filterTimeout
		categoryFilter.addEventListener('change', function () {
			// Clear previous timeout
			if (filterTimeout) {
				clearTimeout(filterTimeout)
			}

			// Show loading state for filter
			document.body.classList.add('filtering')

			// Set timeout for filter operation (debouncing)
			filterTimeout = setTimeout(() => {
				const selectedCategory = this.value
				filterSites(selectedCategory)

				// Save selected category in localStorage
				localStorage.setItem('lastSelectedCategory', selectedCategory)

				// Remove loading state
				document.body.classList.remove('filtering')
			}, 50)
		})

		// Load last selected category from localStorage
		const lastCategory = localStorage.getItem('lastSelectedCategory')
		if (lastCategory) {
			// Check if the category exists in the dropdown
			const option = categoryFilter.querySelector(
				`option[value="${lastCategory}"]`
			)
			if (option) {
				categoryFilter.value = lastCategory
				// Trigger change event to apply filter
				const event = new Event('change')
				categoryFilter.dispatchEvent(event)
			}
		}
	}
}

// Filter sites by category
function filterSites(category) {
	const siteCards = document.querySelectorAll('.site-card')

	// Use requestAnimationFrame for smoother filtering
	requestAnimationFrame(() => {
		siteCards.forEach(card => {
			const cardCategory = card.getAttribute('data-category')

			if (category === 'all' || cardCategory === category) {
				// Show the card with fade-in effect
				card.style.display = 'flex'
				card.style.opacity = '0'

				requestAnimationFrame(() => {
					card.style.opacity = '1'
				})
			} else {
				// Hide the card
				card.style.display = 'none'
			}
		})
	})

	// Update count of visible sites
	updateVisibleSitesCount()
}

// Update count of visible sites
function updateVisibleSitesCount() {
	const visibleSites = document.querySelectorAll(
		'.site-card[style*="display: flex"]'
	).length
	const totalSites = document.querySelectorAll('.site-card').length

	const subtitle = document.querySelector('.subtitle')
	if (subtitle) {
		const lang = getCurrentLanguage()
		const translations = {
			fr: `${visibleSites} sites affichés sur ${totalSites}`,
			en: `${visibleSites} sites displayed out of ${totalSites}`,
			ro: `${visibleSites} obiective afișate din ${totalSites}`,
		}

		subtitle.textContent = translations[lang] || translations['fr']
	}
}

// Get current language
function getCurrentLanguage() {
	const activeLanguage = document.querySelector('.language-selector a.active')
	return activeLanguage ? activeLanguage.getAttribute('data-lang') : 'fr'
}

// Initialize bulk selection buttons
function initBulkSelection() {
	const selectAllBtn = document.getElementById('select-all')
	const deselectAllBtn = document.getElementById('deselect-all')

	if (selectAllBtn) {
		selectAllBtn.addEventListener('click', function () {
			const visibleCheckboxes = document.querySelectorAll(
				'.site-card[style*="display: flex"] input[name="sites_selected"]'
			)
			visibleCheckboxes.forEach(checkbox => {
				checkbox.checked = true
			})

			// Add feedback animation
			this.classList.add('btn-flash')
			setTimeout(() => {
				this.classList.remove('btn-flash')
			}, 300)
		})
	}

	if (deselectAllBtn) {
		deselectAllBtn.addEventListener('click', function () {
			const visibleCheckboxes = document.querySelectorAll(
				'.site-card[style*="display: flex"] input[name="sites_selected"]'
			)
			visibleCheckboxes.forEach(checkbox => {
				checkbox.checked = false
			})

			// Add feedback animation
			this.classList.add('btn-flash')
			setTimeout(() => {
				this.classList.remove('btn-flash')
			}, 300)
		})
	}
}

// Enhanced category dropdown
function enhanceCategoryDropdown(categories) {
	const categoryFilter = document.getElementById('category-filter')
	if (!categoryFilter) return

	// Get the language for translations
	const lang = getCurrentLanguage()

	// Translations for "All categories"
	const allCategoriesText =
		{
			fr: 'Toutes les catégories',
			en: 'All categories',
			ro: 'Toate categoriile',
		}[lang] || 'Toutes les catégories'

	// Create options HTML
	let optionsHTML = `<option value="all">${allCategoriesText}</option>`

	// Add count of sites per category
	if (window.sitesData) {
		const categoryCount = {}

		// Count sites in each category
		window.sitesData.forEach(site => {
			const category = site.categorie
			if (category) {
				categoryCount[category] = (categoryCount[category] || 0) + 1
			}
		})

		// Create options with counts
		categories.forEach(category => {
			const count = categoryCount[category] || 0
			optionsHTML += `<option value="${category}">${category} (${count})</option>`
		})
	} else {
		// Fallback if no site data is available
		categories.forEach(category => {
			optionsHTML += `<option value="${category}">${category}</option>`
		})
	}

	// Update dropdown
	categoryFilter.innerHTML = optionsHTML
}

// Initialize itinerary form with enhanced validation
function initItineraryForm() {
	const itineraryForm = document.getElementById('itinerary-form')

	if (itineraryForm) {
		itineraryForm.addEventListener('submit', function (e) {
			e.preventDefault()

			// Verify at least one site is selected
			const selectedSites = document.querySelectorAll(
				'input[name="sites_selected"]:checked'
			)
			if (selectedSites.length === 0) {
				showFeedbackModal('Veuillez sélectionner au moins un site touristique.')
				return
			}

			// Show loading state with detailed progress
			loadingManager.show('Optimisation de votre itinéraire...')

			// Progress animation
			let progressDots = 0
			const loadingMessages = [
				'Optimisation de votre itinéraire',
				'Calcul des coordonnées géographiques',
				'Recherche du meilleur parcours',
				"Finalisation de l'itinéraire",
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
					"L'optimisation de l'itinéraire prend plus de temps que prévu. Le serveur pourrait être occupé. Veuillez réessayer dans quelques instants."
				)
			}, 30000)

			// Add sites data to form
			const sitesDataInput = document.createElement('input')
			sitesDataInput.type = 'hidden'
			sitesDataInput.name = 'sites_data'
			sitesDataInput.value =
				document.getElementById('sites-data')?.textContent || '[]'
			this.appendChild(sitesDataInput)

			// Submit the form
			fetch('/generer-itineraire', {
				method: 'POST',
				body: new FormData(this),
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
						"Une erreur est survenue lors de la génération de l'itinéraire. Veuillez réessayer."
					)
				})
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
			title: 'Sites touristiques à',
			subtitle:
				'Sélectionnez les sites que vous souhaitez visiter et définissez votre point de départ.',
			filter: 'Filtrer par catégorie:',
			allCategories: 'Toutes les catégories',
			selectAll: 'Tout sélectionner',
			deselectAll: 'Tout désélectionner',
			startHere: 'Démarrer ici',
			back: 'Retour',
			generate: "Générer l'itinéraire",
			loading: 'Optimisation de votre itinéraire...',
		},
		en: {
			title: 'Tourist sites in',
			subtitle:
				'Select the sites you want to visit and set your starting point.',
			filter: 'Filter by category:',
			allCategories: 'All categories',
			selectAll: 'Select all',
			deselectAll: 'Deselect all',
			startHere: 'Start here',
			back: 'Back',
			generate: 'Generate itinerary',
			loading: 'Optimizing your itinerary...',
		},
		ro: {
			title: 'Obiective turistice în',
			subtitle:
				'Selectați obiectivele pe care doriți să le vizitați și stabiliți punctul de plecare.',
			filter: 'Filtrare după categorie:',
			allCategories: 'Toate categoriile',
			selectAll: 'Selectează tot',
			deselectAll: 'Deselectează tot',
			startHere: 'Pornește de aici',
			back: 'Înapoi',
			generate: 'Generează itinerariul',
			loading: 'Se optimizează itinerariul dvs...',
		},
	}

	try {
		// Update page title and subtitle
		const pageTitle = document.querySelector('.page-header h1')
		const pageSubtitle = document.querySelector('.subtitle')
		if (pageTitle) {
			const cityName = pageTitle.querySelector('.accent').textContent
			pageTitle.innerHTML = `${translations[lang].title} <span class="accent">${cityName}</span>`
		}

		// Update visible sites count
		updateVisibleSitesCount()

		// Update filter label
		const filterLabel = document.querySelector('.filter-group label')
		if (filterLabel) {
			filterLabel.textContent = translations[lang].filter
		}

		// Update category filter options
		const allCategoriesOption = document.querySelector(
			'#category-filter option[value="all"]'
		)
		if (allCategoriesOption) {
			allCategoriesOption.textContent = translations[lang].allCategories
		}

		// Update buttons
		const selectAllBtn = document.getElementById('select-all')
		const deselectAllBtn = document.getElementById('deselect-all')
		if (selectAllBtn) {
			selectAllBtn.innerHTML = `<i class="fas fa-check-square"></i> ${translations[lang].selectAll}`
		}
		if (deselectAllBtn) {
			deselectAllBtn.innerHTML = `<i class="fas fa-square"></i> ${translations[lang].deselectAll}`
		}

		// Update starting point labels
		const startingPointLabels = document.querySelectorAll(
			'.starting-point label'
		)
		startingPointLabels.forEach(label => {
			label.textContent = translations[lang].startHere
		})

		// Update action buttons
		const backButton = document.querySelector('.action-buttons .btn-secondary')
		const generateButton = document.querySelector(
			'.action-buttons .btn-primary'
		)
		if (backButton) {
			backButton.innerHTML = `<i class="fas fa-arrow-left"></i> ${translations[lang].back}`
		}
		if (generateButton) {
			generateButton.innerHTML = `<i class="fas fa-route"></i> ${translations[lang].generate}`
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
// Fix for the select/deselect all buttons

// Add this function to directly fix the select/deselect all buttons functionality
document.addEventListener('DOMContentLoaded', function () {
	// Select All button
	const selectAllBtn = document.getElementById('select-all')
	if (selectAllBtn) {
		selectAllBtn.addEventListener('click', function () {
			const checkboxes = document.querySelectorAll(
				'input[name="sites_selected"]'
			)
			checkboxes.forEach(checkbox => {
				const siteCard = checkbox.closest('.site-card')
				if (!siteCard || siteCard.style.display !== 'none') {
					checkbox.checked = true
				}
			})
		})
	}

	// Deselect All button
	const deselectAllBtn = document.getElementById('deselect-all')
	if (deselectAllBtn) {
		deselectAllBtn.addEventListener('click', function () {
			const checkboxes = document.querySelectorAll(
				'input[name="sites_selected"]'
			)
			checkboxes.forEach(checkbox => {
				const siteCard = checkbox.closest('.site-card')
				if (!siteCard || siteCard.style.display !== 'none') {
					checkbox.checked = false
				}
			})
		})
	}

	// Category filter functionality
	const categoryFilter = document.getElementById('category-filter')
	if (categoryFilter) {
		categoryFilter.addEventListener('change', function () {
			const selectedCategory = this.value

			const siteCards = document.querySelectorAll('.site-card')
			siteCards.forEach(card => {
				if (
					selectedCategory === 'all' ||
					card.getAttribute('data-category') === selectedCategory
				) {
					card.style.display = 'flex'
				} else {
					card.style.display = 'none'
				}
			})
		})
	}

	// Form submission with loading state
	const itineraryForm = document.getElementById('itinerary-form')
	if (itineraryForm) {
		itineraryForm.addEventListener('submit', function (e) {
			// Verify at least one site is selected
			const selectedSites = document.querySelectorAll(
				'input[name="sites_selected"]:checked'
			)
			if (selectedSites.length === 0) {
				alert('Veuillez sélectionner au moins un site touristique.')
				e.preventDefault()
				return false
			}

			// Show loading overlay
			const loadingOverlay = document.getElementById('loading-overlay')
			const loadingText = document.getElementById('loading-text')

			if (loadingOverlay) {
				loadingOverlay.classList.remove('hidden')
			}

			if (loadingText) {
				loadingText.textContent = 'Optimisation de votre itinéraire...'
			}

			return true
		})
	}
})
