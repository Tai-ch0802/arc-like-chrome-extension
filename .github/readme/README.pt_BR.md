# Arc-Style Chrome Sidebar

Este é um projeto de extensão para o Chrome que visa trazer uma experiência de barra lateral vertical, similar à do navegador Arc, para o Google Chrome, fornecendo um painel unificado e poderoso para gerenciar abas e favoritos.

---

[![Version](https://img.shields.io/chrome-web-store/v/beoonblekmppafnjppedgpgfngghebji?style=flat-square&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Rating](https://img.shields.io/chrome-web-store/rating/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Users](https://img.shields.io/chrome-web-store/users/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Build Status](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Tai-ch0802/arc-like-chrome-extension?style=flat-square)](../../LICENSE)

## 🚀 New Release v1.11.0 update!
[![Demo Video](http://img.youtube.com/vi/Ld4lyaZatWo/0.jpg)](https://www.youtube.com/watch?v=Ld4lyaZatWo)

---

## 🔥 Principais Recursos

### 🔗 Inovação Exclusiva: Abas Vinculadas (Linked Tabs)
Este é o nosso recurso mais poderoso! Quando você abre um favorito a partir da barra lateral, criamos automaticamente um **"Vínculo"**.
- **Evite o Acúmulo de Abas**: Clique no ícone de vínculo ao lado de um favorito para ver todas as abas abertas a partir dele, ajudando a evitar a abertura de duplicatas e economizando recursos do sistema.
- **Sincronização Bidirecional**: Quando uma aba é fechada, o status do favorito é atualizado automaticamente; quando um favorito é excluído, a aba vinculada é tratada de forma inteligente.
- **Feedback Visual**: Um ícone de vínculo refinado aparece ao lado dos favoritos, permitindo que você saiba rapidamente quais estão ativos no momento.

### ⚡️ Renderização Inteligente
Tem milhares de favoritos? Sem problemas!
- **Renderização Dinâmica**: Mudamos do Virtual Scrolling para um mecanismo eficiente de Renderização Dinâmica, garantindo uma performance suave com melhor compatibilidade.
- **Experiência Fluida**: Navegue por grandes bibliotecas de favoritos sem esforço e sem lentidão.

### 🪟 Gerenciamento entre Janelas
- **Visão Geral das Janelas**: Visualize as abas de todas as janelas abertas do Chrome diretamente na barra lateral, não apenas da janela atual.
- **Busca Global**: Os resultados da busca incluem abas de todas as janelas, permitindo uma navegação instantânea em toda a sua sessão.

### 🔍 Busca de Nível Profissional
Não apenas busque — encontre instantaneamente.
- **Filtragem por Múltiplas Palavras-chave**: Suporta palavras-chave separadas por espaços (ex: "google docs trabalho") para uma segmentação precisa.
- **Busca por Domínio**: Digite um domínio (como `github.com`) para filtrar instantaneamente abas e favoritos de fontes específicas.
- **Destaque Inteligente**: O destaque em tempo real das palavras-chave correspondentes mantém seu foco visual claro.

### 🗂️ Workspace Unificado
- **Abas Verticais**: Veja os títulos completos das páginas, não mais comprimidos em ícones minúsculos.
- **Suporte Nativo a Grupos**: Integra-se perfeitamente com os Grupos de Abas do Chrome, sincronizando cores e nomes.
- **Nomenclatura de Janela Personalizada**: Atribua nomes personalizados às suas janelas (ex: "Trabalho", "Pessoal") para um contexto mais claro.
- **Arrastar e Soltar**: Gerenciamento intuitivo — mova itens sem esforço entre abas, grupos e pastas de favoritos.
- **Arrastar para Salvar**: Arraste uma aba para a área de favoritos para salvá-la instantaneamente; arraste um favorito para a área de abas para abri-lo.

### 🎨 Design Premium
- **Modo Foco**: Um tema escuro elegante com contraste cuidadosamente ajustado para reduzir o cansaço visual.
- **Expansão Automática**: Passe o cursor sobre as pastas enquanto arrasta itens para expandir o caminho automaticamente.
- **Hover Inteligente**: Botões de ação aparecem apenas quando necessário, mantendo a interface limpa e livre de distrações.

## ⌨️ Navegação Completa por Teclado
- **Experiência Nativa**: Use as teclas `Seta para Cima`/`Seta para Baixo` para navegar perfeitamente entre abas e favoritos.
- **Microinterações**: Use `Seta para Esquerda`/`Seta para Direita` para navegar e acionar botões internos (como Fechar, Adicionar ao Grupo).
- **Integração de Busca**: Pressione `Para Cima` no topo da lista para focar na barra de busca; pressione `Para Baixo` na barra de busca para pular para os resultados.
- **Dica de Foco**: Assim que a barra lateral for aberta, basta pressionar qualquer tecla de seta para obter o foco automaticamente e começar a navegar.

### ⌨️ Atalhos de Produtividade
- **Cmd/Ctrl + I**: Alternar Barra Lateral
- **Opt/Alt + T**: Criar nova aba ao lado da atual

---

## 🆚 Por que escolher esta extensão?

| Recurso | Esta Extensão | Chrome Nativo | Barras Laterais Tradicionais |
| :--- | :---: | :---: | :---: |
| **Abas Verticais** | ✅ Título Completo | ❌ Comprimido | ✅ |
| **Grupos de Abas** | ✅ Sincronização Nativa | ✅ | ⚠️ Parcial |
| **Integração de Favoritos** | ✅ Painel Unificado | ❌ Gerenciador Separado | ❌ Separado |
| **Abas Vinculadas** | ✅ Sincronização Perfeita | ❌ | ❌ |
| **Busca Multi-janela** | ✅ | ❌ | ⚠️ Varia |
| **Desempenho** | ⚡️ Renderização Dinâmica | N/A | 🐢 Rolagem Virtual |

---

## 🚀 Instalação e Desenvolvimento

### Opção 1: Instalar pela Chrome Web Store (Recomendado)

Você pode instalar a extensão diretamente da loja oficial para receber atualizações automáticas:

[**Clique aqui para instalar pela Chrome Web Store**](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji?utm_source=item-share-cb)

### Opção 2: Instalação Manual a partir do Código-Fonte (para Desenvolvedores)

**1. Pré-requisitos**

Antes de começar, certifique-se de ter o [Node.js](https://nodejs.org/) (que inclui o npm) instalado em seu sistema.

**2. Etapas de Configuração**

1.  Clone ou baixe este projeto em sua máquina local.
    ```bash
    git clone https://github.com/Tai-ch0802/arc-like-chrome-extension.git
    ```
2.  Navegue até o diretório do projeto e instale as dependências de desenvolvimento necessárias:
    ```bash
    cd arc-like-chrome-extension
    npm install
    ```
3.  Abra o navegador Chrome e vá para `chrome://extensions`.
4.  Ative o "Modo do desenvolvedor" no canto superior direito.
5.  Clique em "Carregar sem compactação" e selecione o diretório raiz do projeto.

---

## 🛠️ Comandos de Build

Este projeto usa um `Makefile` para automatizar o processo de build.

*   **Modo de Desenvolvimento**: `make` ou `make package`

    Este comando cria um build de desenvolvimento não minificado. Todo o código-fonte permanece como está, facilitando a depuração nas ferramentas de desenvolvedor do Chrome. O arquivo compactado será `arc-sidebar-v<version>-dev.zip`.

*   **Modo de Produção**: `make release`

    Este comando executa o processo de build para produção, que inclui as seguintes etapas:
    1.  Agrupa e minifica todos os módulos JavaScript em um único arquivo usando o `esbuild`.
    2.  Minifica o arquivo CSS.
    3.  Compacta a saída em um arquivo `.zip` adequado para upload na Chrome Web Store.

---

## 🧪 Testes

Para garantir a qualidade e a estabilidade dos recursos do projeto, adotamos uma abordagem de testes de caso de uso para validar cada alteração.

### Testes de Caso de Uso

*   **Objetivo**: Cada teste de caso de uso define claramente o comportamento esperado e o fluxo operacional de um recurso específico. Eles são apresentados em texto descritivo, detalhando as etapas do teste, pré-condições, resultados esperados e métodos de verificação.
*   **Localização**: Todos os arquivos de teste de caso de uso são armazenados na pasta `usecase_tests/` na raiz do projeto.
*   **Execução e Verificação**: Esses testes são executados atualmente de forma manual. Os desenvolvedores precisam simular as operações do usuário na extensão do Chrome em execução, de acordo com as etapas nos arquivos de teste, e observar se os resultados atendem às expectativas.

### Framework de Testes Automatizados

Para futuros testes automatizados, escolhemos o **Puppeteer** como nosso framework de testes End-to-End (E2E).

*   **Puppeteer**: Uma biblioteca Node.js que fornece uma API de alto nível para controlar o Chromium ou o Chrome através do DevTools Protocol. Ele nos permite escrever scripts para simular várias ações do usuário no navegador, como cliques, entrada, navegação, etc., e capturar capturas de tela ou recuperar o conteúdo da página para verificação.
*   **Instalação**: O Puppeteer foi instalado no projeto via `npm install puppeteer`.
*   **Perspectivas Futuras**: No futuro, os casos de teste descritivos em `usecase_tests/` serão gradualmente convertidos em scripts executáveis do Puppeteer para alcançar testes automatizados e integração contínua.

---

## 👥 Contribuidores

Agradecimentos especiais a todos os contribuidores que ajudam a tornar este projeto melhor:

<a href="https://github.com/Tai-ch0802/arc-like-chrome-extension/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Tai-ch0802/arc-like-chrome-extension" />
</a>

---

## 🔒 Privacidade e FAQ

Valorizamos a sua privacidade. Esta extensão funciona inteiramente localmente e não recolhe nem transmite os seus dados pessoais.

Para mais detalhes, consulte a nossa [Política de Privacidade](../../PRIVACY_POLICY.md).

---

Este projeto está licenciado sob a Licença MIT.
