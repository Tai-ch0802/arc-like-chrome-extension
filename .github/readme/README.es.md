# Arc-Style Chrome Sidebar

Este es un proyecto de extensión de Chrome que tiene como objetivo traer una experiencia de barra lateral vertical similar al navegador Arc a Google Chrome, proporcionando un panel unificado y potente para gestionar pestañas y marcadores.

---

[![Version](https://img.shields.io/chrome-web-store/v/beoonblekmppafnjppedgpgfngghebji?style=flat-square&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Rating](https://img.shields.io/chrome-web-store/rating/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Users](https://img.shields.io/chrome-web-store/users/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Build Status](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Tai-ch0802/arc-like-chrome-extension?style=flat-square)](../../LICENSE)

## 🚀 Nueva versión v1.11.0 actualizada!
[![Demo Video](http://img.youtube.com/vi/Ld4lyaZatWo/0.jpg)](https://www.youtube.com/watch?v=Ld4lyaZatWo)

---

## 🔥 Características Principales

### 🔗 Innovación Exclusiva: Pestañas Vinculadas
¡Esta es nuestra función más potente! Cuando abres un marcador desde la barra lateral, creamos automáticamente un **"Vínculo"**.
- **Evitar el Desorden de Pestañas**: Haz clic en el icono de vínculo junto a un marcador para ver todas las pestañas abiertas desde él, ayudándote a evitar abrir duplicados y ahorrar recursos del sistema.
- **Sincronización Bidireccional**: Cuando se cierra una pestaña, el estado del marcador se actualiza automáticamente; cuando se elimina un marcador, la pestaña vinculada se maneja inteligentemente.
- **Retroalimentación Visual**: Un icono de vínculo refinado aparece junto a los marcadores, permitiéndote saber de un vistazo cuáles están actualmente activos.

### ⚡️ Renderizado Inteligente
¿Tienes miles de marcadores? ¡No hay problema!
- **Renderizado Dinámico**: Cambiado de Virtual Scrolling a un mecanismo de Renderizado Dinámico eficiente, asegurando un rendimiento fluido con mejor compatibilidad.
- **Experiencia Fluida**: Navega por grandes bibliotecas de marcadores sin esfuerzo y sin retrasos.

### 🪟 Gestión Multi-Ventana
- **Vista General de Ventanas**: Ve las pestañas de todas las ventanas de Chrome abiertas directamente en la barra lateral, no solo de la actual.
- **Búsqueda Global**: Los resultados de búsqueda incluyen pestañas de todas las ventanas, permitiendo una navegación instantánea a través de toda tu sesión.

### 🔍 Búsqueda de Nivel Profesional
No solo buscar—encontrar instantáneamente.
- **Filtrado Multi-Palabra Clave**: Soporta palabras clave separadas por espacios (ej., "google docs trabajo") para una localización precisa.
- **Búsqueda por Dominio**: Escribe un dominio (como `github.com`) para filtrar instantáneamente pestañas y marcadores de fuentes específicas.
- **Resaltado Inteligente**: Resaltado en tiempo real de palabras clave coincidentes mantiene tu enfoque visual claro.

### 🗂️ Espacio de Trabajo Unificado
- **Pestañas Verticales**: Ve los títulos completos de las páginas, ya no comprimidos en pequeños iconos.
- **Soporte Nativo de Grupos**: Integración perfecta con los Grupos de Pestañas de Chrome, sincronizando colores y nombres.
- **Nombres Personalizados de Ventanas**: Asigna nombres personalizados a tus ventanas (ej., "Trabajo", "Personal") para un contexto más claro.
- **Arrastrar y Soltar**: Gestión intuitiva—mueve elementos sin esfuerzo entre pestañas, grupos y carpetas de marcadores.
- **Arrastrar para Guardar**: Arrastra una pestaña al área de marcadores para guardarla instantáneamente; arrastra un marcador al área de pestañas para abrirlo.

### 🎨 Diseño Premium
- **Modo Enfoque**: Un elegante tema oscuro con contraste cuidadosamente ajustado para reducir la fatiga visual.
- **Auto-Expansión**: Pasa el cursor sobre las carpetas mientras arrastras elementos para expandir automáticamente la ruta.
- **Hover Inteligente**: Los botones de acción aparecen solo cuando son necesarios, manteniendo la interfaz limpia y sin distracciones.

## ⌨️ Navegación Completa por Teclado
- **Experiencia Nativa**: Usa las teclas `Flecha Arriba`/`Flecha Abajo` para navegar sin problemas entre pestañas y marcadores.
- **Micro-Interacciones**: Usa `Flecha Izquierda`/`Flecha Derecha` para navegar y activar botones internos (como Cerrar, Añadir a Grupo).
- **Integración de Búsqueda**: Presiona `Arriba` en la parte superior de la lista para enfocar la barra de búsqueda; presiona `Abajo` en la barra de búsqueda para saltar a los resultados.
- **Consejo de Enfoque**: Una vez que la barra lateral está abierta, simplemente presiona cualquier tecla de flecha para obtener el foco automáticamente y comenzar a navegar.

### ⌨️ Atajos de Productividad
- **Cmd/Ctrl + I**: Alternar Barra Lateral
- **Opt/Alt + T**: Crear nueva pestaña junto a la actual

---

## 🆚 ¿Por qué elegir esta extensión?

| Característica | Esta extensión | Chrome nativo | Barras laterales tradicionales |
| :--- | :---: | :---: | :---: |
| **Pestañas verticales** | ✅ Título completo | ❌ Comprimido | ✅ |
| **Grupos de pestañas** | ✅ Sincronización nativa | ✅ | ⚠️ Parcial |
| **Integración de marcadores** | ✅ Panel unificado | ❌ Administrador separado | ❌ Separado |
| **Pestañas vinculadas** | ✅ Sincronización perfecta | ❌ | ❌ |
| **Búsqueda multi-ventana** | ✅ | ❌ | ⚠️ Varía |
| **Rendimiento** | ⚡️ Renderizado dinámico | N/A | 🐢 Desplazamiento virtual |

---

## 🚀 Instalación y Desarrollo

### Opción 1: Instalar desde Chrome Web Store (Recomendado)

Puedes instalar la extensión directamente desde la tienda oficial para recibir actualizaciones automáticas:

[**Haz clic aquí para instalar desde Chrome Web Store**](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji?utm_source=item-share-cb)

### Opción 2: Instalación Manual desde el Código Fuente (para Desarrolladores)

**1. Requisitos Previos**

Antes de comenzar, asegúrate de tener [Node.js](https://nodejs.org/) (que incluye npm) instalado en tu sistema.

**2. Pasos de Configuración**

1.  Clona o descarga este proyecto en tu máquina local.
    ```bash
    git clone https://github.com/Tai-ch0802/arc-like-chrome-extension.git
    ```
2.  Navega al directorio del proyecto e instala las dependencias de desarrollo requeridas:
    ```bash
    cd arc-like-chrome-extension
    npm install
    ```
3.  Abre el navegador Chrome y navega a `chrome://extensions`.
4.  Habilita el "Modo desarrollador" en la esquina superior derecha.
5.  Haz clic en "Cargar descomprimida" y selecciona el directorio raíz del proyecto.

---

## 🛠️ Comandos de Compilación

Este proyecto usa un `Makefile` para automatizar el proceso de compilación.

*   **Modo Desarrollo**: `make` o `make package`

    Este comando crea una compilación de desarrollo sin minificar. Todo el código fuente permanece tal cual, facilitando la depuración en las herramientas de desarrollo de Chrome. El archivo empaquetado será `arc-sidebar-v<version>-dev.zip`.

*   **Modo Producción**: `make release`

    Este comando ejecuta el proceso de compilación de producción, que incluye los siguientes pasos:
    1.  Agrupa y minifica todos los módulos JavaScript en un solo archivo usando `esbuild`.
    2.  Minifica el archivo CSS.
    3.  Empaqueta la salida en un archivo `.zip` adecuado para subir a Chrome Web Store.

---

## 🧪 Pruebas

Para asegurar la calidad y estabilidad de las funciones del proyecto, adoptamos un enfoque de pruebas de casos de uso para validar cada cambio.

### Pruebas de Casos de Uso

*   **Propósito**: Cada prueba de caso de uso define claramente el comportamiento esperado y el flujo operativo de una función específica. Se presentan en texto descriptivo, detallando los pasos de prueba, precondiciones, resultados esperados y métodos de verificación.
*   **Ubicación**: Todos los archivos de prueba de casos de uso se almacenan en la carpeta `usecase_tests/` en la raíz del proyecto.
*   **Ejecución y Verificación**: Estas pruebas se ejecutan actualmente principalmente de forma manual. Los desarrolladores deben simular las operaciones del usuario en la extensión de Chrome en ejecución según los pasos en los archivos de prueba y observar si los resultados cumplen las expectativas.

### Marco de Pruebas Automatizadas

Para futuras pruebas automatizadas, hemos elegido **Puppeteer** como nuestro marco de pruebas End-to-End (E2E).

*   **Puppeteer**: Una biblioteca Node.js que proporciona una API de alto nivel para controlar Chromium o Chrome a través del Protocolo DevTools. Nos permite escribir scripts para simular varias acciones del usuario en el navegador, como clics, entrada, navegación, etc., y capturar capturas de pantalla o recuperar el contenido de la página para verificación.
*   **Instalación**: Puppeteer ha sido instalado en el proyecto vía `npm install puppeteer`.
*   **Perspectiva Futura**: En el futuro, los casos de prueba descriptivos en `usecase_tests/` se convertirán gradualmente en scripts ejecutables de Puppeteer para lograr pruebas automatizadas e integración continua.

---

## 👥 Colaboradores

Agradecimientos especiales a todos los colaboradores que ayudan a hacer este proyecto mejor:

<a href="https://github.com/Tai-ch0802/arc-like-chrome-extension/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Tai-ch0802/arc-like-chrome-extension" />
</a>

---

## 🔒 Privacidad y preguntas frecuentes

Valoramos su privacidad. Esta extensión funciona de forma totalmente local y no recopila ni transmite sus datos personales.

Para más detalles, por favor consulte nuestra [Política de Privacidad](../../PRIVACY_POLICY.md).

---

Este proyecto está licenciado bajo la Licencia MIT.
