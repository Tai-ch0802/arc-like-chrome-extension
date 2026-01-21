# Leitfaden für Mitwirkende

🎉 Zunächst einmal vielen Dank, dass Sie sich die Zeit nehmen, einen Beitrag zu leisten!

Wir widmen uns dem Aufbau einer **niederschwelligen**, **KI-freundlichen** Open-Source-Gemeinschaft. Wir empfehlen dringend die Verwendung von KI-Tools (insbesondere **Antigravity IDE**), um die Entwicklung zu unterstützen. Selbst wenn Sie ein Programmierneuling sind oder sich in diesem Bereich nicht auskennen, sind Sie willkommen, über unseren standardisierten Prozess beizutragen, solange Sie eine Idee haben.

Dieses Dokument führt Sie durch den Prozess, wie Sie einen „vagen Wunsch“ in eine „nutzbare Funktion“ verwandeln.

## 🚀 Kernphilosophie

1.  **AI-Native Development**: Wir begrüßen KI. Scheuen Sie sich nicht, die KI Code oder Dokumentationen schreiben zu lassen oder die Architektur erklären zu lassen.
2.  **Spec-Driven Development (SDD)**: Erst denken, dann handeln. Erst das Konzept (Spec), dann der Code. (`No Spec, No Code`)
3.  **Geringe Reibung**: Verwendung automatisierter Tools und klarer SOPs, um die Hürden für Mitwirkende zu senken.

## 🛠 Werkzeuge

*   **IDE**: Es wird dringend empfohlen, **Antigravity IDE** (KI-gestützter Editor) zu verwenden.
*   **Version Control**: Git & GitHub CLI (`gh`).
*   **Runtime**: Node.js & npm.

## 🛤 Entwickler-SOP: Von der Idee zur Umsetzung

Wir setzen auf einen standardisierten **Spec-Driven Development (SDD)** Prozess, um Sie Schritt für Schritt durch die Entwicklung zu führen.

### Phase 1: Idee & Issue

Alles beginnt mit einer Idee.

1.  **Bestehende Issues prüfen**: Schauen Sie nach, ob bereits jemand eine ähnliche Idee vorgeschlagen hat.
2.  **Issue erstellen**:
    *   Für neue Funktionen verwenden Sie die Vorlage **Feature Request**.
    *   Für Fehlerbehebungen verwenden Sie die Vorlage **Bug Report**.
    *   *Tipp: Auch wenn die Idee noch vage ist, ist es in Ordnung, ein Issue zur Diskussion zu eröffnen.*

### Phase 2: Analyse & Spec

Sobald das Issue bestätigt wurde, treten wir in den SDD-Prozess ein. Dies ist die beste Zeit, um Domain-Wissen zu erwerben.

1.  **SDD-Workflow starten**:
    Geben Sie dem KI-Agenten im Projektverzeichnis folgende Anweisung:
    > "Ich möchte mit der Entwicklung von Issue #123 beginnen, bitte führe /sdd-process für mich aus."
    *   Die KI erstellt das Standardverzeichnis: `/docs/specs/{type}/ISSUE-123_{desc}/`.

2.  **PRD (Product Requirement Document) erstellen**:
    *   Die KI unterstützt Sie bei der Erstellung von `/docs/specs/.../PRD_spec.md`.
    *   Sie müssen definieren: **Was zu tun ist (User Stories)** und **Abnahmekriterien (Acceptance Criteria)**.
    *   *Tipp: Nutzen Sie die KI, um User Stories und Randfälle zu verfeinern.*

3.  **SA (System Analysis) erstellen**:
    *   Nachdem das PRD genehmigt wurde, hilft die KI bei der Erstellung von `/docs/specs/.../SA_spec.md`.
    *   Sie müssen definieren: **Technische Architektur**, **APIs**, **Datenfluss**.
    *   **Traceability**: Stellen Sie sicher, dass jede Designentscheidung auf die PRD-Anforderungen zurückzuführen ist.

### Phase 3: Implementierung

Sobald die Konzepte stehen, geht es an das Programmieren.

1.  **Check vor dem Programmieren (Pre-Code Check)**:
    *   Bestätigen Sie, dass sowohl der Status des PRD als auch des SA auf **Approved** gesetzt sind.

2.  **KI Code schreiben lassen**:
    *   Geben Sie `PRD_spec.md` und `SA_spec.md` in die Antigravity-KI ein.
    *   Beispiel-Prompt: *"Bitte implementiere die Rendering-Funktion für andere Fenster gemäß Aufgabe 1 in der SA_spec.md."*

3.  **Lebendige Dokumentation (Living Documentation)**:
    *   ⚠️ **Wichtig**: Wenn Sie feststellen, dass das Design während der Implementierung geändert werden muss, **aktualisieren Sie sofort das SA/PRD**.
    *   Halten Sie Konzepte (Specs) und Code immer synchron.

### Phase 4: Verifizierung & PR

1.  **Selbstprüfung**:
    *   Führen Sie `npm test` aus, um sicherzustellen, dass die Tests bestanden werden.
    *   Prüfen Sie die **Abnahmekriterien (Acceptance Criteria)** in der `PRD_spec.md` Punkt für Punkt.

2.  **Pull Request eröffnen**:
    *   Verwenden Sie das `gh` CLI, um einen PR zu erstellen (empfohlen), oder nutzen Sie die Web-Oberfläche.
    *   Wenn Sie Antigravity verwenden, können Sie den Workflow `/create-pr` direkt nutzen.
    *   Führen Sie das Verifizierungsskript aus:
        ```bash
        ./.agent/skills/pull-request/scripts/check-pr.sh
        ```
    *   Stellen Sie sicher, dass die PR-Beschreibung vollständig ist und den zweisprachigen Kontext enthält (die KI kann bei der Übersetzung helfen).
    *   **Bericht**: Geben Sie die Verifizierungsergebnisse (Pass/Fail) in der PR-Beschreibung an.

## 📝 Styleguides

*   **Commit-Nachrichten**: Folgen Sie den Conventional Commits (`feat`, `fix`, `docs`, `refactor`...).
    *   Sie können den Skill `commit-message-helper` in diesem Projekt verwenden.
*   **Sprache**: Projektdokumentation und Kommunikation können in Ihrer Muttersprache erfolgen, Code-Kommentare und Variablen müssen jedoch in Englisch verfasst sein.
*   **Code-Stil**: Achten Sie auf Konsistenz und orientieren Sie sich am bestehenden Code-Stil.

## 🤝 Hilfe suchen

*   Wenn Sie nicht weiterkommen, hinterlassen Sie bitte einen Kommentar im Issue.
*   Zögern Sie nicht, die KI zu fragen: "Was bedeutet dieser Code-Abschnitt?" oder "Wie soll ich diese Funktion testen?".

Wir freuen uns auf Ihren Beitrag! Lassen Sie uns gemeinsam mit KI bessere Software entwickeln.
