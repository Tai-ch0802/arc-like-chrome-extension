# Sidebar im Arc-Stil für Chrome

[English](README.en.md) | [繁體中文](README.zh_TW.md) | [简体中文](README.zh_CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [हिन्दी](README.hi.md) | [Bahasa Indonesia](README.id.md) | [Português (Brasil)](README.pt_BR.md) | [Русский](README.ru.md) | [ไทย](README.th.md) | [Tiếng Việt](README.vi.md)

---

[![Version](https://img.shields.io/chrome-web-store/v/beoonblekmppafnjppedgpgfngghebji?style=flat-square&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Rating](https://img.shields.io/chrome-web-store/rating/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Users](https://img.shields.io/chrome-web-store/users/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Build Status](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Tai-ch0802/arc-like-chrome-extension?style=flat-square)](../../LICENSE)

Dies ist ein Chrome-Erweiterungsprojekt, das darauf abzielt, eine vertikale Seitenleiste im Stil des Arc-Browsers in Google Chrome zu integrieren und ein einheitliches, leistungsstarkes Panel für die Verwaltung von Tabs und Lesezeichen bereitzustellen.

## 🚀 Neues Release v1.11.0 Update!
[![Demo Video](http://img.youtube.com/vi/Ld4lyaZatWo/0.jpg)](https://www.youtube.com/watch?v=Ld4lyaZatWo)

### ⚡️ Features
- **Vertikale Tabs**: Vollständige Seitentitel anzeigen, nicht mehr zu winzigen Symbolen komprimiert.
- **Tab-Gruppen**: Integriert sich perfekt in Chrome-Tab-Gruppen und synchronisiert Farben und Namen.
- **Lesezeichen-Integration**: Einheitliches Panel für die Verwaltung von Tabs und Lesezeichen.
- **Verknüpfte Tabs**: Erstellt beim Öffnen eines Lesezeichens automatisch einen „Link“, um Duplikate zu vermeiden.
- **Fensterübergreifende Suche**: Suche in Tabs und Lesezeichen über alle geöffneten Fenster hinweg.
- **Dynamisches Rendering**: Effizientes Rendering für große Lesezeichen-Bibliotheken.

## 🤝 Mitwirken

Wir freuen uns über Beiträge aus der Community! Egal, ob Sie einen Fehler beheben, die Dokumentation verbessern oder eine neue Funktion vorschlagen – Ihre Hilfe ist willkommen.

Wir nutzen einen **Spec-Driven Development (SDD)** Workflow und sind **KI-freundlich**. Schauen Sie in unseren Leitfaden für Mitwirkende, um loszulegen:

👉 **[Lesen Sie unseren Leitfaden für Mitwirkende](./CONTRIBUTING.md)**

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

Wir schätzen Ihre Privatsphäre. Diese Erweiterung arbeitet vollständig lokal und sammelt oder überträgt keine personenbezogenen Daten.

Weitere Details finden Sie in unserer [Datenschutzerklärung](../../PRIVACY_POLICY.md).

---

## 👥 Mitwirkende

Ein besonderer Dank geht an alle Mitwirkenden, die helfen, dieses Projekt zu verbessern:

<a href="https://github.com/Tai-ch0802/arc-like-chrome-extension/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Tai-ch0802/arc-like-chrome-extension" />
</a>

## 📜 Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert – siehe die [LICENSE](../../LICENSE) Datei für Details.
