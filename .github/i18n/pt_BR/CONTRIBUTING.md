# Guia de Contribuição

🎉 Antes de mais nada, obrigado por dedicar seu tempo para contribuir!

Dedicamo-nos a construir uma comunidade de código aberto de **baixa barreira** e **amigável à IA**. Recomendamos fortemente o uso de ferramentas de IA (especialmente o **Antigravity IDE**) para auxiliar no desenvolvimento. Mesmo que você seja um novato em programação ou não esteja familiarizado com esta área, desde que tenha uma ideia, você é bem-vindo para contribuir através de nosso processo padronizado.

Este documento o guiará sobre como transformar um "desejo vago" em uma "funcionalidade utilizable".

## 🚀 Filosofia Central

1.  **Desenvolvimento Nativo de IA (AI-Native)**: Nós abraçamos a IA. Não tenha medo de deixar a IA ajudá-lo a escrever código, documentação ou explicar a arquitetura.
2.  **Desenvolvimento Orientado por Especificações (SDD)**: Pense antes de agir. Especificações primeiro, código depois. (`No Spec, No Code`)
3.  **Baixa Fricção**: Uso de ferramentas automatizadas e SOPs claros para diminuir a barreira para contribuição.

## 🛠 Ferramentas

*   **IDE**: Altamente recomendado o uso do **Antigravity IDE** (editor aprimorado por IA).
*   **Controle de Versão**: Git e GitHub CLI (`gh`).
*   **Runtime**: Node.js e npm.

## 🛤 SOP do Desenvolvedor: Da Ideia à Implementação

Adotamos um processo padronizado de **Desenvolvimento Orientado por Especificações (SDD)** para ajudá-lo a concluir o desenvolvimento passo a passo.

### Fase 1: Ideia e Problema (Idea & Issue)

Tudo começa com uma ideia.

1.  **Verificar Problemas Existentes**: Veja se alguém já propôs uma ideia semelhante.
2.  **Criar Problema (Issue)**:
    *   Para novos recursos, use o modelo **Feature Request**.
    *   Para correções de bugs, use o modelo **Bug Report**.
    *   *Dica: Mesmo que a ideia seja vaga, não há problema em abrir uma Issue para discussão.*

### Fase 2: Análise e Especificação (Analysis & Spec)

Uma vez que a Issue é confirmada, entramos no processo SDD. Este é o melhor momento para adquirir conhecimento de domínio (Domain Knowledge).

1.  **Iniciar Fluxo de Trabalho SDD**:
    Na raiz do projeto, você pode pedir ao Agente de IA:
    > "Quero começar a desenvolver a Issue #123, por favor execute /sdd-process para mim"
    *   A IA criará o diretório padrão: `/docs/specs/{type}/ISSUE-123_{desc}/`.

2.  **Elaborar PRD (Product Requirement Document)**:
    *   A IA o ajudará a criar o `/docs/specs/.../PRD_spec.md`.
    *   Você precisa definir: **O que fazer (User Stories)** e **Critérios de Aceitação (Acceptance Criteria)**.
    *   *Dica: Use a IA para ajudá-lo a refinar User Stories e casos de borda.*

3.  **Elaborar SA (System Analysis)**:
    *   Após o PRD ser aprovado, a IA ajuda a criar o `/docs/specs/.../SA_spec.md`.
    *   Você precisa definir: **Arquitetura Técnica**, **APIs**, **Fluxo de Dados**.
    *   **Rastreabilidade**: Garanta que cada decisão de design mapeie de volta aos requisitos do PRD.

### Fase 3: Implementação

Assim que as especificações forem finalizadas, é hora de codificar com alegria.

1.  **Verificação Pré-Código (Pre-Code Check)**:
    *   Confirme se ambos os status PRD e SA são **Approved**.

2.  **Deixe a IA Escrever o Código**:
    *   Forneça o `PRD_spec.md` e o `SA_spec.md` ao Antigravity/IA.
    *   Exemplo de prompt: *"Por favor, implemente o recurso de renderização de outras janelas de acordo com a Task 1 no SA_spec.md."*

3.  **Documentação Viva (Living Documentation)**:
    *   ⚠️ **Importante**: Se você achar que o design precisa de modificação durante a implementação, **atualize o SA/PRD imediatamente**.
    *   Mantenha as especificações e o código sempre sincronizados.

### Fase 4: Verificação e PR

1.  **Autoavaliação**:
    *   Execute `npm test` para garantir que os testes passem.
    *   Verifique os **Critérios de Aceitação (Acceptance Criteria)** no `PRD_spec.md` item por item.

2.  **Abrir Pull Request**:
    *   Use a CLI `gh` para criar o PR (Recomendado) ou via interface web.
    *   Se estiver usando o Antigravity, você pode usar o fluxo de trabalho `/create-pr` diretamente.
    *   Execute o script de verificação:
        ```bash
        ./.agent/skills/pull-request/scripts/check-pr.sh
        ```
    *   Certifique-se de que a descrição do PR esteja completa e inclua o contexto bilíngue (a IA pode ajudar a traduzir).
    *   **Relatório**: Relate os resultados da verificação (Pass/Fail) na Descrição do PR.

## 📝 Guias de Estilo

*   **Mensagens de Commit**: Siga os Conventional Commits (`feat`, `fix`, `docs`, `refactor`...).
    *   Você pode usar a skill `commit-message-helper` neste projeto.
*   **Idioma**: A documentação do projeto e a comunicação podem usar seu idioma nativo, mas os comentários de código e variáveis devem usar o inglês.
*   **Estilo de Código**: Mantenha a consistência, consulte o estilo de código existente.

## 🤝 Buscando Ajuda

*   Se você ficar preso, deixe um comentário na Issue.
*   Não hesite em perguntar à IA: "O que este trecho de código significa?" ou "Como devo testar este recurso?".

Aguardamos sua contribuição! Vamos construir softwares melhores juntos com a IA.
