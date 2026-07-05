# Tesla Suivi iPhone

Petite app mobile/PWA générée depuis `Suivi_annonces_Tesla_complete.xlsx`.

## Ce que fait l'app

- Liste des annonces en cartes adaptées à l'iPhone
- Recherche et filtres par modèle, Autopilot/FSD/EAP, statut et favoris
- Ajout, modification, suppression d'annonces
- Statut par annonce : À suivre, Contacté, À voir, Écarté, Acheté
- Recalcul automatique du prix total, budget tout compris, FSD 24 mois, budget 2 ans et score
- Export CSV, sauvegarde JSON, import JSON
- Données stockées localement dans Safari/localStorage

## Installation sur iPhone

1. Héberger ce dossier sur un hébergement HTTPS statique, par exemple Netlify Drop, GitHub Pages ou ton serveur web.
2. Ouvrir l'URL dans Safari sur iPhone.
3. Toucher le bouton Partager.
4. Choisir **Ajouter à l'écran d'accueil**.
5. L'app s'ouvre ensuite comme une app iPhone et fonctionne hors-ligne après le premier chargement.

## Test local rapide

Sur un ordinateur :

```bash
cd tesla_suivi_iphone
python3 -m http.server 8080
```

Puis ouvrir `http://localhost:8080`.

## Note sur le score

Le score reprend la logique indiquée dans le fichier : Autopilot 35% + kilométrage 30% + budget 2 ans FSD 20% + Performance 15%. Les annonces initiales sont importées depuis le fichier fourni, puis les nouvelles modifications sont recalculées dans l'app.
