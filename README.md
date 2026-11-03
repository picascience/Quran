# Le Noble Coran — lecture, traduction et tafsir Ibn Kathir

Site statique (HTML + CSS + JavaScript, sans build) pour lire le Coran : texte arabe uthmani,
traduction de Hamidullah (et Saheeh International en option), et le tafsir de chaque verset en
le touchant : Al-Mukhtasar en français (par défaut), Ibn Kathir en anglais (abrégé) ou en arabe.

**À savoir :** il n'existe pas de traduction française d'Ibn Kathir disponible librement et
vérifiable en ligne. Le tafsir français est donc Al-Mukhtasar, un tafsir abrégé rédigé par un
comité du Centre de tafsir pour les études coraniques. Le site l'indique clairement dans le panneau.

**Aucun texte n'est écrit par le site.** Le Coran, les traductions et le tafsir sont chargés
tels quels au moment de la lecture depuis les sources ci-dessous.

## Sources (vérifiées le 3 novembre 2026)

| Contenu | Source principale (Quran.com API v4) | Secours automatique (jsDelivr) |
|---|---|---|
| Liste des sourates | `GET /chapters?language=fr` | `data/chapters-fallback.json` (copie de `fawazahmed0/quran-api` `info.json`) |
| Arabe | `text_uthmani` | `ara-quranuthmanihaf` (Complexe du Roi Fahd, Hafs v13) |
| Français | traduction **id 31** — Muhammad Hamidullah | `fra-muhammadhamidul` (Tanzil.net) |
| Anglais | traduction **id 20** — Saheeh International | `eng-ummmuhammad` (Tanzil.net) |
| Tafsir anglais | tafsir **id 169** — Ibn Kathir (Abridged), slug `en-tafisr-ibn-kathir` | `spa5k/tafsir_api@v1.2.2` `en-tafisr-ibn-kathir` |
| Tafsir arabe | tafsir **id 14** — Tafsir Ibn Kathir, slug `ar-tafsir-ibn-kathir` | `spa5k/tafsir_api@v1.2.2` `ar-tafsir-ibn-kathir` |
| Tafsir français | — (absent de l'API Quran.com) | **Al-Mukhtasar fi Tafsir al-Qur'an al-Karim**, Markaz Tafsir lil-Dirasat al-Qur'aniyya ; édition française publiée sur QuranEnc (`french_mokhtasar`), ressource QUL / Tarteel n° 259 ; chargée via `spa5k/tafsir_api@v1.2.2` `french-mokhtasar` (jsDelivr, puis fastly.jsdelivr.net) |

Les identifiants viennent de `https://api.quran.com/api/v4/resources/translations` et
`https://api.quran.com/api/v4/resources/tafsirs`. Ils sont tous dans `js/config.js`.

Le secours n'est utilisé que si l'API Quran.com ne répond pas. La source effectivement
utilisée est écrite sous la sourate et sous chaque tafsir.

**Passages communs :** quand Ibn Kathir commente plusieurs versets ensemble (par ex. 2:8–9,
ou 114:1–6), l'API renvoie la liste des versets couverts (`tafsir.verses`). Le panneau affiche
alors « Passage commun : versets X à Y » au lieu d'un panneau vide.

**Seul traitement appliqué :** les marqueurs de notes (`<sup>1</sup>`) sont retirés des
traductions, car les notes elles-mêmes ne sont pas affichées ; le HTML du tafsir est nettoyé
(balises autorisées seulement, aucun script).

## Licences

- **Quran.com / Quran Foundation** : [conditions développeurs](https://api-docs.quran.foundation/legal/developer-terms/) — affichage aux utilisateurs, texte du Coran non modifié, pas de revente ni de redistribution des données.
- **fawazahmed0/quran-api** : Unlicense (domaine public). Traductions issues de Tanzil.net : [usage non commercial uniquement](https://tanzil.net/trans/).
- **spa5k/tafsir_api** : licence MIT (données issues de Quran.com).
- **Police Amiri Quran** : SIL Open Font License 1.1 (`fonts/OFL.txt`), hébergée dans le dépôt.

## Structure

```
quran/
├── index.html                 page unique (accueil + sourate + panneaux)
├── css/style.css              mise en page, thème clair/sombre
├── js/config.js               sources et identifiants vérifiés
├── js/api.js                  chargement des données, secours, nettoyage HTML
├── js/app.js                  navigation, affichage, tafsir, réglages
├── data/chapters-fallback.json  liste des sourates de secours
├── fonts/                     Amiri Quran (woff2) + licence OFL
├── .nojekyll
└── README.md
```

## Liens

- `…/quran/` — liste des 114 sourates
- `…/quran/#2` — sourate 2
- `…/quran/#2:255` — sourate 2, ouverte sur le verset 255 (lien partageable)

## Mettre en ligne sur GitHub Pages

1. Sur github.com : **New repository** → nom `quran` → Public → **Create repository**.
2. Envoyer les fichiers, au choix :
   - **Navigateur :** sur la page du dépôt, *Add file → Upload files*, glisser **le contenu** du dossier `quran` (pas le dossier lui-même, `index.html` doit être à la racine), puis *Commit changes*. Le fichier `.nojekyll` est caché sous Windows : s'il manque, ce n'est pas grave.
   - **Git :**
     ```bash
     cd quran
     git init
     git add .
     git commit -m "Site de lecture du Coran"
     git branch -M main
     git remote add origin https://github.com/VOTRE-PSEUDO/quran.git
     git push -u origin main
     ```
3. Dans le dépôt : **Settings → Pages** → *Source* : **Deploy from a branch** → *Branch* : `main` / `/ (root)` → **Save**.
4. Attendre 1 à 2 minutes. Le site est à : **`https://VOTRE-PSEUDO.github.io/quran/`**

## Tester en local

```bash
cd quran
python -m http.server 8000
# ouvrir http://localhost:8000
```

(Ouvrir `index.html` directement en double-cliquant ne marche pas : les modules JavaScript
demandent un petit serveur.)
