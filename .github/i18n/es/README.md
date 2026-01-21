# Barra lateral de Chrome al estilo Arc

[English](README.en.md) | [繁體中文](README.zh_TW.md) | [简体中文](README.zh_CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [हिन्दी](README.hi.md) | [Bahasa Indonesia](README.id.md) | [Português (Brasil)](README.pt_BR.md) | [Русский](README.ru.md) | [ไทย](README.th.md) | [Tiếng Việt](README.vi.md)

---

[![Version](https://img.shields.io/chrome-web-store/v/beoonblekmppafnjppedgpgfngghebji?style=flat-square&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Rating](https://img.shields.io/chrome-web-store/rating/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Users](https://img.shields.io/chrome-web-store/users/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Build Status](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Tai-ch0802/arc-like-chrome-extension?style=flat-square)](../../LICENSE)

Este es un proyecto de extensión de Chrome que tiene como objetivo llevar una experiencia de barra lateral vertical similar al navegador Arc a Google Chrome, proporcionando un panel unificado y potente para gestionar pestañas y marcadores.

## 🚀 ¡Actualización de la nueva versión v1.11.0!
[![Vídeo de demostración](http://img.youtube.com/vi/Ld4lyaZatWo/0.jpg)](https://www.youtube.com/watch?v=Ld4lyaZatWo)

### ⚡️ Características
- **Pestañas verticales**: Visualiza los títulos de página completos, sin que se compriman en iconos minúsculos.
- **Grupos de pestañas**: Se integra perfectamente con los grupos de pestañas de Chrome, sincronizando colores y nombres.
- **Integración de marcadores**: Panel unificado para la gestión de pestañas y marcadores.
- **Pestañas vinculadas**: Crea automáticamente un "Enlace" al abrir un marcador, evitando duplicados.
- **Búsqueda en varias ventanas**: Busca pestañas y marcadores en todas las ventanas abiertas.
- **Renderizado dinámico**: Renderizado eficiente para grandes bibliotecas de marcadores.

## 🤝 Contribuir

¡Agradecemos las contribuciones de la comunidad! Ya sea que estés corrigiendo un error, mejorando la documentación o proponiendo una nueva característica, tu ayuda es bienvenida.

Utilizamos un flujo de trabajo **Desarrollo basado en especificaciones (SDD)** y somos **compatibles con IA**. Consulta nuestra guía de contribución para empezar:

👉 **[Lee nuestras directrices de contribución](./CONTRIBUTING.md)**

---

## 🔥 Características principales

### 🔗 Innovación exclusiva: Pestañas vinculadas (Linked Tabs)
¡Esta es nuestra característica más potente! Cuando abres un marcador desde la barra lateral, creamos automáticamente un **"Enlace"**.
- **Evita el desorden de pestañas**: Haz clic en el icono de enlace junto a un marcador para ver todas las pestañas abiertas desde él, lo que te ayuda a evitar abrir duplicados y ahorra recursos del sistema.
- **Sincronización bidireccional**: Cuando se cierra una pestaña, el estado del marcador se actualiza automáticamente; cuando se elimina un marcador, la pestaña vinculada se gestiona de forma inteligente.
- **Retroalimentación visual**: Aparece un refinado icono de enlace junto a los marcadores, lo que te permite saber de un vistazo cuáles están activos actualmente.

### ⚡️ Renderizado inteligente
¿Tienes miles de marcadores? ¡No hay problema!
- **Renderizado dinámico**: Cambiamos del desplazamiento virtual a un mecanismo de renderizado dinámico eficiente, garantizando un rendimiento fluido con una mejor compatibilidad.
- **Experiencia fluida**: Navega por grandes bibliotecas de marcadores sin esfuerzo y sin retrasos.

### 🪟 Gestión de varias ventanas
- **Resumen de ventanas**: Visualiza las pestañas de todas las ventanas de Chrome abiertas directamente en la barra lateral, no solo de la ventana actual.
- **Búsqueda global**: Los resultados de la búsqueda incluyen pestañas de todas las ventanas, lo que permite una navegación instantánea por toda tu sesión.

### 🔍 Búsqueda de nivel profesional
No solo busques, encuentra al instante.
- **Filtrado por múltiples palabras clave**: Admite palabras clave separadas por espacios (p. ej., "google docs trabajo") para un objetivo preciso.
- **Búsqueda por dominio**: Escribe un dominio (como `github.com`) para filtrar al instante pestañas y marcadores de fuentes específicas.
- **Resaltado inteligente**: El resaltado en tiempo real de las palabras clave coincidentes mantiene clara tu atención visual.

### 🗂️ Espacio de trabajo unificado
- **Pestañas verticales**: Visualiza los títulos de página completos, sin compresión.
- **Soporte de grupos nativos**: Se integra perfectamente con los grupos de pestañas de Chrome.
- **Nombramiento personalizado de ventanas**: Asigna nombres personalizados a tus ventanas (p. ej., "Trabajo", "Personal") para un contexto más claro.
- **Arrastrar y soltar**: Gestión intuitiva: mueve elementos sin esfuerzo entre pestañas, grupos y carpetas de marcadores.
- **Arrastrar para guardar**: Arrastra una pestaña al área de marcadores para guardarla al instante; arrastra un marcador al área de pestañas para abrirlo.

### 🎨 Diseño Premium
- **Modo enfoque**: Un elegante tema oscuro con un contraste cuidadosamente ajustado para reducir la fatiga visual.
- **Expansión automática**: Desplázate sobre las carpetas mientras arrastras elementos para expandir automáticamente la ruta.
- **Desplazamiento inteligente**: Los botones de acción solo aparecen cuando es necesario, manteniendo la interfaz limpia y libre de distracciones.

## ⌨️ Navegación completa por teclado
- **Experiencia nativa**: Usa las teclas `Flecha arriba`/`Flecha abajo` para navegar sin problemas entre pestañas y marcadores.
- **Microinteracciones**: Usa `Flecha izquierda`/`Flecha derecha` para navegar y activar botones internos (como Cerrar, Añadir al grupo).
- **Integración de búsqueda**: Presiona `Arriba` en la parte superior de la lista para enfocar la barra de búsqueda; presiona `Abajo` en la barra de búsqueda para saltar a los resultados.
- **Consejo de enfoque**: Una vez que la barra lateral está abierta, simplemente presiona cualquier tecla de flecha para obtener automáticamente el enfoque e iniciar la navegación.

### ⌨️ Atajos de productividad
- **Cmd/Ctrl + I**: Alternar barra lateral
- **Opt/Alt + T**: Crear nueva pestaña junto a la actual

---

## 🆚 ¿Por qué elegir esta extensión?

| Característica | Esta extensión | Chrome nativo | Barras laterales tradicionales |
| :--- | :---: | :---: | :---: |
| **Pestañas verticales** | ✅ Título completo | ❌ Comprimido | ✅ |
| **Grupos de pestañas** | ✅ Sincronización nativa | ✅ | ⚠️ Parcial |
| **Integración de marcadores** | ✅ Panel unificado | ❌ Gestor independiente | ❌ Independiente |
| **Pestañas vinculadas** | ✅ Sincronizado | ❌ | ❌ |
| **Búsqueda en ventanas** | ✅ | ❌ | ⚠️ Varía |
| **Rendimiento** | ⚡️ Renderizado dinámico | N/A | 🐢 Desplazamiento virtual |

---

## 🚀 Instalación y desarrollo

### Opción 1: Instalar desde Chrome Web Store (Recomendado)

Puedes instalar la extensión directamente desde la tienda oficial para recibir actualizaciones automáticas:

[**Haz clic aquí para instalar desde Chrome Web Store**](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji?utm_source=item-share-cb)

### Opción 2: Instalación manual desde el código fuente (para desarrolladores)

**1. Requisitos previos**

Antes de comenzar, asegúrate de tener instalado [Node.js](https://nodejs.org/) (que incluye npm) en tu sistema.

**2. Pasos de configuración**

1.  Clona o descarga este proyecto en tu máquina local.
    ```bash
    git clone https://github.com/Tai-ch0802/arc-like-chrome-extension.git
    ```
2.  Navega hasta el directorio del proyecto e instala las dependencias de desarrollo necesarias:
    ```bash
    cd arc-like-chrome-extension
    npm install
    ```
3.  Abre el navegador Chrome y navega a `chrome://extensions`.
4.  Activa el "Modo de desarrollador" en la esquina superior derecha.
5.  Haz clic en "Cargar descomprimida" y selecciona el directorio raíz del proyecto.

---

## 🛠️ Comandos de construcción

Este proyecto utiliza un `Makefile` para automatizar el proceso de construcción.

*   **Modo de desarrollo**: `make` o `make package`

    Este comando crea una compilación de desarrollo sin minificar. Todo el código fuente permanece tal cual, lo que facilita la depuración en las herramientas de desarrollo de Chrome. El archivo empaquetado será `arc-sidebar-v<versión>-dev.zip`.

*   **Modo de producción**: `make release`

    Este comando ejecuta el proceso de compilación de producción, que incluye los siguientes pasos:
    1.  Agrupa y minifica todos los módulos JavaScript en un solo archivo usando `esbuild`.
    2.  Minifica el archivo CSS.
    3.  Empaqueta la salida en un archivo `.zip` adecuado para subirlo a la Chrome Web Store.

---

## 🧪 Pruebas

Para garantizar la calidad y estabilidad de las características del proyecto, adoptamos un enfoque de pruebas de casos de uso para validar cada cambio.

### Pruebas de casos de uso

*   **Propósito**: Cada prueba de caso de uso define claramente el comportamiento esperado y el flujo operativo de una característica específica. Se presentan en texto descriptivo, detallando los pasos de la prueba, las precondiciones, los resultados esperados y los métodos de verificación.
*   **Ubicación**: Todos los archivos de prueba de casos de uso se almacenan en la carpeta `usecase_tests/` en la raíz del proyecto.
*   **Ejecución y verificación**: Actualmente, estas pruebas se ejecutan principalmente de forma manual. Los desarrolladores deben simular las operaciones del usuario en la extensión de Chrome en ejecución según los pasos de los archivos de prueba y observar si los resultados cumplen con las expectativas.

### Pruebas automatizadas

Para futuras pruebas automatizadas, hemos elegido **Puppeteer** como nuestro marco de pruebas de extremo a extremo (E2E). Esto nos permite escribir scripts para simular diversas acciones del usuario en el navegador y verificar la funcionalidad.

---

## 🔒 Privacidad y preguntas frecuentes

Valoramos tu privacidad. Esta extensión funciona de forma totalmente local y no recopila ni transmite tus datos personales.

Para más detalles, consulta nuestra [Política de privacidad](../../PRIVACY_POLICY.md).

---

## 👥 Colaboradores

Un agradecimiento especial a todos los colaboradores que ayudan a que este proyecto sea mejor:

<a href="https://github.com/Tai-ch0802/arc-like-chrome-extension/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Tai-ch0802/arc-like-chrome-extension" />
</a>

## 📜 Licencia

Este proyecto tiene una licencia MIT; consulta el archivo [LICENSE](../../LICENSE) para obtener más detalles.
