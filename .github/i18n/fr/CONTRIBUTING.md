# Guide de contribution

🎉 Tout d'abord, merci de prendre le temps de contribuer !

Nous nous consacrons à la création d'une communauté open source à **faible barrière** et **orientée IA**. Nous encourageons vivement l'utilisation d'outils d'IA (particulièrement **Antigravity IDE**) pour aider au développement. Même si vous êtes novice en programmation ou si vous n'êtes pas familier avec ce domaine, tant que vous avez une idée, vous êtes les bienvenus pour contribuer via notre processus standardisé.

Ce document vous guidera sur la façon de transformer un "souhait vague" en une "fonctionnalité utilisable".

## 🚀 Philosophie de base

1.  **Développement natif de l'IA (AI-Native)** : Nous adoptons l'IA. N'ayez pas peur de laisser l'IA vous aider à écrire du code, de la documentation ou à expliquer l'architecture.
2.  **Développement piloté par les spécifications (SDD)** : Réfléchir avant d'agir. Les spécifications d'abord, le code ensuite. (`No Spec, No Code`)
3.  **Faible friction** : Utilisation d'outils automatisés et de SOP claires pour abaisser la barrière à la contribution.

## 🛠 Outils

*   **IDE** : Fortement recommandé d'utiliser **Antigravity IDE** (éditeur amélioré par l'IA).
*   **Contrôle de version** : Git & GitHub CLI (`gh`).
*   **Runtime** : Node.js & npm.

## 🛤 SOP du développeur : de l'idée à l'implémentation

Nous adoptons un processus standardisé de **Développement piloté par les spécifications (SDD)** pour vous aider à mener à bien le développement étape par étape.

### Phase 1 : Idée & Issue

Tout commence par une idée.

1.  **Vérifier les issues existantes** : Voir si quelqu'un a proposé une idée similaire.
2.  **Créer une issue** :
    *   Pour les nouvelles fonctionnalités, utilisez le modèle **Feature Request**.
    *   Pour les corrections de bugs, utilisez le modèle **Bug Report**.
    *   *Conseil : Même si l'idée est vague, il est possible d'ouvrir une issue pour en discuter.*

### Phase 2 : Analyse & Spécification

Une fois l'issue confirmée, nous entrons dans le processus SDD. C'est le meilleur moment pour acquérir des connaissances sur le domaine (Domain Knowledge).

1.  **Lancer le workflow SDD** :
    À la racine du projet, vous pouvez demander à l'AI Agent :
    > "Je veux commencer à développer l'issue #123, s'il vous plaît lancez /sdd-process pour moi"
    *   L'IA créera le répertoire standard : `/docs/specs/{type}/ISSUE-123_{desc}/`.

2.  **Rédiger le PRD (Product Requirement Document)** :
    *   L'IA vous aidera à créer `/docs/specs/.../PRD_spec.md`.
    *   Vous devez définir : **Quoi faire (User Stories)** et les **critères d'acceptation (Acceptance Criteria)**.
    *   *Conseil : Utilisez l'IA pour vous aider à affiner les User Stories et les cas limites.*

3.  **Rédiger l'SA (System Analysis)** :
    *   Une fois le PRD approuvé, l'IA aide à créer `/docs/specs/.../SA_spec.md`.
    *   Vous devez définir : **L'architecture technique**, **Les API**, **Le flux de données**.
    *   **Traçabilité** : Assurez-vous que chaque décision de conception correspond aux exigences du PRD.

### Phase 3 : Implémentation

Une fois les spécifications finalisées, c'est le moment de coder avec plaisir.

1.  **Vérification avant codage (Pre-Code Check)** :
    *   Confirmez que les statuts du PRD et de l'SA sont tous deux **Approved**.

2.  **Laisser l'IA écrire le code** :
    *   Donnez le `PRD_spec.md` et l' `SA_spec.md` à Antigravity/IA.
    *   Exemple de prompt : *"Veuillez implémenter la fonctionnalité de rendu des autres fenêtres selon la tâche 1 de l'SA_spec.md."*

3.  **Documentation vivante (Living Documentation)** :
    *   ⚠️ **Important** : Si vous constatez que la conception nécessite une modification pendant l'implémentation, **mettez à jour l'SA/PRD immédiatement**.
    *   Gardez les spécifications et le code toujours synchronisés.

### Phase 4 : Vérification & PR

1.  **Auto-examen** :
    *   Exécutez `npm test` pour vous assurer que les tests passent.
    *   Cochez les **critères d'acceptation (Acceptance Criteria)** dans `PRD_spec.md` point par point.

2.  **Ouvrir une Pull Request** :
    *   Utilisez la CLI `gh` pour créer la PR (recommandé) ou via l'interface web.
    *   Si vous utilisez Antigravity, vous pouvez utiliser le workflow `/create-pr` directement.
    *   Exécutez le script de vérification :
        ```bash
        ./.agent/skills/pull-request/scripts/check-pr.sh
        ```
    *   Assurez-vous que la description de la PR est complète et inclut le contexte bilingue (l'IA peut aider à traduire).
    *   **Rapport** : Signalez les résultats de la vérification (Succès/Échec) dans la description de la PR.

## 📝 Guides de style

*   **Messages de commit** : Suivre les Conventional Commits (`feat`, `fix`, `docs`, `refactor`...).
*   **Langue** : La documentation du projet et la communication peuvent utiliser votre langue maternelle, mais les commentaires de code et les variables doivent utiliser l'anglais.
*   **Style de code** : Maintenir la cohérence, se référer au style de code existant.

## 🤝 Demander de l'aide

*   Si vous êtes bloqué, veuillez laisser un commentaire sur l'issue.
*   N'hésitez pas à demander à l'IA : "Que signifie ce morceau de code ?" ou "Comment dois-je tester cette fonctionnalité ?".

Nous attendons votre contribution avec impatience ! Construisons ensemble de meilleurs logiciels avec l'IA.
