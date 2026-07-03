# Barra lateral do Chrome ao estilo Arc · Seu espaço de trabalho de conhecimento para Chrome

[English](/.github/i18n/en/README.md) | [繁體中文](/.github/i18n/zh_TW/README.md) | [简体中文](/.github/i18n/zh_CN/README.md) | [日本語](/.github/i18n/ja/README.md) | [한국어](/.github/i18n/ko/README.md) | [Deutsch](/.github/i18n/de/README.md) | [Español](/.github/i18n/es/README.md) | [Français](/.github/i18n/fr/README.md) | [हिन्दी](/.github/i18n/hi/README.md) | [Bahasa Indonesia](/.github/i18n/id/README.md) | [Português (Brasil)](/.github/i18n/pt_BR/README.md) | [Русский](/.github/i18n/ru/README.md) | [ไทย](/.github/i18n/th/README.md) | [Tiếng Việt](/.github/i18n/vi/README.md)


🌐 **Site Oficial**: [https://sidebar-for-tabs-bookmarks.taislife.work/](https://sidebar-for-tabs-bookmarks.taislife.work/)

---

[![Version](https://img.shields.io/chrome-web-store/v/beoonblekmppafnjppedgpgfngghebji?style=flat-square&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Rating](https://img.shields.io/chrome-web-store/rating/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Users](https://img.shields.io/chrome-web-store/users/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Build Status](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Tai-ch0802/arc-like-chrome-extension?style=flat-square)](../../LICENSE)

Uma barra lateral ao estilo Arc que vai muito além das abas verticais nativas do Chrome: abas + favoritos + lista de leitura unificadas, **IA local por padrão** (nomeação automática de grupos, sugestões de limpeza de abas, resumos ao passar o mouse, busca em linguagem natural — Gemini Nano integrado, ou traga sua própria chave de API para Gemini API / Claude / compatível com OpenAI / Ollama), **Workspaces** (hibernar e restaurar conjuntos de abas, metadados sincronizados entre dispositivos), uma **paleta de comandos ⌘K**, e **ferramentas para favoritos** (tags, dedupe, links quebrados) — no dispositivo por padrão, sem necessidade de chave de API.

## 🚀 Nova atualização v1.14.0! 
[![Vídeo de Demonstração](http://img.youtube.com/vi/aRSQ1atlyCw/0.jpg)](https://www.youtube.com/watch?v=aRSQ1atlyCw)

### ⚡️ Funcionalidades
- **Imagem de Fundo Personalizada**: Defina seu próprio fundo via upload ou URL, com ajuste de opacidade e desfoque.
- **Interface de Configurações Renovada**: Uma experiência mais limpa com um novo layout de acordeão colapsável.
- **Cores de Tema Personalizadas**: Controle total sobre o fundo principal, cor de destaque e cores de texto.
- **Abas Verticais**: Veja títulos completos de páginas, sem serem comprimidos em ícones minúsculos.
- **Grupos de Abas**: Integra-se perfeitamente aos Grupos de Abas do Chrome, sincronizando cores e nomes.
- **Integração de Favoritos**: Painel unificado para gerenciar abas e favoritos.
- **Abas Vinculadas**: Cria automaticamente um "Vínculo" ao abrir um favorito, evitando duplicatas.
- **Gerenciamento entre Janelas**: Gerencie abas de todas as janelas abertas com busca global.
- **Renderização Dinâmica**: Lida de forma eficiente com milhares de favoritos com desempenho fluido.
- **Atalhos de Acessibilidade**: Ações rápidas com `F2` para renomear e `Delete` para remover itens.

## 🤝 Contribuindo

Agradecemos as contribuições da comunidade! Se você estiver corrigindo um bug, melhorando a documentação ou propondo um novo recurso, sua ajuda é bem-vinda.

Utilizamos um fluxo de trabalho de **Desenvolvimento Orientado por Especificações (SDD)** e somos **amigáveis à IA**. Confira nosso guia de contribuição para começar:

👉 **[Leia nossas diretrizes de contribuição](./CONTRIBUTING.md)**

Para um exemplo prático do processo de desenvolvimento, consulte a [Issue #30](https://github.com/Tai-ch0802/arc-like-chrome-extension/issues/30).

---

## 🔥 Principais Recursos

### 🔗 Inovação Exclusiva: Abas Vinculadas (Linked Tabs)
Este é o nosso recurso mais poderoso! Quando você abre um favorito na barra lateral, criamos automaticamente um **"Link"**.
- **Evite a confusão de abas**: Clique no ícone de link ao lado de um favorito para ver todas as abas abertas a partir dele, ajudando a evitar duplicatas e economizando recursos do sistema.
- **Sincronização bidirecional**: Quando uma aba é fechada, o status do favorito é atualizado automaticamente; quando um favorito é excluído, a aba vinculada é tratada de forma inteligente.
- **Feedback visual**: Um ícone de link refinado aparece ao lado dos favoritos, permitindo que você saiba rapidamente quais estão ativos no momento.

### ⚡️ Renderização Inteligente
Tem milhares de favoritos? Sem problemas!
- **Renderização dinâmica**: Mudamos da rolagem virtual para um mecanismo eficiente de renderização dinâmica, garantindo desempenho suave com melhor compatibilidade.
- **Experiência fluida**: Navegue por grandes bibliotecas de favoritos sem esforço e sem lentidão.

### 🪟 Gerenciamento entre Janelas
- **Visão Geral das Janelas**: Visualize abas de todas as janelas abertas do Chrome diretamente na barra lateral, não apenas da janela atual.
- **Busca Global**: Os resultados da pesquisa incluem abas de todas as janelas, permitindo navegação instantânea em toda a sua sessão.

### 🔍 Busca de Nível Profissional
Não apenas pesquise — encontre instantaneamente.
- **Filtragem por múltiplas palavras-chave**: Suporte a palavras-chave separadas por espaços (ex: "google docs trabalho") para segmentação precisa.
- **Busca por domínio**: Digite um domínio (como `github.com`) para filtrar instantaneamente abas e favoritos de fontes específicas.
- **Destaque inteligente**: O destaque em tempo real das palavras-chave correspondentes mantém seu foco visual claro.

### 🗂️ Espaço de Trabalho Unificado
- **Abas verticais**: Veja os títulos completos das páginas, sem compressão.
- **Suporte a grupos nativos**: Integra-se perfeitamente aos grupos de abas do Chrome.
- **Nomenclatura personalizada de janelas**: Atribua nomes personalizados às suas janelas (ex: "Trabalho", "Pessoal") para um contexto mais claro.
- **Arrastar e Soltar**: Gerenciamento intuitivo — mova itens facilmente entre abas, grupos e pastas de favoritos.
- **Arrastar para Salvar**: Arraste uma aba para a área de favoritos para salvá-la instantaneamente; arraste um favorito para a área de abas para abri-lo.

### 🎨 Design Premium
- **Modo Foco**: Um tema escuro elegante com contraste cuidadosamente ajustado para reduzir a fadiga ocular.
- **Expansão automática**: Passe o mouse sobre as pastas enquanto arrasta itens para expandir automaticamente o caminho.
- **Hover inteligente**: Os botões de ação aparecem apenas quando necessário, mantendo a interface limpa e livre de distrações.

### 📚 Lista de Leitura & RSS
Seu hub pessoal de curadoria de artigos, diretamente na barra lateral.
- **Integração com a Lista de Leitura do Chrome**: Sincronizado com a lista de leitura nativa do Chrome para a funcionalidade "Ler Depois".
- **Assinatura RSS**: Assine qualquer feed RSS; novos artigos são adicionados automaticamente à sua lista de leitura.
- **Deduplicação Inteligente**: A filtragem baseada em hash garante que não haja entradas duplicadas.
- **Opções de Ordenação**: Ordene por data (mais recente/mais antiga) ou título para acesso rápido.
- **Busca Manual**: Obtenha os artigos mais recentes instantaneamente com o botão "Buscar Agora".
- **Limpeza em Lote**: Remova todos os itens lidos com um clique.

## ⌨️ Navegação Completa por Teclado
- **Experiência nativa**: Use as teclas `Seta para Cima`/`Seta para Baixo` para navegar perfeitamente entre abas e favoritos.
- **Microinterações**: Use `Seta para Esquerda`/`Seta para Direita` para navegar e acionar botões internos (como Fechar, Adicionar ao Grupo).
- **Integração com a Busca**: Pressione `Cima` no topo da lista para focar na barra de busca; pressione `Baixo` na barra de busca para pular para os resultados.
- **Dica de foco**: Assim que a barra lateral for aberta, basta pressionar qualquer tecla de seta para obter o foco automaticamente e começar a navegar.

### ⌨️ Atalhos de Produtividade
- **Cmd/Ctrl + I**: Alternar barra lateral
- **Opt/Alt + T**: Criar nova aba ao lado da atual

---

## 🆚 Por que escolher esta extensão?

| Recurso | Esta Extensão | Chrome Nativo | Barras Laterais Tradicionais |
| :--- | :---: | :---: | :---: |
| **Abas verticais** | ✅ Título Completo | ❌ Comprimido | ✅ |
| **Grupos de abas** | ✅ Sincronização Nativa | ✅ | ⚠️ Parcial |
| **Integração de favoritos** | ✅ Painel Unificado | ❌ Gerenciador Separado | ❌ Separado |
| **Abas vinculadas** | ✅ Sincronizado | ❌ | ❌ |
| **Lista de Leitura & RSS** | ✅ Integrado | ⚠️ Básico | ❌ |
| **Busca entre janelas** | ✅ | ❌ | ⚠️ Varia |
| **Desempenho** | ⚡️ Renderização Dinâmica | N/A | 🐢 Rolagem Virtual |

---

## 🚀 Instalação e Desenvolvimento

### Opção 1: Instalar pela Chrome Web Store (Recomendado)

Você pode instalar a extensão diretamente da loja oficial para receber atualizações automáticas:

[**Clique aqui para instalar pela Chrome Web Store**](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji?utm_source=item-share-cb)

### Opção 2: Instalação manual a partir do código-fonte (para desenvolvedores)

**1. Pré-requisitos**

Antes de começar, certifique-se de ter o [Node.js](https://nodejs.org/) (que inclui o npm) instalado em seu sistema.

**2. Etapas de configuração**

1.  Clone ou baixe este projeto para sua máquina local.
    ```bash
    git clone https://github.com/Tai-ch0802/arc-like-chrome-extension.git
    ```
2.  Navegue até o diretório do projeto e instale as dependências de desenvolvimento necessárias:
    ```bash
    cd arc-like-chrome-extension
    npm install
    ```
3.  Abra o navegador Chrome e navega para `chrome://extensions`.
4.  Ative o "Modo do desenvolvedor" no canto superior direito.
5.  Clique em "Carregar sem compactação" e selecione o diretório raiz do projeto.

---

## 🛠️ Comandos de Build

Este projeto usa um `Makefile` para automatizar o processo de build.

*   **Modo de Desenvolvimento**: `make` ou `make package`

    Este comando cria um build de desenvolvimento não minificado. Todo o código-fonte permanece como está, facilitando a depuração nas ferramentas de desenvolvedor do Chrome. O arquivo empacotado será `arc-sidebar-v<versão>-dev.zip`.

*   **Modo de Produção**: `make release`

    Este comando executa o processo de build de produção, que inclui as seguintes etapas:
    1.  Empacota e minifica todos os módulos JavaScript em um único arquivo usando o `esbuild`.
    2.  Minifica o arquivo CSS.
    3.  Empacota a saída em um arquivo `.zip` adequado para upload na Chrome Web Store.

---

## 🧪 Testes

Para garantir a qualidade e estabilidade dos recursos do projeto, adotamos uma abordagem de teste de caso de uso para validar cada alteração.

### Testes de Caso de Uso

*   **Objetivo**: Cada teste de caso de uso define claramente o comportamento esperado e o fluxo operacional de um recurso específico. Eles são apresentados em texto descritivo, detalhando as etapas do teste, pré-condições, resultados esperados e métodos de verificação.
*   **Localização**: Todos os arquivos de teste de caso de uso estão armazenados na pasta `usecase_tests/` na raiz do projeto.
*   **Execução e Verificação**: Atualmente, esses testes são executados principalmente de forma manual. Os desenvolvedores precisam simular as operações do usuário na extensão do Chrome em execução, de acordo com as etapas nos arquivos de teste, e observar se os resultados atendem às expectativas.

### Teste Automatizado

Para testes automatizados futuros, escolhemos o **Puppeteer** como nossa estrutura de teste End-to-End (E2E). Isso nos permite escrever scripts para simular várias ações do usuário no navegador e verificar a funcionalidade.

---

## 🔒 Privacidade e FAQ

Valorizamos sua privacidade. Esta extensão opera localmente por padrão e não coleta seus dados pessoais. Se você optar por um provedor de IA na nuvem com sua própria chave de API, as solicitações de IA vão diretamente do seu navegador apenas para esse provedor.

Para mais detalhes, consulte nossa [Política de Privacidade](../../PRIVACY_POLICY.md).

---

## 👥 Contribuidores

Agradecimentos especiais a todos os contribuidores que ajudam a tornar este projeto melhor:

<a href="https://github.com/Tai-ch0802/arc-like-chrome-extension/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Tai-ch0802/arc-like-chrome-extension" />
</a>

## 📜 Licença

Este projeto é licenciado sob a Licença MIT - consulte o arquivo [LICENSE](../../LICENSE) para obter detalhes.
