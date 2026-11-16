# FAFIO — version web (iPhone et tous les navigateurs)

Application web installable (PWA) : mêmes documents que l'application Android FAFIO
(comptes rendus, rapports, CV, lettres, exposés, PowerPoint, graphiques), générés **sur le téléphone**,
même hors ligne. Export PDF, Word, PowerPoint et image.

**Ouvrir :** https://axolut.github.io/fafio-web/

**Installer sur iPhone :** ouvrir le lien dans Safari → bouton Partager → « Sur l'écran d'accueil ».

Conçu et développé par axOlut, Yaoundé.

## Développement
- Aucun outil de build : HTML, CSS et JavaScript (modules) servis tels quels par GitHub Pages.
- Après toute modification de fichier, régénérer la liste hors ligne : `python3 tools/build_sw.py`.
