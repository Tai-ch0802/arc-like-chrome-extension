# Guía de contribución

🎉 En primer lugar, ¡gracias por tomarte el tiempo para contribuir!

Nos dedicamos a construir una comunidad de código abierto de **baja barrera** y **orientada a la IA**. Recomendamos encarecidamente el uso de herramientas de IA (especialmente **Antigravity IDE**) para ayudar en el desarrollo. Incluso si eres un novato en programación o no estás familiarizado con este campo, siempre que tengas una idea, eres bienvenido a contribuir a través de nuestro proceso estandarizado.

Este documento te guiará sobre cómo convertir un "deseo vago" en una "funcionalidad utilizable".

## 🚀 Filosofía central

1.  **Desarrollo nativo de IA (AI-Native)**: Adoptamos la IA. No tengas miedo de dejar que la IA te ayude a escribir código, documentación o explicar la arquitectura.
2.  **Desarrollo guiado por especificaciones (SDD)**: Piensa antes de actuar. Las especificaciones primero, el código después. (`No Spec, No Code`)
3.  **Baja fricción**: Uso de herramientas automatizadas y SOP claros para reducir la barrera a la contribución.

## 🛠 Herramientas

*   **IDE**: Se recomienda encarecidamente usar **Antigravity IDE** (editor mejorado por IA).
*   **Control de versiones**: Git y GitHub CLI (`gh`).
*   **Runtime**: Node.js y npm.

## 🛤 SOP del desarrollador: de la idea a la implementación

Adoptamos un proceso estandarizado de **Desarrollo guiado por especificaciones (SDD)** para ayudarte a completar el desarrollo paso a paso.

### Fase 1: Idea y problema (Idea & Issue)

Todo comienza con una idea.

1.  **Consultar los problemas (issues) existentes**: Ver si alguien ha propuesto una idea similar.
2.  **Crear un problema (issue)**:
    *   Para nuevas funciones, utiliza la plantilla **Feature Request**.
    *   Para correcciones de errores, utiliza la plantilla **Bug Report**.
    *   *Consejo: Incluso si la idea es vaga, está bien abrir un problema para discutirlo.*

### Fase 2: Análisis y especificación (Analysis & Spec)

Una vez confirmado el problema, entramos en el proceso SDD. Este es el mejor momento para adquirir conocimientos sobre el dominio (Domain Knowledge).

1.  **Iniciar el flujo de trabajo SDD**:
    En la raíz del proyecto, puedes pedirle al Agente de IA:
    > "Quiero empezar a desarrollar el problema #123, por favor ejecuta /sdd-process por mí"
    *   La IA creará el directorio estándar: `/docs/specs/{type}/ISSUE-123_{desc}/`.

2.  **Redactar el PRD (Product Requirement Document)**:
    *   La IA te ayudará a crear `/docs/specs/.../PRD_spec.md`.
    *   Debes definir: **Qué hacer (User Stories)** y **Criterios de aceptación (Acceptance Criteria)**.
    *   *Consejo: Usa la IA para ayudarte a refinar las historias de usuario y los casos límite.*

3.  **Redactar el SA (System Analysis)**:
    *   Después de que se apruebe el PRD, la IA ayuda a crear `/docs/specs/.../SA_spec.md`.
    *   Debes definir: **Arquitectura técnica**, **APIs**, **Flujo de datos**.
    *   **Trazabilidad**: Asegúrate de que cada decisión de diseño se asocie con los requisitos del PRD.

### Fase 3: Implementación

Una vez finalizadas las especificaciones, es hora de programar con alegría.

1.  **Verificación antes de programar (Pre-Code Check)**:
    *   Confirma que tanto el estado del PRD como el del SA sean **Approved**.

2.  **Dejar que la IA escriba el código**:
    *   Entrega el `PRD_spec.md` y el `SA_spec.md` a Antigravity/IA.
    *   Ejemplo de prompt: *"Por favor, implementa la función de renderizado de las otras ventanas según la tarea 1 del SA_spec.md."*

3.  **Documentación viva (Living Documentation)**:
    *   ⚠️ **Importante**: Si descubres que el diseño necesita modificaciones durante la implementación, **actualiza el SA/PRD inmediatamente**.
    *   Mantén las especificaciones y el código siempre sincronizados.

### Fase 4: Verificación y PR

1.  **Autocerevisión**:
    *   Ejecuta `npm test` para asegurar que las pruebas pasan.
    *   Marca los **Criterios de aceptación (Acceptance Criteria)** en `PRD_spec.md` punto por punto.

2.  **Abrir una Pull Request**:
    *   Utiliza la CLI `gh` para crear la PR (recomendado) o mediante la interfaz web.
    *   Si usas Antigravity, puedes usar el flujo de trabajo `/create-pr` directamente.
    *   Ejecuta el script de verificación:
        ```bash
        ./.agent/skills/pull-request/scripts/check-pr.sh
        ```
    *   Asegúrate de que la descripción de la PR sea completa e incluya el contexto bilingüe (la IA puede ayudar a traducir).
    *   **Informe**: Reporta los resultados de la verificación (Aprobado/Fallido) en la descripción de la PR.

## 📝 Guías de estilo

*   **Mensajes de commit**: Seguir los Conventional Commits (`feat`, `fix`, `docs`, `refactor`...).
*   **Idioma**: La documentación del proyecto y la comunicación pueden usar tu idioma nativo, pero los comentarios de código y las variables deben estar en inglés.
*   **Estilo de código**: Mantener la coherencia, consultar el estilo de código existente.

## 🤝 Buscar ayuda

*   Si te quedas atascado, por favor deja un comentario en el problema (issue).
*   No dudes en preguntar a la IA: "¿Qué significa este fragmento de código?" o "¿Cómo debo probar esta función?".

¡Esperamos tu contribución! Construyamos mejor software juntos con la IA.
