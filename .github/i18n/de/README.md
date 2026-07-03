# Sidebar im Arc-Stil für Chrome · Ihr Wissens-Arbeitsplatz für Chrome

[English](/.github/i18n/en/README.md) | [繁體中文](/.github/i18n/zh_TW/README.md) | [简体中文](/.github/i18n/zh_CN/README.md) | [日本語](/.github/i18n/ja/README.md) | [한국어](/.github/i18n/ko/README.md) | [Deutsch](/.github/i18n/de/README.md) | [Español](/.github/i18n/es/README.md) | [Français](/.github/i18n/fr/README.md) | [हिन्दी](/.github/i18n/hi/README.md) | [Bahasa Indonesia](/.github/i18n/id/README.md) | [Português (Brasil)](/.github/i18n/pt_BR/README.md) | [Русский](/.github/i18n/ru/README.md) | [ไทย](/.github/i18n/th/README.md) | [Tiếng Việt](/.github/i18n/vi/README.md)


🌐 **Offizielle Website**: [https://sidebar-for-tabs-bookmarks.taislife.work/](https://sidebar-for-tabs-bookmarks.taislife.work/)

---

[![Version](https://img.shields.io/chrome-web-store/v/beoonblekmppafnjppedgpgfngghebji?style=flat-square&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Rating](https://img.shields.io/chrome-web-store/rating/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Users](https://img.shields.io/chrome-web-store/users/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Build Status](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Tai-ch0802/arc-like-chrome-extension?style=flat-square)](../../LICENSE)

Eine Arc-artige Sidebar, die weit über Chromes native vertikale Tabs hinausgeht: vereinheitlichte Tabs + Lesezeichen + Leseliste, **standardmäßig lokale KI** (automatische Gruppen-Benennung, Tab-Cleanup-Vorschläge, Hover-Zusammenfassungen, natürlichsprachliche Suche — integriertes Gemini Nano, oder bringen Sie Ihren eigenen API-Schlüssel für Gemini API / Claude / OpenAI-kompatibel / Ollama mit), **Workspaces** (Tab-Bündel ruhen und wiederherstellen, Metadaten geräteübergreifend synchronisiert), eine **⌘K-Befehlspalette** und **Lesezeichen-Tools** für Tags, Dedupe und Dead-Link-Bereinigung — standardmäßig auf dem Gerät, kein API-Schlüssel erforderlich.

## 🚀 Neues Update v1.14.0!
[![Demo-Video](http://img.youtube.com/vi/aRSQ1atlyCw/0.jpg)](https://www.youtube.com/watch?v=aRSQ1atlyCw)

### ⚡️ Funktionen
- **Benutzerdefiniertes Hintergrundbild**: Legen Sie Ihren eigenen Hintergrund für die Sidebar fest (Upload oder URL), inkl. Deckkraft und Unschärfe.
- **Überarbeitetes Einstellungs-UI**: Ein übersichtlicheres Erlebnis mit einem neuen ausklappbaren Akkordeon-Layout.
- **Eigene Themenfarben**: Volle Kontrolle über Hintergrund-, Akzent- und Textfarben.
- **Vertikale Tabs**: Vollständige Seitentitel sehen, nicht mehr zu winzigen Icons komprimiert.
- **Tab-Gruppen**: Integriert sich perfekt in Chrome-Tab-Gruppen, synchronisiert Farben und Namen.
- **Lesezeichen-Integration**: Einheitliches Panel zur Verwaltung von Tabs und Lesezeichen.
- **Verknüpfte Tabs**: Erstellt automatisch eine „Verknüpfung“, wenn ein Lesezeichen geöffnet wird, um Dubletten zu vermeiden.
- **Fensterübergreifende Verwaltung**: Tabs über alle Fenster hinweg verwalten mit globaler Suche.
- **Dynamisches Rendering**: Verarbeitet tausende Lesezeichen effizient mit flüssiger Performance.
- **Barrierefreiheit**: Schnelle Aktionen mit `F2` zum Umbenennen und `Entf` zum Löschen.

## 🤝 Mitwirken

Wir freuen uns über Beiträge aus der Community! Egal, ob Sie einen Fehler beheben, die Dokumentation verbessern oder eine neue Funktion vorschlagen – Ihre Hilfe ist willkommen.

Wir nutzen einen **Spec-Driven Development (SDD)** Workflow und sind **KI-freundlich**. Schauen Sie in unseren Leitfaden für Mitwirkende, um loszulegen:

👉 **[Lesen Sie unseren Leitfaden für Mitwirkende](./CONTRIBUTING.md)**

Ein praktisches Beispiel für den Entwicklungsprozess finden Sie in [Issue #30](https://github.com/Tai-ch0802/arc-like-chrome-extension/issues/30).

---

## 🔥 Hauptmerkmale

### 🔗 Exklusive Innovation: Verknüpfte Tabs (Linked Tabs)
Dies ist unser leistungsstärkstes Feature! Wenn Sie ein Lesezeichen in der Seitenleiste öffnen, erstellen wir automatisch einen **„Link“**.
- **Tab-Chaos vermeiden**: Klicken Sie auf das Link-Symbol neben einem Lesezeichen, um alle davon geöffneten Tabs zu sehen. Dies hilft Ihnen, Duplikate zu vermeiden und Systemressourcen zu sparen.
- **Zwei-Wege-Sync**: Wenn ein Tab geschlossen wird, aktualisiert sich der Lesezeichen-Status automatisch; wenn ein Lesezeichen gelöscht wird, wird der verknüpfte Tab intelligent behandelt.
- **Visuelles Feedback**: Ein raffiniertes Link-Symbol erscheint neben den Lesezeichen, sodass Sie auf einen Blick sehen, welche gerade aktiv sind.

### ⚡️ Smart Rendering
Tausende von Lesezeichen? Kein Problem!
- **Dynamisches Rendering**: Umstellung von Virtual Scrolling auf einen effizienten Dynamic Rendering Mechanismus, der flüssige Performance bei besserer Kompatibilität bietet.
- **Reibungslose Erfahrung**: Navigieren Sie mühelos und ohne Verzögerungen durch große Lesezeichen-Bibliotheken.

### 🪟 Fensterübergreifendes Management
- **Fenster-Übersicht**: Zeigen Sie Tabs aus allen geöffneten Chrome-Fenstern direkt in der Seitenleiste an, nicht nur aus dem aktuellen.
- **Globale Suche**: Suchergebnisse enthalten Tabs aus allen Fenstern, was eine sofortige Navigation durch Ihre gesamte Sitzung ermöglicht.

### 🔍 Suche auf Profi-Niveau
Nicht nur suchen – sofort finden.
- **Multi-Keyword-Filterung**: Unterstützt durch Leerzeichen getrennte Keywords (z. B. „google docs arbeit“) für präzises Targeting.
- **Domain-Suche**: Geben Sie eine Domain ein (wie `github.com`), um Tabs und Lesezeichen von bestimmten Quellen sofort zu filtern.
- **Smart Highlighting**: Echtzeit-Highlighting von passenden Keywords hält Ihren visuellen Fokus klar.

### 🗂️ Einheitlicher Workspace
- **Vertikale Tabs**: Vollständige Seitentitel anzeigen, ohne Komprimierung.
- **Native Gruppen-Unterstützung**: Perfekte Integration in Chrome-Tab-Gruppen.
- **Benutzerdefinierte Fensternamen**: Weisen Sie Ihren Fenstern benutzerdefinierte Namen zu (z. B. „Arbeit“, „Privat“) für mehr Klarheit.
- **Drag & Drop**: Intuitive Verwaltung – verschieben Sie Elemente mühelos zwischen Tabs, Gruppen und Lesezeichenordnern.
- **Ziehen zum Speichern**: Ziehen Sie einen Tab in den Lesezeichenbereich, um ihn sofort zu speichern; ziehen Sie ein Lesezeichen in den Tab-Bereich, um es zu öffnen.

### 🎨 Premium-Design
- **Fokus-Modus**: Ein schnittiges dunkles Design mit sorgfältig abgestimmtem Kontrast zur Schonung der Augen.
- **Automatisches Aufklappen**: Bewegen Sie den Mauszeiger beim Ziehen von Elementen über einen Ordner, um den Pfad automatisch aufzuklappen.
- **Smart Hover**: Aktionsschaltflächen erscheinen nur bei Bedarf, um die Benutzeroberfläche sauber und ablenkungsfrei zu halten.

### 📚 Leseliste & RSS
Ihr persönlicher Hub für Artikel-Kuratierung direkt in der Sidebar.
- **Chrome Leselisten-Integration**: Synchronisiert mit der nativen Chrome-Leseliste für nahtloses „Später lesen“.
- **RSS-Abonnement**: Abonnieren Sie beliebige RSS-Feeds; neue Artikel werden automatisch Ihrer Leseliste hinzugefügt.
- **Intelligente Duplikaterkennung**: Hash-basierte Filterung stellt sicher, dass keine doppelten Einträge entstehen.
- **Sortieroptionen**: Sortieren Sie nach Datum (neueste/älteste) oder Titel für schnellen Zugriff.
- **Manuelles Abrufen**: Laden Sie die neuesten Artikel sofort mit der Schaltfläche „Jetzt abrufen“.
- **Stapelweises Löschen**: Entfernen Sie alle gelesenen Elemente mit einem Klick.

## ⌨️ Vollständige Tastaturnavigation
- **Native Erfahrung**: Verwenden Sie die Tasten `Pfeil auf`/`Pfeil ab`, um nahtlos zwischen Tabs und Lesezeichen zu navigieren.
- **Mikro-Interaktionen**: Verwenden Sie `Pfeil links`/`Pfeil rechts` zum Navigieren und zum Auslösen interner Schaltflächen (wie Schließen, Zu Gruppe hinzufügen).
- **Such-Integration**: Drücken Sie am Anfang der Liste `Pfeil auf`, um die Suchleiste zu fokussieren; drücken Sie in der Suchleiste `Pfeil ab`, um zu den Ergebnissen zu springen.
- **Fokus-Tipp**: Sobald die Seitenleiste geöffnet ist, drücken Sie einfach eine beliebige Pfeiltaste, um automatisch den Fokus zu erhalten und mit der Navigation zu beginnen.

### ⌨️ Produktivitäts-Shortcuts
- **Cmd/Ctrl + I**: Seitenleiste umschalten
- **Opt/Alt + T**: Neuen Tab neben dem aktuellen erstellen

---

## 🆚 Warum diese Erweiterung wählen?

| Feature | Diese Erweiterung | Standard-Chrome | Traditionelle Seitenleisten |
| :--- | :---: | :---: | :---: |
| **Vertikale Tabs** | ✅ Voller Titel | ❌ Komprimiert | ✅ |
| **Tab-Gruppen** | ✅ Native Sync | ✅ | ⚠️ Teilweise |
| **Lesezeichen-Integration** | ✅ Einheitliches Panel | ❌ Separater Manager | ❌ Separat |
| **Verknüpfte Tabs** | ✅ Synchronisiert | ❌ | ❌ |
| **Leseliste & RSS** | ✅ Integriert | ⚠️ Basis | ❌ |
| **Fensterübergreifende Suche** | ✅ | ❌ | ⚠️ Variiert |
| **Performance** | ⚡️ Dynamisches Rendering | N/A | 🐢 Virtual Scroll |

---

## 🚀 Installation & Entwicklung

### Option 1: Aus dem Chrome Web Store installieren (Empfohlen)

Sie können die Erweiterung direkt aus dem offiziellen Store installieren, um automatische Updates zu erhalten:

[**Hier klicken, um aus dem Chrome Web Store zu installieren**](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji?utm_source=item-share-cb)

### Option 2: Manuelle Installation aus dem Quellcode (für Entwickler)

**1. Voraussetzungen**

Stellen Sie sicher, dass [Node.js](https://nodejs.org/) (einschließlich npm) auf Ihrem System installiert ist.

**2. Setup-Schritte**

1.  Klonen oder laden Sie dieses Projekt auf Ihren lokalen Rechner herunter.
    ```bash
    git clone https://github.com/Tai-ch0802/arc-like-chrome-extension.git
    ```
2.  Navigieren Sie in das Projektverzeichnis und installieren Sie die erforderlichen Entwicklungsabhängigkeiten:
    ```bash
    cd arc-like-chrome-extension
    npm install
    ```
3.  Öffnen Sie den Chrome-Browser und rufen Sie `chrome://extensions` auf.
4.  Aktivieren Sie oben rechts den „Entwicklermodus“.
5.  Klicken Sie auf „Entpackte Erweiterung laden“ und wählen Sie das Stammverzeichnis des Projekts aus.

---

## 🛠️ Build-Befehle

Dieses Projekt verwendet ein `Makefile`, um den Build-Prozess zu automatisieren.

*   **Entwicklungsmodus**: `make` oder `make package`

    Dieser Befehl erstellt einen unkomprimierten Entwicklungs-Build. Der Quellcode bleibt unverändert, was das Debuggen in den Chrome-Entwicklertools erleichtert. Die gepackte Datei ist `arc-sidebar-v<version>-dev.zip`.

*   **Produktionsmodus**: `make release`

    Dieser Befehl führt den Produktions-Build-Prozess aus, der folgende Schritte umfasst:
    1.  Bündelt und minimiert alle JavaScript-Module mit `esbuild` in einer einzigen Datei.
    2.  Minimiert die CSS-Datei.
    3.  Packt die Ausgabe in eine `.zip`-Datei, die für den Upload in den Chrome Web Store geeignet ist.

---

## 🧪 Tests

Um die Qualität und Stabilität der Funktionen des Projekts zu gewährleisten, setzen wir auf einen Use-Case-Test-Ansatz, um jede Änderung zu validieren.

### Use Case Tests

*   **Zweck**: Jeder Use-Case-Test definiert klar das erwartete Verhalten und den Ablauf einer bestimmten Funktion. Sie werden in beschreibender Textform präsentiert und enthalten Testschritte, Voraussetzungen, erwartete Ergebnisse und Verifizierungsmethoden.
*   **Ort**: Alle Use-Case-Testdateien sind im Ordner `usecase_tests/` im Projektstamm gespeichert.
*   **Ausführung & Verifizierung**: Diese Tests werden derzeit primär manuell durchgeführt. Entwickler müssen Benutzeraktionen in der laufenden Chrome-Erweiterung gemäß den Schritten in den Testdateien simulieren und beobachten, ob die Ergebnisse den Erwartungen entsprechen.

### Automatisierte Tests

Für zukünftige automatisierte Tests haben wir uns für **Puppeteer** als unser End-to-End (E2E) Test-Framework entschieden. Dies ermöglicht es uns, Skripte zu schreiben, die verschiedene Benutzeraktionen im Browser simulieren und die Funktionalität verifizieren.

---

## 🔒 Datenschutz & FAQ

Wir schätzen Ihre Privatsphäre. Diese Erweiterung arbeitet standardmäßig lokal und sammelt keine personenbezogenen Daten. Wenn Sie sich mit Ihrem eigenen API-Schlüssel für einen Cloud-KI-Anbieter entscheiden, gehen KI-Anfragen direkt von Ihrem Browser ausschließlich an diesen Anbieter.

Weitere Details finden Sie in unserer [Datenschutzerklärung](../../PRIVACY_POLICY.md).

---

## 👥 Mitwirkende

Ein besonderer Dank geht an alle Mitwirkenden, die helfen, dieses Projekt zu verbessern:

<a href="https://github.com/Tai-ch0802/arc-like-chrome-extension/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Tai-ch0802/arc-like-chrome-extension" />
</a>

## 📜 Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert – siehe die [LICENSE](../../LICENSE) Datei für Details.
