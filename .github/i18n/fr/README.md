# Barre latérale Chrome de style Arc · Votre espace de travail de connaissance pour Chrome

[English](/.github/i18n/en/README.md) | [繁體中文](/.github/i18n/zh_TW/README.md) | [简体中文](/.github/i18n/zh_CN/README.md) | [日本語](/.github/i18n/ja/README.md) | [한국어](/.github/i18n/ko/README.md) | [Deutsch](/.github/i18n/de/README.md) | [Español](/.github/i18n/es/README.md) | [Français](/.github/i18n/fr/README.md) | [हिन्दी](/.github/i18n/hi/README.md) | [Bahasa Indonesia](/.github/i18n/id/README.md) | [Português (Brasil)](/.github/i18n/pt_BR/README.md) | [Русский](/.github/i18n/ru/README.md) | [ไทย](/.github/i18n/th/README.md) | [Tiếng Việt](/.github/i18n/vi/README.md)


🌐 **Site officiel**: [https://sidebar-for-tabs-bookmarks.taislife.work/](https://sidebar-for-tabs-bookmarks.taislife.work/)

---

[![Version](https://img.shields.io/chrome-web-store/v/beoonblekmppafnjppedgpgfngghebji?style=flat-square&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Rating](https://img.shields.io/chrome-web-store/rating/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Users](https://img.shields.io/chrome-web-store/users/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Build Status](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Tai-ch0802/arc-like-chrome-extension?style=flat-square)](../../LICENSE)

Une barre latérale de style Arc qui va bien au-delà des onglets verticaux natifs de Chrome : onglets + signets + liste de lecture unifiés, **IA locale par défaut** (nommage automatique des groupes, suggestions de nettoyage d'onglets, résumés au survol, recherche en langage naturel — Gemini Nano intégré, ou apportez votre propre clé API pour Gemini API / Claude / compatible OpenAI / Ollama), **Workspaces** (hibernation et restauration de paquets d'onglets, synchronisation des métadonnées entre appareils), une **palette de commandes ⌘K**, et des **outils pour signets** (étiquettes, déduplication, liens morts) — sur l'appareil par défaut, aucune clé API requise.

## 🚀 Mise à jour v1.14.0 !
[![Vidéo de démonstration](http://img.youtube.com/vi/aRSQ1atlyCw/0.jpg)](https://www.youtube.com/watch?v=aRSQ1atlyCw)

### ⚡️ Fonctionnalités
- **Image d'arrière-plan personnalisée** : Définissez votre propre fond (upload ou URL), avec opacité et flou réglables.
- **Interface de paramètres repensée** : Une expérience plus fluide avec un nouveau design en accordéon pliable.
- **Couleurs de thème personnalisées** : Contrôle total sur l'arrière-plan, la couleur d'accent et le texte.
- **Onglets verticaux** : Affichez les titres complets des pages, sans qu'ils soient réduits à de petites icônes.
- **Groupes d'onglets** : S'intègre parfaitement aux groupes d'onglets Chrome, synchronisant couleurs et noms.
- **Intégration des favoris** : Panneau unifié pour gérer les onglets et les favoris.
- **Onglets liés** : Crée automatiquement un "lien" lors de l'ouverture d'un favori pour éviter les doublons.
- **Gestion inter-fenêtres** : Gérez les onglets de toutes les fenêtres ouvertes avec une recherche globale.
- **Rendu dynamique** : Gère efficacement des milliers de favoris avec des performances fluides.
- **Raccourcis d'accessibilité** : Actions rapides avec `F2` pour renommer et `Suppr` pour supprimer.

## 🤝 Contribuer

Nous apprécions les contributions de la communauté ! Que vous corrigiez un bogue, amélioriez la documentation ou proposiez une nouvelle fonctionnalité, votre aide est la bienvenue.

Nous utilisons un flux de travail **Développement piloté par les spécifications (SDD)** et sommes **compatibles AI**. Consultez notre guide de contribution pour commencer :

👉 **[Lire nos directives de contribution](./CONTRIBUTING.md)**

Pour un exemple pratique du processus de développement, veuillez vous référer à l'[Issue #30](https://github.com/Tai-ch0802/arc-like-chrome-extension/issues/30).

---

## 🔥 Caractéristiques principales

### 🔗 Innovation exclusive : Onglets liés (Linked Tabs)
C'est notre fonctionnalité la plus puissante ! Lorsque vous ouvrez un signet de la barre latérale, nous créons automatiquement un **"Lien"**.
- **Éviter l'encombrement des onglets** : Cliquer sur l'icône de lien à côté d'un signet pour voir tous les onglets ouverts à partir de celui-ci, vous aidant à éviter d'ouvrir des doublons et à économiser les ressources système.
- **Synchronisation bidirectionnelle** : Lorsqu'un onglet est fermé, l'état du signet se met à jour automatiquement ; lorsqu'un signet est supprimé, l'onglet lié est géré intelligemment.
- **Retour visuel** : Une icône de lien raffinée apparaît à côté des signets, vous permettant de savoir d'un coup d'œil lesquels sont actuellement actifs.

### ⚡️ Rendu intelligent
Des milliers de signets ? Aucun problème !
- **Rendu dynamique** : Passage du défilement virtuel à un mécanisme de rendu dynamique efficace, garantissant une performance fluide avec une meilleure compatibilité.
- **Expérience fluide** : Navigation sans effort dans de grandes bibliothèques de signets sans décalage.

### 🪟 Gestion multi-fenêtres
- **Aperçu des fenêtres** : Affichage des onglets de toutes les fenêtres Chrome ouvertes directement dans la barre latérale, pas seulement de la fenêtre actuelle.
- **Recherche globale** : Les résultats de la recherche incluent les onglets de toutes les fenêtres, permettant une navigation instantanée dans toute votre session.

### 🔍 Recherche de niveau professionnel
Ne vous contentez pas de chercher — trouvez instantanément.
- **Filtrage par mots-clés multiples** : Prise en charge des mots-clés séparés par des espaces (ex : "google docs travail") pour un ciblage précis.
- **Recherche par domaine** : Saisissez un domaine (comme `github.com`) pour filtrer instantanément les onglets et les signets provenant de sources spécifiques.
- **Mise en évidence intelligente** : La mise en évidence en temps réel des mots-clés correspondants garde votre champ visuel clair.

### 🗂️ Espace de travail unifié
- **Onglets verticaux** : Affichage des titres de page complets, sans compression.
- **Support des groupes natifs** : Intégration parfaite aux groupes d'onglets Chrome.
- **Nommage personnalisé des fenêtres** : Attribuez des noms personnalisés à vos fenêtres (ex : "Travail", "Personnel") pour un contexte plus clair.
- **Glisser-déposer** : Gestion intuitive — déplacement facile des éléments entre les onglets, les groupes et les dossiers de signets.
- **Faire glisser pour enregistrer** : Faire glisser un onglet dans la zone des signets pour l'enregistrer instantanément ; faire glisser un signet dans la zone des onglets pour l'ouvrir.

### 🎨 Design Premium
- **Mode Focus** : Un thème sombre élégant avec un contraste soigneusement ajusté pour réduire la fatigue oculaire.
- **Extension automatique** : Passer la souris sur les dossiers tout en faisant glisser des éléments pour étendre automatiquement le chemin.
- **Survol intelligent** : Les boutons d'action n'apparaissent que lorsque c'est nécessaire, gardant l'interface propre et sans distractions.

### 📚 Liste de lecture et RSS
Votre centre de veille personnel, directement dans votre barre latérale.
- **Intégration de la Liste de lecture Chrome** : Synchronisation avec la liste de lecture native de Chrome pour une fonctionnalité "À lire plus tard" fluide.
- **Abonnement RSS** : Abonnez-vous à n'importe quel flux RSS ; les nouveaux articles sont automatiquement ajoutés à votre liste.
- **Déduplication intelligente** : Le filtrage basé sur le hachage garantit l'absence de doublons.
- **Options de tri** : Triez par date (récent/ancien) ou par titre pour un accès rapide.
- **Récupération manuelle** : Obtenez instantanément les derniers articles via le bouton "Actualiser maintenant".
- **Suppression par lot** : Supprimez tous les articles lus en un clic.

## ⌨️ Navigation complète au clavier
- **Expérience native** : Utiliser les touches `Flèche Haut`/`Flèche Bas` pour naviguer de manière fluide entre les onglets et les signets.
- **Micro-interactions** : Utiliser `Flèche Gauche`/`Flèche Droite` pour naviguer et déclencher les boutons internes (comme Fermer, Ajouter au groupe).
- **Intégration de la recherche** : Appuyer sur `Haut` en haut de la liste pour focaliser la barre de recherche ; appuyer sur `Bas` dans la barre de recherche pour sauter aux résultats.
- **Conseil de focus** : Une fois la barre latérale ouverte, il suffit d'appuyer sur n'importe quelle touche fléchée pour prendre automatiquement le focus et commencer à naviguer.

### ⌨️ Raccourcis de productivité
- **Cmd/Ctrl + I** : Activer/Désactiver la barre latérale
- **Opt/Alt + T** : Créer un nouvel onglet à côté de l'onglet actuel

---

## 🆚 Pourquoi choisir cette extension ?

| Caractéristique | Cette extension | Chrome natif | Barres latérales traditionnelles |
| :--- | :---: | :---: | :---: |
| **Onglets verticaux** | ✅ Titre complet | ❌ Compressé | ✅ |
| **Groupes d'onglets** | ✅ Synchronisation native | ✅ | ⚠️ Partiel |
| **Intégration des signets** | ✅ Panneau unifié | ❌ Gestionnaire séparé | ❌ Séparé |
| **Onglets liés** | ✅ Synchronisé | ❌ | ❌ |
| **Liste de lecture et RSS** | ✅ Intégré | ⚠️ Basique | ❌ |
| **Recherche multi-fenêtres** | ✅ | ❌ | ⚠️ Varie |
| **Performance** | ⚡️ Rendu dynamique | N/A | 🐢 Défilement virtuel |

---

## 🚀 Installation et Développement

### Option 1 : Installer depuis le Chrome Web Store (Recommandé)

Vous pouvez installer l'extension directement depuis le store officiel pour recevoir les mises à jour automatiques :

[**Cliquez ici pour installer depuis le Chrome Web Store**](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji?utm_source=item-share-cb)

### Option 2 : Installation manuelle à partir de la source (pour les développeurs)

**1. Prérequis**

Avant de commencer, assurez-vous d'avoir [Node.js](https://nodejs.org/) (qui inclut npm) installé sur votre système.

**2. Étapes de configuration**

1.  Cloner ou télécharger ce projet sur votre machine locale.
    ```bash
    git clone https://github.com/Tai-ch0802/arc-like-chrome-extension.git
    ```
2.  Accéder au répertoire du projet et installer les dépendances de développement requises :
    ```bash
    cd arc-like-chrome-extension
    npm install
    ```
3.  Ouvrir le navigateur Chrome et accéder à `chrome://extensions`.
4.  Activer le "Mode développeur" dans le coin supérieur droit.
5.  Cliquer sur "Charger l'extension non empaquetée" et sélectionner le répertoire racine du projet.

---

## 🛠️ Commandes de construction

Ce projet utilise un `Makefile` pour automatiser le processus de construction.

*   **Mode Développement** : `make` ou `make package`

    Cette commande crée une version de développement non minifiée. Tout le code source reste tel quel, ce qui facilite le débogage dans les outils de développement de Chrome. Le fichier empaqueté sera `arc-sidebar-v<version>-dev.zip`.

*   **Mode Production** : `make release`

    Cette commande exécute le processus de construction de production, qui comprend les étapes suivantes :
    1.  Regroupe et minifie tous les modules JavaScript dans un seul fichier à l'aide d' `esbuild`.
    2.  Minifie le fichier CSS.
    3.  Empaquette la sortie dans un fichier `.zip` apte à être téléchargé sur le Chrome Web Store.

---

## 🧪 Tests

Pour assurer la qualité et la stabilité des fonctionnalités du projet, nous adoptons une approche de test par cas d'utilisation pour valider chaque changement.

### Tests par cas d'utilisation

*   **Objectif** : Chaque test de cas d'utilisation définit clairement le comportement attendu et le flux opérationnel d'une fonctionnalité spécifique. Ils sont présentés sous forme de texte descriptif, détaillant les étapes du test, les préconditions, les résultats attendus et les méthodes de vérification.
*   **Emplacement** : Tous les fichiers de test de cas d'utilisation sont stockés dans le dossier `usecase_tests/` à la racine du projet.
*   **Exécution et vérification** : Ces tests sont actuellement principalement exécutés manuellement. Les développeurs doivent simuler les opérations des utilisateurs dans l'extension Chrome en cours d'exécution selon les étapes des fichiers de test et observer si les résultats sont conformes aux attentes.

### Test automatisé

Pour les futurs tests automatisés, nous avons choisi **Puppeteer** comme cadre de test de bout en bout (E2E). Cela nous permet d'écrire des scripts pour simuler diverses actions de l'utilisateur dans le navigateur et vérifier la fonctionnalité.

---

## 🔒 Confidentialité et FAQ

Nous accordons une grande importance à votre vie privée. Cette extension fonctionne localement par défaut et ne collecte pas vos données personnelles. Si vous activez un fournisseur d'IA cloud avec votre propre clé API, les requêtes IA vont directement de votre navigateur vers ce fournisseur uniquement.

Pour plus de détails, veuillez consulter notre [Politique de confidentialité](../../PRIVACY_POLICY.md).

---

## 👥 Contributeurs

Un merci spécial à tous les contributeurs qui aident à améliorer ce projet :

<a href="https://github.com/Tai-ch0802/arc-like-chrome-extension/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Tai-ch0802/arc-like-chrome-extension" />
</a>

## 📜 Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](../../LICENSE) pour plus de détails.
