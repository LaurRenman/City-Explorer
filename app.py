from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from flask_socketio import SocketIO, emit
import os
import sys
import json
import time
import concurrent.futures
from threading import Thread
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add parent directory to path to allow imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import modules from project
from modules.API_Tourist_Sites import RecuperateurSitesTouristiques, OptimiseurItineraire
from modules.scraping import get_itineraries_for_pair

# Create Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'tourguide_secret_key'
app.config['JSON_AS_ASCII'] = False
app.config['TIMEOUT'] = 60  # Increased timeout

# Initialize Socket.IO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Initialize site retriever
recup = RecuperateurSitesTouristiques()

# Initialize route optimizer
optimiseur = OptimiseurItineraire(recup)

# Cache for storing transport data
transport_cache = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/lieux', methods=['GET', 'POST'])
def lieux():
    try:
        # For POST requests (from the homepage form)
        if request.method == 'POST':
            ville = request.form.get('ville')
            nombre_sites = int(request.form.get('nombre_sites', 10))
            
            # Get tourist sites using the API
            sites = recup.obtenir_sites_filtres(ville, [], [], nombre_sites=nombre_sites)
            
            # If no results, try local data
            if not sites:
                sites = recup.obtenir_sites_locaux(ville)
            
            # If still no results, use default data
            if not sites:
                sites = recup.generer_sites_par_defaut(ville)
                
            # Get unique categories for filtering
            categories = sorted(list(set(site.get('categorie', '') for site in sites)))
            
            return render_template('sites.html', 
                                ville=ville, 
                                sites=sites, 
                                categories=categories,
                                sites_json=json.dumps(sites, ensure_ascii=False))
        
        # For GET requests
        ville = request.args.get('ville')
        
        # Special case for the "Modifier la sélection" button
        if ville and request.args.get('_method') == 'POST':
            nombre_sites = int(request.args.get('nombre_sites', 10))
            
            # Get tourist sites using the API
            sites = recup.obtenir_sites_filtres(ville, [], [], nombre_sites=nombre_sites)
            
            # If no results, try local data
            if not sites:
                sites = recup.obtenir_sites_locaux(ville)
            
            # If still no results, use default data
            if not sites:
                sites = recup.generer_sites_par_defaut(ville)
                
            # Get unique categories for filtering
            categories = sorted(list(set(site.get('categorie', '') for site in sites)))
            
            return render_template('sites.html', 
                                ville=ville, 
                                sites=sites, 
                                categories=categories,
                                sites_json=json.dumps(sites, ensure_ascii=False))
        
        # For normal GET requests without a city parameter or without _method=POST
        if not ville:
            return redirect(url_for('index'))
        
        # This case should be rare - handles a GET request with ville but no _method
        return render_template('error.html', error="Erreur de paramètres pour la recherche de sites touristiques. Veuillez réessayer.")
        
    except Exception as e:
        logger.error(f"Error in lieux route: {str(e)}")
        return render_template('error.html', error="Une erreur est survenue lors de la recherche des sites touristiques.")
    
@app.route('/generer-itineraire', methods=['POST'])
def generer_itineraire():
    try:
        ville = request.form.get('ville')
        sites_selected = request.form.getlist('sites_selected')
        starting_point = request.form.get('starting_point', '0')
        
        # Get sites data from form
        sites_data = request.form.get('sites_data')
        
        if sites_data:
            try:
                all_sites = json.loads(sites_data)
            except json.JSONDecodeError:
                all_sites = []
        else:
            all_sites = []
        
        # If no data, fetch again
        if not all_sites:
            all_sites = recup.obtenir_sites_filtres(ville, [], [], nombre_sites=20)
            if not all_sites:
                all_sites = recup.obtenir_sites_locaux(ville)
            if not all_sites:
                all_sites = recup.generer_sites_par_defaut(ville)
        
        # Filter selected sites
        selected_sites = []
        try:
            for idx in sites_selected:
                index = int(idx)
                if 0 <= index < len(all_sites):
                    selected_sites.append(all_sites[index])
        except (ValueError, IndexError):
            pass
        
        # If no sites selected, use all sites (up to 10)
        if not selected_sites:
            selected_sites = all_sites[:min(10, len(all_sites))]
        
        # Get starting point site
        starting_site = None
        try:
            starting_index = int(starting_point)
            if 0 <= starting_index < len(sites_selected):
                site_idx = int(sites_selected[starting_index])
                if 0 <= site_idx < len(all_sites):
                    starting_site = all_sites[site_idx]
        except (ValueError, IndexError):
            pass
        
        # If no starting point selected, use first site
        if not starting_site and selected_sites:
            starting_site = selected_sites[0]
        
        # Optimize route
        if starting_site:
            itineraire = optimiseur.optimiser_itineraire(selected_sites, ville, starting_site['nom'])
        else:
            itineraire = []
        
        if not itineraire and selected_sites:
            # If optimization failed, just use selected sites in original order
            itineraire = selected_sites
            # Calculate distances between consecutive sites
            for i in range(len(itineraire) - 1):
                itineraire[i]['distance_suivant'] = 0.5  # Default distance
            if itineraire:
                itineraire[-1]['distance_suivant'] = 0
        
        # Calculate total distance and walking time
        total_distance = sum(site.get('distance_suivant', 0) for site in itineraire)
        hours = int(total_distance / 5)  # Assuming 5 km/h walking speed
        minutes = int((total_distance / 5 - hours) * 60)
        
        # Prepare map data
        itineraire_points = []
        for site in itineraire:
            coordinates = site.get('coordonnees')
            if not coordinates and 'adresse' in site:
                # Try to geocode on-the-fly if missing coordinates
                coordinates = optimiseur.obtenir_coordonnees(site['adresse'], ville)
                site['coordonnees'] = coordinates
            
            if coordinates:
                itineraire_points.append({
                    'name': site.get('nom', ''),
                    'category': site.get('categorie', ''),
                    'address': site.get('adresse', ''),
                    'coordinates': coordinates
                })
        
        return render_template('itineraire.html', 
                            ville=ville, 
                            itineraire=itineraire, 
                            distance_totale=total_distance,
                            duree={'heures': hours, 'minutes': minutes},
                            itineraire_points=itineraire_points)
    except Exception as e:
        logger.error(f"Error in generer_itineraire route: {str(e)}")
        return render_template('error.html', error="Une erreur est survenue lors de la génération de l'itinéraire.")

@app.route('/transport-options', methods=['POST'])
def transport_options():
    data = request.json
    origin = data.get('origin')
    destination = data.get('destination')
    
    if not origin or not destination:
        return jsonify([])
    
    # Check cache first
    cache_key = f"{origin}_{destination}".lower()
    if cache_key in transport_cache:
        logger.info(f"Using cached transport options for {origin} to {destination}")
        return jsonify(transport_cache[cache_key])
    
    # Get transport options using the scraping module with timeout
    try:
        logger.info(f"Fetching transport options for {origin} to {destination}")
        transport_options = get_itineraries_for_pair(origin, destination)
        
        # Cache the results (with default options if empty)
        if not transport_options:
            transport_options = [
                f"Adresse: {origin} → {destination} | Moyen: Marche à pied | Temps: 30min | Prix: 0€",
                f"Adresse: {origin} → {destination} | Moyen: Taxi | Temps: 10min | Prix: 15€"
            ]
        
        transport_cache[cache_key] = transport_options
        return jsonify(transport_options)
    except Exception as e:
        logger.error(f"Error getting transport options: {e}")
        # Return fallback options
        fallback_options = [
            f"Adresse: {origin} → {destination} | Moyen: Marche à pied | Temps: 30min | Prix: 0€",
            f"Adresse: {origin} → {destination} | Moyen: Taxi | Temps: 10min | Prix: 15€"
        ]
        return jsonify(fallback_options)

@socketio.on('request_transport')
def handle_transport_request(data):
    origin = data.get('origin')
    destination = data.get('destination')
    step_id = data.get('step_id')
    
    if not origin or not destination:
        emit('transport_result', {'error': 'Données invalides', 'step_id': step_id, 'success': False})
        return
    
    # Check cache first
    cache_key = f"{origin}_{destination}".lower()
    if cache_key in transport_cache:
        emit('transport_result', {
            'options': transport_cache[cache_key],
            'step_id': step_id,
            'success': True
        })
        return
    
    # Start a background task to not block
    Thread(target=fetch_transport_options, args=(origin, destination, step_id)).start()

def fetch_transport_options(origin, destination, step_id):
    try:
        # Set a timeout for the scraping
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(get_itineraries_for_pair, origin, destination)
            try:
                transport_options = future.result(timeout=20)  # 20 second timeout
            except concurrent.futures.TimeoutError:
                logger.warning(f"Transport options fetch timed out for {origin} to {destination}")
                transport_options = [
                    f"Adresse: {origin} → {destination} | Moyen: Marche à pied | Temps: 30min | Prix: 0€",
                    f"Adresse: {origin} → {destination} | Moyen: Taxi | Temps: 10min | Prix: 15€"
                ]
        
        # Cache the results
        cache_key = f"{origin}_{destination}".lower()
        transport_cache[cache_key] = transport_options
        
        socketio.emit('transport_result', {
            'options': transport_options,
            'step_id': step_id,
            'success': True
        })
    except Exception as e:
        logger.error(f"Error fetching transport options: {e}")
        # Send fallback options
        fallback_options = [
            f"Adresse: {origin} → {destination} | Moyen: Marche à pied | Temps: 30min | Prix: 0€",
            f"Adresse: {origin} → {destination} | Moyen: Taxi | Temps: 10min | Prix: 15€"
        ]
        socketio.emit('transport_result', {
            'options': fallback_options,
            'step_id': step_id,
            'success': True,
            'fallback': True
        })

@app.errorhandler(404)
def page_not_found(e):
    return render_template('error.html', error="Page non trouvée"), 404

@app.errorhandler(500)
def internal_server_error(e):
    return render_template('error.html', error="Erreur interne du serveur"), 500

if __name__ == '__main__':
    # Create necessary directories
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)
    os.makedirs('modules', exist_ok=True)
    
    # Run the application
    socketio.run(app, debug=True, host='0.0.0.0', port=8000)
