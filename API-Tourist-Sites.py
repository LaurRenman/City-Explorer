import requests
import json
import os
import time
import threading
import concurrent.futures
from dotenv import load_dotenv
from geopy.distance import geodesic
from geopy.geocoders import Nominatim
from tabulate import tabulate

# Chargement de la clé API 
DEFAULT_API_KEY = "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"
try:
    load_dotenv()
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", DEFAULT_API_KEY)
except:
    GROQ_API_KEY = DEFAULT_API_KEY

class RecuperateurSitesTouristiques:
    """
    Classe pour récupérer les sites touristiques d'une ville en utilisant l'API Groq
    """
    
    def __init__(self, cle_api=None):
        """
        Initialise le récupérateur avec la clé API
        
        Args:
            cle_api (str): La clé API pour Groq
        """
        self.cle_api = cle_api or GROQ_API_KEY
        if not self.cle_api:
            self.cle_api = input("Veuillez entrer votre clé API Groq: ")
            
        self.url_base = "https://api.groq.com/openai/v1/chat/completions"
        self.limite_sites = 20 
        self.cache = {}  
        self.cache_expiry = 24 * 3600  
        
        # Liste des catégories de sites touristiques 
        self.categories_predefinies = [
            "Édifices et patrimoine religieux",
            "Châteaux et architectures civiles",
            "Sites à caractère militaire et lieux de mémoire",
            "Sites et musées archéologiques",
            "Musées des beaux-arts",
            "Écomusées et musées d'art traditionnel",
            "Muséums et musées d'histoire naturelle",
            "Musées thématiques",
            "Parcs à thèmes",
            "Parcs animaliers",
            "Grottes et sites naturels",
            "Villes et villages pittoresques",
            "Transports touristiques",
            "Parcs, jardins et arboretums",
            "Festivals et événements culturels",
            "Sites industriels et visites techniques",
            "Lieux de divertissement et casinos",
            "Marchés et quartiers commerciaux",
            "Centres historiques",
            "Monuments et sites emblématiques"
        ]
        
        # Interface utilisateur
        self.messages = {
            "ville": "Entrez le nom de la ville pour laquelle vous souhaitez des sites touristiques: ",
            "nombre_sites": "Combien de sites touristiques souhaitez-vous obtenir? (max 20): ",
            "recuperation": "Récupération des sites touristiques pour {}...",
            "trouve": "J'ai trouvé {} sites touristiques à {}:",
            "adresse": "Adresse",
            "categories_disponibles": "Catégories de sites touristiques disponibles à {}:",
            "filtrer": "Souhaitez-vous filtrer les résultats par catégorie? (oui/non): ",
            "categories_souhaitees": "Entrez les catégories souhaitées séparées par des virgules\nCatégories disponibles: {}",
            "exclure": "Souhaitez-vous exclure certains types de sites? (oui/non): ",
            "types_exclus": "Entrez les types de sites que vous ne souhaitez PAS visiter, séparés par des virgules\nCatégories disponibles: {}",
            "resultats_filtres": "J'ai trouvé {} sites correspondant à vos critères:",
            "pas_resultats": "Je n'ai pas pu obtenir de sites touristiques pour {}."
        }
    
    def afficher_message(self, cle, *args):
        """
        Affiche un message formaté
        
        Args:
            cle (str): La clé du message à afficher
            *args: Arguments pour le formatage du message
            
        Returns:
            str: Le message formaté
        """
        if cle in self.messages:
            return self.messages[cle].format(*args)
        return ""
    
    def obtenir_categories_disponibles(self, ville):
        """
        Retourne la liste prédéfinie des catégories de sites touristiques
        
        Args:
            ville (str): Le nom de la ville (non utilisé dans cette version)
            
        Returns:
            list: Liste des catégories de sites touristiques disponibles
        """
        return self.categories_predefinies
    
    def obtenir_sites_filtres(self, ville, categories_souhaitees, categories_exclues, nombre_sites=10):
        """
        Fait une requête API pour obtenir des sites touristiques selon les préférences de l'utilisateur
        
        Args:
            ville (str): Le nom de la ville
            categories_souhaitees (list): Liste des catégories souhaitées
            categories_exclues (list): Liste des catégories à exclure
            nombre_sites (int): Le nombre de sites à retourner
            
        Returns:
            list: Liste des sites touristiques correspondant aux critères
        """
        # Vérification du cache
        cache_key = f"{ville}_{nombre_sites}_{'-'.join(sorted(categories_souhaitees))}_{'-'.join(sorted(categories_exclues))}"
        
        if cache_key in self.cache:
            cache_entry = self.cache[cache_key]
            if time.time() < cache_entry['expiry']:
                print(f"Utilisation des résultats en cache pour {ville}")
                return cache_entry['data']
        
        
        nombre_sites = min(nombre_sites, self.limite_sites)
        
        # Prompt pour Groq 
        prompt = f"""
        Veuillez fournir une liste des {nombre_sites} sites touristiques les plus importants de {ville} qui correspondent aux critères suivants:
        
        """
        
        if categories_souhaitees:
            prompt += f"""
        Sites touristiques à inclure (catégories): {', '.join(categories_souhaitees)}
        """
        
        if categories_exclues:
            prompt += f"""
        Sites touristiques à exclure (catégories): {', '.join(categories_exclues)}
        """
        
        prompt += f"""
        Pour chaque site touristique, incluez:
        1. Le nom
        2. Une brève description (1-2 phrases)  
        3. La catégorie (une des catégories mentionnées ci-dessus)
        4. L'adresse (aussi précise que possible)
        
        La réponse doit être en français et au format JSON, comme suit:
        [
            {{
                "nom": "Nom du site",
                "description": "Description brève",
                "categorie": "Catégorie",
                "adresse": "Adresse complète"
            }},
            ...
        ]
        
        Ne mettez AUCUN TEXTE supplémentaire avant ou après le JSON, juste le tableau JSON lui-même.
        """
        
        # Requête API
        en_tetes = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.cle_api}"
        }
        charge_utile = {
            "model": "llama3-70b-8192",  
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.2,
            "max_tokens": 2048
        }
        
        try:
            # Envoi de la requête 
            reponse = requests.post(self.url_base, headers=en_tetes, json=charge_utile, timeout=15)
            reponse.raise_for_status() 
            
            # Analyse de la réponse
            resultat = reponse.json()
            
            # Extraction du contenu de la réponse
            contenu = resultat['choices'][0]['message']['content']
            
            # Nettoyage du contenu pour obtenir uniquement le JSON
            contenu = contenu.strip()
            if contenu.startswith('```json'):
                contenu = contenu[7:]
            if contenu.endswith('```'):
                contenu = contenu[:-3]
            contenu = contenu.strip()
            
            # Analyse du JSON
            try:
                sites_touristiques = json.loads(contenu)
                
                # Limitation du nombre de sites
                sites_touristiques = sites_touristiques[:self.limite_sites]
                
                # Sauvegarde dans le cache
                self.cache[cache_key] = {
                    'data': sites_touristiques,
                    'expiry': time.time() + self.cache_expiry
                }
                
                # Sauvegarde dans un fichier local
                self.sauvegarder_dans_fichier(ville, sites_touristiques)
                
                return sites_touristiques
            except json.JSONDecodeError as e:
                print(f"Erreur lors du décodage JSON: {e}")
                print(f"Contenu reçu: {contenu}")
                
                # Correction du JSON mal formaté
                try:
                   
                    while not (contenu.startswith('[') and contenu.endswith(']')):
                        if not contenu.startswith('['):
                            contenu = contenu[contenu.find('['):]
                        if not contenu.endswith(']'):
                            contenu = contenu[:contenu.rfind(']')+1]
                    
                    sites_touristiques = json.loads(contenu)
                    return sites_touristiques[:self.limite_sites]
                except (json.JSONDecodeError, ValueError) as e2:
                    print(f"Impossible de corriger le JSON: {e2}")
                    return self.obtenir_sites_locaux(ville)
            
        except requests.exceptions.Timeout:
            print(f"Timeout: La requête API a pris trop de temps pour {ville}")
            return self.obtenir_sites_locaux(ville)
        except requests.exceptions.RequestException as e:
            print(f"Erreur lors de la requête API pour les sites filtrés: {e}")
            return self.obtenir_sites_locaux(ville)
        except Exception as e:
            print(f"Erreur inattendue lors de l'obtention des sites filtrés: {e}")
            return self.obtenir_sites_locaux(ville)
    
    def obtenir_sites_locaux(self, ville):
        """
        Récupère les sites touristiques depuis un fichier local
        
        Args:
            ville (str): Le nom de la ville
            
        Returns:
            list: Liste des sites touristiques
        """
        # Tentative de lecture depuis un fichier JSON local
        nom_fichier = f"{ville.lower().replace(' ', '_')}_sites_touristiques.json"
        try:
            with open(nom_fichier, 'r', encoding='utf-8') as f:
                print(f"Données récupérées depuis le fichier local pour {ville}")
                return json.load(f)
        except:
            return self.generer_sites_par_defaut(ville)
    
    def generer_sites_par_defaut(self, ville):
        """
        Génère des sites par défaut pour les villes communes
        
        Args:
            ville (str): Le nom de la ville
            
        Returns:
            list: Liste des sites touristiques par défaut
        """
        ville_normalisee = ville.lower()
        
        # Rechercher des correspondances partielles
        for nom_ville, sites in self.sites_par_defaut.items():
            if nom_ville in ville_normalisee or ville_normalisee in nom_ville:
                print(f"Utilisation des sites par défaut pour {ville}")
                return sites
        
        print(f"Aucun site touristique trouvé pour {ville}")
        return []
    
    def sauvegarder_dans_fichier(self, ville, sites, nom_fichier=None):
        """
        Sauvegarde les sites touristiques dans un fichier JSON
        
        Args:
            ville (str): Le nom de la ville
            sites (list): La liste des sites touristiques
            nom_fichier (str, optional): Le nom du fichier
        """
        if not nom_fichier:
            nom_fichier = f"{ville.lower().replace(' ', '_')}_sites_touristiques.json"
        
        try:
            with open(nom_fichier, 'w', encoding='utf-8') as f:
                json.dump(sites, f, ensure_ascii=False, indent=4)
            # Message de sauvegarde supprimé pour garder l'interface propre
        except Exception as e:
            print(f"Erreur lors de la sauvegarde des données: {e}")
    
    def adapter_reponse_oui_non(self, reponse):
        """
        Adapte la réponse oui/non
        
        Args:
            reponse (str): La réponse saisie par l'utilisateur
            
        Returns:
            bool: True si la réponse est positive, False sinon
        """
        reponse = reponse.lower().strip()
        return reponse in ["oui", "o", "y", "yes"]

    def afficher_resultats(self, sites):
        """
        Affiche les résultats des sites touristiques
        
        Args:
            sites (list): La liste des sites touristiques
        """
        for i, site in enumerate(sites, 1):
            nom = site.get("nom", "")
            categorie = site.get("categorie", "")
            description = site.get("description", "")
            adresse = site.get("adresse", "")
            
            print(f"{i}. {nom} - {categorie}")
            print(f"   {description}")
            print(f"   {self.afficher_message('adresse')}: {adresse}")
            print()


class OptimiseurItineraire:
    """
    Classe pour optimiser l'itinéraire entre les sites touristiques choisis
    """
    
    def __init__(self, recuperateur, temps_entre_geocodage=0.5):
        """
        Initialise l'optimiseur d'itinéraire
        
        Args:
            recuperateur: Instance de RecuperateurSitesTouristiques
            temps_entre_geocodage: Temps d'attente entre geocodages (pour respecter les limites API)
        """
        self.recuperateur = recuperateur
        self.geolocator = Nominatim(user_agent="planificateur_touristique")
        self.temps_entre_geocodage = temps_entre_geocodage
        self.cache_coordonnees = {} 
        self.max_workers = 5  
    
    def obtenir_coordonnees(self, adresse, ville):
        """
        Obtient les coordonnées géographiques d'une adresse
        
        Args:
            adresse (str): L'adresse du lieu
            ville (str): La ville où se trouve le lieu
            
        Returns:
            tuple: Les coordonnées (latitude, longitude) ou None en cas d'erreur
        """
        # Vérifie si l'adresse est déjà dans le cache
        cle_cache = f"{adresse}, {ville}".lower()
        if cle_cache in self.cache_coordonnees:
            return self.cache_coordonnees[cle_cache]
        
        # Ajoute la ville à l'adresse
        adresse_complete = f"{adresse}, {ville}"
        
        try:
            # Utilise le géocodage pour obtenir les coordonnées avec timeout
            lieu = self.geolocator.geocode(adresse_complete, timeout=5)
            time.sleep(self.temps_entre_geocodage)  
            
            if lieu:
                coordonnees = (lieu.latitude, lieu.longitude)
                self.cache_coordonnees[cle_cache] = coordonnees
                return coordonnees
            else:
                # Essayez juste avec la ville si l'adresse complète échoue
                lieu_ville = self.geolocator.geocode(ville, timeout=5)
                if lieu_ville:
                    import random
                    lat_offset = random.uniform(-0.01, 0.01)
                    lon_offset = random.uniform(-0.01, 0.01)
                    coordonnees = (lieu_ville.latitude + lat_offset, lieu_ville.longitude + lon_offset)
                    self.cache_coordonnees[cle_cache] = coordonnees
                    return coordonnees
                print(f"Erreur lors du géocodage de l'adresse: {adresse_complete}")
                return None
        except Exception as e:
            print(f"Erreur lors du géocodage: {str(e)}")
            return None
    
    def geocoder_par_lots(self, adresses, ville, taille_lot=5):
        """
        Géocode plusieurs adresses en parallèle par lots
        
        Args:
            adresses (list): Liste des adresses à géocoder
            ville (str): La ville
            taille_lot (int): Taille de chaque lot
            
        Returns:
            list: Liste des coordonnées correspondantes
        """
        resultats = []
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Soumettre les adresses pour géocodage
            futures_to_index = {}
            for i, adresse in enumerate(adresses):
                future = executor.submit(self.obtenir_coordonnees, adresse, ville)
                futures_to_index[future] = i
                if i % taille_lot == 0 and i > 0:
                    time.sleep(1)
            
            # Préparer le tableau de résultats avec des espaces réservés
            resultats = [None] * len(adresses)
            
            # Traiter les résultats au fur et à mesure qu'ils se terminent
            for future in concurrent.futures.as_completed(futures_to_index):
                index = futures_to_index[future]
                try:
                    resultats[index] = future.result()
                except Exception as exc:
                    print(f"L'adresse à l'index {index} a généré une exception: {exc}")
                    resultats[index] = None
        
        return resultats
    
    def calculer_distance(self, coord1, coord2):
        """
        Calcule la distance entre deux ensembles de coordonnées géographiques
        
        Args:
            coord1 (tuple): Premier ensemble de coordonnées (lat, lon)
            coord2 (tuple): Second ensemble de coordonnées (lat, lon)
            
        Returns:
            float: Distance en kilomètres
        """
        if coord1 and coord2:
            return geodesic(coord1, coord2).kilometers
        return float('inf')
    
    def optimiser_itineraire(self, sites, ville, site_depart_nom):
        """
        Optimise l'itinéraire en utilisant un algorithme glouton pour trouver le lieu le plus proche suivant
        
        Args:
            sites (list): Liste des sites touristiques
            ville (str): La ville où se trouvent les sites
            site_depart_nom (str): Le nom du site de départ
            
        Returns:
            list: Liste ordonnée des sites à visiter
        """
        print("Calcul de l'itinéraire optimal...")
        
        # Obtenir les coordonnées de tous les sites en parallèle
        adresses = [site.get("adresse", "") for site in sites]
        coordonnees = self.geocoder_par_lots(adresses, ville)
        
        # Appliquer les coordonnées aux sites
        for i, site in enumerate(sites):
            if i < len(coordonnees) and coordonnees[i]:
                site["coordonnees"] = coordonnees[i]
     
        # Filtrer les sites valides avec coordonnées
        sites_valides = [site for site in sites if site.get("coordonnees")]
        
        if not sites_valides:
            return []
        
        # Recherche du site de départ dans la liste des sites valides
        site_depart = None
        for site in sites_valides:
            if site_depart_nom.lower() in site["nom"].lower():
                site_depart = site
                break
        
        # Si le site de départ n'est pas trouvé, utilise le premier site
        if not site_depart:
            print(f"Site de départ '{site_depart_nom}' non trouvé. Utilisation du premier site.")
            site_depart = sites_valides[0]
        
        # Initialise l'itinéraire avec le site de départ
        itineraire = [site_depart]
        sites_restants = [site for site in sites_valides if site != site_depart]
        
        # Pour trouver la destination la plus proche suivante
        while sites_restants:
            site_actuel = itineraire[-1]
            coordonnees_actuelles = site_actuel["coordonnees"]
            
            site_suivant = None
            distance_min = float('inf')
            
            # Trouve le site le plus proche parmi ceux qui restent
            for site in sites_restants:
                coordonnees = site["coordonnees"]
                distance = self.calculer_distance(coordonnees_actuelles, coordonnees)
                
                if distance < distance_min:
                    distance_min = distance
                    site_suivant = site
            
            itineraire.append(site_suivant)
            sites_restants.remove(site_suivant)
        
        # Calcul des distances entre sites consécutifs
        for i in range(len(itineraire) - 1):
            coord1 = itineraire[i]["coordonnees"]
            coord2 = itineraire[i + 1]["coordonnees"]
            itineraire[i]["distance_suivant"] = self.calculer_distance(coord1, coord2)
        
        # Pour le dernier site, la distance est 0
        itineraire[-1]["distance_suivant"] = 0
        
        return itineraire
    
    def afficher_itineraire(self, itineraire):
        """
        Affiche l'itinéraire optimisé
        
        Args:
            itineraire (list): Liste ordonnée des sites à visiter
        """
        if not itineraire:
            return
        
        # Préparation des données pour le tableau
        headers = ["#", "Nom", "Catégorie", "Distance", "Prochaine destination"]
        
        tableau_data = []
        distance_totale = 0
        
        for i, site in enumerate(itineraire, 1):
            nom = site.get("nom", "")
            categorie = site.get("categorie", "")
            distance = site.get("distance_suivant", 0)
            distance_totale += distance
            
            if i < len(itineraire):
                prochaine = itineraire[i].get("nom", "")
            else:
                prochaine = "-"
            
            tableau_data.append([i, nom, categorie, f"{distance:.2f} km", prochaine])
        
        # Affichage du tableau
        print("\nVotre itinéraire optimisé:")
        print(tabulate(tableau_data, headers=headers, tablefmt="grid"))
        
        # Affichage des statistiques
        print(f"\nDistance totale approximative du parcours: {distance_totale:.2f} km")
        
        # Estimation du temps de marche (environ 5 km/h)
        heures = int(distance_totale / 5)
        minutes = int((distance_totale / 5 - heures) * 60)
        print(f"Durée estimée de marche: environ {heures} heures et {minutes} minutes")

    def selectionner_sites(self, sites):
        """
        Permet à l'utilisateur de sélectionner des sites spécifiques pour l'itinéraire
        
        Args:
            sites (list): Liste complète des sites touristiques
            
        Returns:
            list: Liste des sites sélectionnés
        """
        # Demande à l'utilisateur s'il souhaite sélectionner des sites spécifiques
        reponse = input("Souhaitez-vous sélectionner certains sites spécifiques de la liste ci-dessus? (oui/non): ")
        
        if self.recuperateur.adapter_reponse_oui_non(reponse):
            indices_input = input("Entrez les numéros des sites que vous souhaitez visiter, séparés par des virgules (ex: 1,3,5): ")
            try:
               
                indices = [int(idx.strip()) for idx in indices_input.split(",") if idx.strip()]
                indices = [idx - 1 for idx in indices if 0 < idx <= len(sites)] 
                if not indices:
                    print("Sélection invalide. Utilisation de tous les sites.")
                    return sites
                
                # Sélectionne les sites par indices
                sites_selectionnes = [sites[idx] for idx in indices if idx < len(sites)]
                
                # Affiche les sites sélectionnés
                print("\nSites sélectionnés pour la visite:")
                for i, site in enumerate(sites_selectionnes, 1):
                    nom = site.get("nom", "")
                    print(f"{i}. {nom}")
                
                return sites_selectionnes
            except ValueError:
                print("Sélection invalide. Utilisation de tous les sites.")
                return sites
        else:
            return sites

    def choisir_site_depart(self, sites):
        """
        Permet à l'utilisateur de choisir le site de départ
        
        Args:
            sites (list): Liste des sites touristiques
            
        Returns:
            str: Nom du site de départ
        """
        try:
            # Affiche la liste des sites disponibles
            print("\nSites disponibles pour le départ:")
            for i, site in enumerate(sites, 1):
                nom = site.get("nom", "")
                print(f"{i}. {nom}")
            
            # Demande à l'utilisateur de choisir un site de départ
            depart_input = input("Par quel site souhaitez-vous commencer votre visite? Entrez le nom ou le numéro du site: ")
            
            # Essaie d'interpréter l'entrée comme un numéro
            try:
                depart_index = int(depart_input.strip()) - 1
                if 0 <= depart_index < len(sites):
                    return sites[depart_index]["nom"]
            except ValueError:
                pass
            
            # Si ce n'est pas un numéro valide, utilise l'entrée comme nom
            return depart_input.strip()
            
        except Exception as e:
            print(f"Erreur lors du choix du site de départ: {e}")
            return sites[0]["nom"]


def installer_dependances():
    """
    Vérifie et installe les dépendances nécessaires si elles ne sont pas présentes
    """
    try:
        import requests
        import json
        import time
        from geopy.distance import geodesic
        from geopy.geocoders import Nominatim
        from tabulate import tabulate
        from dotenv import load_dotenv
    except ImportError:
        print("Installation des dépendances nécessaires...")
        import subprocess
        subprocess.run(["pip", "install", "requests", "geopy", "tabulate", "python-dotenv"])
        print("Dépendances installées avec succès!")


def main():
    # Installation des dépendances au besoin
    installer_dependances()
    recuperateur = RecuperateurSitesTouristiques()
    
    # Demande des informations à l'utilisateur
    ville = input(recuperateur.afficher_message("ville"))
    
    nombre_sites_input = input(recuperateur.afficher_message("nombre_sites"))
    try:
        nombre_sites = min(int(nombre_sites_input), recuperateur.limite_sites)
    except ValueError:
        nombre_sites = 10 
    
    print(recuperateur.afficher_message("recuperation", ville))
    
    # Utilisation des catégories prédéfinies
    categories_disponibles = recuperateur.obtenir_categories_disponibles(ville)
    
    if categories_disponibles:
        print(recuperateur.afficher_message("categories_disponibles", ville))
        for categorie in categories_disponibles:
            print(f"- {categorie}")
        
        print()
        # Variables pour stocker les préférences utilisateur
        categories_souhaitees = []
        categories_exclues = []
        
        # Demande des catégories souhaitées
        reponse_filtre = input(recuperateur.afficher_message("filtrer"))
        if recuperateur.adapter_reponse_oui_non(reponse_filtre):
            categories_str = ", ".join(categories_disponibles)
            print(recuperateur.afficher_message("categories_souhaitees", categories_str))
            categories_input = input()
            categories_souhaitees = [cat.strip() for cat in categories_input.split(",")] if categories_input.strip() else []
            
            # Catégories disponibles 
            categories_restantes = [cat for cat in categories_disponibles if cat not in categories_souhaitees]
            
            # Catégories à exclure 
            if categories_restantes:
                reponse_exclusion = input(recuperateur.afficher_message("exclure"))
                if recuperateur.adapter_reponse_oui_non(reponse_exclusion):
                    categories_restantes_str = ", ".join(categories_restantes)
                    print(recuperateur.afficher_message("types_exclus", categories_restantes_str))
                    exclusions_input = input()
                    categories_exclues = [exc.strip() for exc in exclusions_input.split(",")] if exclusions_input.strip() else []
        
        # Requête API avec les préférences utilisateur et fallbacks
        sites_touristiques = recuperateur.obtenir_sites_filtres(
            ville, 
            categories_souhaitees, 
            categories_exclues, 
            nombre_sites
        )
        
        if sites_touristiques:
            print(recuperateur.afficher_message("resultats_filtres", len(sites_touristiques)))
            recuperateur.afficher_resultats(sites_touristiques)
            
            # Intégration de l'optimiseur d'itinéraire
            optimiseur = OptimiseurItineraire(recuperateur)
            
            # Sélection des sites spécifiques pour l'itinéraire
            sites_selectionnes = optimiseur.selectionner_sites(sites_touristiques)
            
            if sites_selectionnes:
                # Choix du site de départ
                site_depart_nom = optimiseur.choisir_site_depart(sites_selectionnes)
                
                # Optimisation de l'itinéraire
                itineraire_optimal = optimiseur.optimiser_itineraire(
                    sites_selectionnes, 
                    ville, 
                    site_depart_nom
                )
                
                # Affichage de l'itinéraire optimisé
                optimiseur.afficher_itineraire(itineraire_optimal)
        else:
            print(recuperateur.afficher_message("pas_resultats", ville))
    else:
        print(recuperateur.afficher_message("pas_resultats", ville))

if __name__ == "__main__":
    main()
