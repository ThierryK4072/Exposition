EXPOCLINIQUE — TEST SUR MAC

1. Décompressez ExpoClinique_PWA.zip.
2. Placez le dossier ExpoClinique_PWA dans Téléchargements.
3. Ouvrez Terminal et exécutez :

   cd ~/Downloads/ExpoClinique_PWA
   python3 -m http.server 8000

4. Dans Safari, ouvrez :

   http://localhost:8000

5. Pour arrêter l’application locale, revenez au Terminal et appuyez sur Ctrl + C.

Les données restent dans Safari, dans une base IndexedDB locale.
Utilisez l’onglet Sauvegarde pour télécharger régulièrement un fichier JSON.

TEST SUR IPAD, SUR LE MÊME WI-FI
Laissez le serveur actif sur le Mac, trouvez l’adresse IP locale du Mac, puis ouvrez dans Safari sur l’iPad :
http://ADRESSE_IP_DU_MAC:8000

La publication GitHub Pages sera faite après validation de l’application.
