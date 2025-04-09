var nodeConsole = require('console');
var myConsole = new nodeConsole.Console(process.stdout, process.stderr);
document.addEventListener('DOMContentLoaded', () => {
  const { contextBridge, ipcRenderer } = require('electron');
  const mainContent = document.getElementById('main-content');
  const { buscarPrecoProdutoPorCodigoBarras } = require('./API/escrita.js');
  const { formatarData } = require('./API/gerador_PDF.js')
  contextBridge.exposeInMainWorld('ipcRenderer', {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  });

  let sessaoId = null;
  const rendersessao = () => {
    ipcRenderer.invoke('get-sessao-data').then(async (sessao) => {
      mainContent.innerHTML = '';
      fetch('sessao.html')
        .then((response) => response.text())
        .then(async (html) => {
          mainContent.innerHTML = html;
          sessaoId = await ipcRenderer.invoke('get-sessao-id');
          console.log('Sessão:', sessaoId);

          const nomeInput = document.createElement('input');
          nomeInput.type = 'text';
          nomeInput.placeholder = 'Nome da sessão';
          nomeInput.className = 'mt-4 p-2 border rounded';

          const iniciarSessaoContainer = document.createElement('div');
          iniciarSessaoContainer.className = 'mt-4';
          iniciarSessaoContainer.appendChild(nomeInput);

          const iniciarSessaoButton = document.createElement('button');
          iniciarSessaoButton.textContent = 'Iniciar Sessão';
          iniciarSessaoButton.className = 'ml-2 p-2 bg-green-600 text-white rounded hover:bg-green-700';
          iniciarSessaoContainer.appendChild(iniciarSessaoButton);

          mainContent.prepend(iniciarSessaoContainer);

          if (sessaoId) {
            iniciarSessaoButton.textContent = 'Encerrar Sessão';
            iniciarSessaoButton.className = 'ml-2 p-2 bg-red-600 text-white rounded hover:bg-red-700';
          }

          iniciarSessaoButton.addEventListener('click', async () => {
            const nome = nomeInput.value.trim();
            if (sessaoId) {
              const response = await ipcRenderer.invoke('encerrar-sessao', sessaoId);
              sessaoId = await ipcRenderer.invoke('clear-sessao-id');

              iniciarSessaoButton.textContent = 'Iniciar Sessão';
              iniciarSessaoButton.className = 'ml-2 p-2 bg-green-600 text-white rounded hover:bg-green-700';
            } else if (nome) {
              const novaSessaoId = await ipcRenderer.invoke('iniciar-sessao', nome);
              sessaoId = await ipcRenderer.invoke('set-sessao-id', novaSessaoId);

              if (novaSessaoId) {

                iniciarSessaoButton.textContent = 'Encerrar Sessão';
                iniciarSessaoButton.className = 'ml-2 p-2 bg-red-600 text-white rounded hover:bg-red-700';
                nomeInput.value = '';
                rendersessao(); // Atualiza a página para refletir o novo estado
              }
            } else {

            }
          });

          const tabelaBody = document.getElementById('sessao-body');
          if (tabelaBody) {
            tabelaBody.innerHTML = sessao
              .map(
                (sessao) => `
                              <tr class="hover:bg-gray-100 transition duration-150 ease-in-out" data-sessao-id="${sessao.id}">
                                  <td class="border border-gray-200 px-4 py-3 text-center text-gray-800 font-medium">${sessao.nome}</td>
                                  <td class="border border-gray-200 px-4 py-3 text-center text-gray-800 font-medium">${sessao.dia}</td>
                                  <td class="border border-gray-200 px-4 py-3 text-center text-gray-800 font-medium">${sessao.hora_inicial}</td>
                              </tr>
                          `
              )
              .join('');
            const linhas = tabelaBody.querySelectorAll('tr');
            linhas.forEach((linha) => {
              linha.addEventListener('click', () => {
                const sessaoId = linha.getAttribute('data-sessao-id');
                renderDetalhesSessao(sessaoId); // Chama a função para renderizar os detalhes da sessão
              });
            });
          } else {
            console.error('Elemento "sessao-body" não encontrado.');
          }
        })
        .catch((err) => {
          console.error('Erro ao carregar o template do sessao:', err);
          mainContent.innerHTML = `<p class="text-red-500">Erro ao carregar o template: ${err.message}</p>`;
        });
    });
  };

  const sessaoButton = document.getElementById('sessao');
  if (sessaoButton) {
    sessaoButton.addEventListener('click', rendersessao);
  } else {
    console.error('Botão de estoque não encontrado!');
  }
  async function renderDetalhesSessao(sessaoId) {
    try {
      console.log("Sessão ID recebido:", sessaoId);

      const response = await ipcRenderer.invoke('get-sessao-detalhes', sessaoId);
      console.log("Resposta da IPC:", response);

      if (!response || typeof response !== 'object') {
        throw new Error("Dados da sessão não encontrados.");
      }

      // Ajustando para refletir a estrutura correta da resposta
      const { sessao_data: sessao, sessao_vendas: sessao_vendas, sessao_entradas: sessao_entradas, sessao_saques: sessao_saques } = response;

      if (!sessao) {
        throw new Error("Sessão não encontrada.");
      }

      console.log("Sessão:", sessao);

      mainContent.innerHTML = '';

      fetch('sessaoview.html')
        .then((response) => response.text())
        .then((html) => {
          mainContent.innerHTML = html;

          const nomeSessao = document.getElementById('nome-sessao');
          const diaSessao = document.getElementById('dia-sessao');
          const horaInicial = document.getElementById('hora-inicial');
          const horaFinal = document.getElementById('hora-final');
          const valorInicial = document.getElementById('valor-inicial');
          const valorFinal = document.getElementById('valor-final');
          const valorTotal = document.getElementById('valor-total');

          if (nomeSessao && diaSessao && horaInicial && horaFinal && valorInicial) {
            nomeSessao.textContent = sessao.nome || 'Não informado';
            diaSessao.textContent = sessao.dia || 'Não informado';
            horaInicial.textContent = sessao.hora_inicial || 'Não informado';
            horaFinal.textContent = sessao.hora_final ? sessao.hora_final : 'Sessão em andamento';
            valorInicial.textContent = sessao.valor_inicial != null ? `R$ ${sessao.valor_inicial.toFixed(2)}` : 'Não informado';
            valorFinal.textContent = sessao.valor_final != null ? `R$ ${sessao.valor_final.toFixed(2)}` : 'Sessão em andamento';
            valorTotal.textContent = sessao.total != null ? `R$ ${sessao.total.toFixed(2)}` : 'Sessão em andamento';
          } else {
            console.error('Elementos de detalhes da sessão não encontrados.');
          }

          const vendasContainer = document.getElementById('sessao-vendas');
          const entradasContainer = document.getElementById('sessao-entradas');
          const saquesContainer = document.getElementById('sessao-saques');

          // Exibir vendas
          if (vendasContainer) {
            vendasContainer.innerHTML = sessao_vendas.length > 0 ? sessao_vendas.map(venda => `
                        <tr>
                            <td>${venda.nome || 'Não informado'}</td>
                            <td>${venda.quantidade_vendida}</td>
                            <td>R$ ${venda.valor_venda.toFixed(2)}</td>
                        </tr>
                    `).join('') : '<tr><td colspan="5">Nenhuma venda registrada</td></tr>';
          }

          // Exibir entradas
          if (entradasContainer) {
            entradasContainer.innerHTML = sessao_entradas.length > 0 ? sessao_entradas.map(entrada => `
                        <tr>
                            <td>${entrada.nome || 'Não informado'}</td>
                            <td>${entrada.quantidade_entrada}</td>
                            <td>R$ ${entrada.preco_unitario_de_venda.toFixed(2)}</td>
                            <td>R$ ${entrada.valor_total_pago.toFixed(2)}</td>
                        </tr>
                    `).join('') : '<tr><td colspan="7">Nenhuma entrada registrada</td></tr>';
          }

          // Exibir saques
          if (saquesContainer) {
            saquesContainer.innerHTML = sessao_saques.length > 0 ? sessao_saques.map(saque => `
                        <tr>
                            <td>${saque.descricao || 'Sem descrição'}</td>
                            <td>R$ ${saque.valor.toFixed(2)}</td>
                        </tr>
                    `).join('') : '<tr><td colspan="4">Nenhum saque registrado</td></tr>';
          }

          console.log("Sessão Vendas:", sessao_vendas);
          console.log("Sessão Entradas:", sessao_entradas);
          console.log("Sessão Saques:", sessao_saques);

        })
        .catch((err) => {
          console.error('Erro ao carregar o template de detalhes da sessão:', err);
          mainContent.innerHTML = `<p class="text-red-500">Erro ao carregar o template: ${err.message}</p>`;
        });
    } catch (error) {
      console.error('Erro ao buscar detalhes da sessão:', error);
      mainContent.innerHTML = `<p class="text-red-500">Erro ao buscar detalhes da sessão: ${error.message}</p>`;
    }
  }

  const renderEstoque = () => {
    ipcRenderer.invoke('get-produtos-data').then((produtos) => {
      mainContent.innerHTML = '';

      if (produtos.error) {
        mainContent.innerHTML = `<p class="text-red-500">Erro: ${produtos.message}</p>`;
        return;
      }

      if (produtos.length > 0) {
        fetch('estoque.html')
          .then((response) => response.text())
          .then((html) => {
            mainContent.innerHTML = html;

            const tabelaBody = document.getElementById('produtos-body');
            const searchInput = document.getElementById('search-input');

            if (tabelaBody) {
              const renderTabela = (filtros = '') => {
                const produtosFiltrados = produtos.filter((produto) =>
                  produto.nome.toLowerCase().includes(filtros.toLowerCase())
                );

                tabelaBody.innerHTML = produtosFiltrados
                  .map(
                    (produto) => `
                    <tr class="hover:bg-gray-100 transition duration-150 ease-in-out">
                      <td class="border border-gray-200 px-4 py-3 text-center text-gray-800 font-medium">${produto.codigo_de_barras}</td>
                      <td class="border border-gray-200 px-4 py-3 text-gray-800">${produto.nome}</td>
                      <td class="border border-gray-200 px-4 py-3 text-center text-gray-800">${produto.quantidade_em_estoque}</td>
                      <td class="border border-gray-200 px-4 py-3 text-center text-gray-800 capitalize">${produto.tipo_de_lanche}</td>
                      <td class="border border-gray-200 px-4 py-3 text-center font-semibold text-green-600">${produto.preco_unitario_de_venda} R$</td>
                    </tr>
                  `
                  )
                  .join('');
              };
              renderTabela();
              if (searchInput) {
                searchInput.addEventListener('input', (event) => {
                  renderTabela(event.target.value);
                });
              }
              const BotaoBaixarEstoque = document.getElementById('download-pdf');
              if (BotaoBaixarEstoque) {
                BotaoBaixarEstoque.addEventListener('click', async () => {
                  try {
                    const response = await ipcRenderer.invoke('gerar_pdf_estoque', produtos);
                    const feedback = document.getElementById("feedback");
                    feedback.textContent = "PDF baixado com sucesso na pasta download!";
                    feedback.className = "mt-6 text-center text-sm text-green-600";
                    if (response.success) {

                    } else {
                      console.error('Erro ao baixar PDF:', response.message);
                    }
                  } catch (error) {
                    console.error('Erro ao baixar PDF:', error);
                  }
                });
              } else {
                console.error('Botão de download PDF não encontrado!');
              }
            } else {
              console.error('Elemento "produtos-body" não encontrado.');
            }
          })
          .catch((err) => {
            console.error('Erro ao carregar o template do estoque:', err);
            mainContent.innerHTML = `<p class="text-red-500">Erro ao carregar o template: ${err.message}</p>`;
          });
      } else {
        mainContent.innerHTML = '<p>Estoque vazio</p>';
      }
    }).catch((error) => {
      console.error('Erro ao carregar produtos:', error);
      mainContent.innerHTML = `<p class="text-red-500">Erro ao carregar produtos: ${error.message}</p>`;
    });
  };

  const estoqueButton = document.getElementById('estoque-btn');
  if (estoqueButton) {
    estoqueButton.addEventListener('click', renderEstoque);
  } else {
    console.error('Botão de estoque não encontrado!');
  }

  const render_caixa_periodo = (caixadata) => {
    myConsole.log(caixadata)
    const BotaoBaixarSaques = document.getElementById('download-pdf');
    myConsole.log(BotaoBaixarSaques)
    if (BotaoBaixarSaques) {
      BotaoBaixarSaques.addEventListener('click', async () => {
        try {
          const response = await ipcRenderer.invoke('gerar_pdf_caixa', caixadata);
          const feedback = document.getElementById("feedback");
          feedback.textContent = "PDF baixado com sucesso na pasta download!";
          feedback.className = "mt-6 text-center text-sm text-green-600";
          if (response.success) {

          } else {
            console.error('Erro ao baixar PDF:', response.message);
          }
        } catch (error) {
          console.error('Erro ao baixar PDF:', error);
        }
      });
    } else {
      console.error('Botão de download PDF não encontrado!');
    }
  };

  const render_caixa = () => {
    ipcRenderer.invoke('total_no_caixa').then((total_no_caixa) => {
      mainContent.innerHTML = '';
      fetch('caixa.html')
        .then((response) => response.text())
        .then((html) => {
          mainContent.innerHTML = html;
          const total_caixa = document.getElementById('total-caixa');
          if (total_caixa) {
            total_caixa.innerHTML = total_no_caixa
          }
          const form = document.getElementById('retirada-form');

          if (form) {
            form.addEventListener('submit', async (event) => {
              event.preventDefault();
              const formData = new FormData(form);
              const data = Object.fromEntries(formData.entries());
              data.entrada = false;
              console.log(data)
              try {
                sessaoatual = await ipcRenderer.invoke("get-sessao-id");
                const response = await ipcRenderer.invoke('atualizar_caixa', data, sessaoatual);
                if (response.success) {
                  form.reset();
                  render_caixa();
                }
              } catch (error) {
                console.error('Erro ao enviar os dados:', error);
              }
            });
          } else {
            console.error('Formulário não encontrado.');
          }
          const filtroContainer = document.createElement('div');
          filtroContainer.className = 'mb-6';
          filtroContainer.innerHTML = `
              <form id="filtro-entrada-form" class="space-y-6">
                  <div class="flex flex-wrap space-x-4 items-end">
                      <div class="w-full sm:w-auto mb-4 sm:mb-0">
                          <label for="data-inicio" class="text-xl block font-medium text-gray-700">Data Início</label>
                          <input type="date" id="data-inicio" name="dataInicio"
                              class="mt-2 block p-3 w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm">
                      </div>
                      <div class="w-full sm:w-auto mb-4 sm:mb-0">
                          <label for="data-fim" class="text-xl block font-medium text-gray-700">Data Fim</label>
                          <input type="date" id="data-fim" name="dataFim"
                              class="mt-2 block p-3 w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm">
                      </div>
                      <div class="w-full sm:w-auto">
                          <button id="entrada-periodo-btn" type="submit"
                              class="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition w-full sm:w-auto">
                              Consultar
                          </button>
                      </div>
                  </div>
              </form>
            `;
          mainContent.prepend(filtroContainer);

          const form_data = document.getElementById('filtro-entrada-form');
          form_data.addEventListener('submit', async (event) => {
            event.preventDefault();

            const formData = new FormData(form_data);
            const data = Object.fromEntries(formData.entries());

            try {
              const response = await ipcRenderer.invoke('get-saques-periodo', data);

              render_caixa_periodo(response);

            } catch (error) {
              console.error('Erro ao buscar saques por período:', error);
            }
          });


          ipcRenderer.invoke('get-saques-data').then((saques) => {
            const BotaoBaixarCaixa = document.getElementById('download-pdf');
            myConsole.log(BotaoBaixarCaixa)
            if (BotaoBaixarCaixa) {
              BotaoBaixarCaixa.addEventListener('click', async () => {
                try {
                  const response = await ipcRenderer.invoke('gerar_pdf_caixa', saques);
                  const feedback = document.getElementById("feedback");
                  feedback.textContent = "PDF baixado com sucesso na pasta download!";
                  feedback.className = "mt-6 text-center text-sm text-green-600";
                  if (response.success) {

                  } else {
                    console.error('Erro ao baixar PDF:', response.message);
                  }
                } catch (error) {
                  console.error('Erro ao baixar PDF:', error);
                }
              });
            } else {
              console.error('Botão de download PDF não encontrado!');
            }
          });
        });
    })
  };

  const render_remover = () => {
    ipcRenderer.invoke('get-remocoes-data').then((response) => {
      mainContent.innerHTML = '';
      console.log(response)
      if (response.error) {
        mainContent.innerHTML = `<p class="text-red-500">Erro: ${response.message}</p>`;
        return;
      }
      const remocoes = response;
      // Criando a estrutura da página
      mainContent.innerHTML = `
            <div class="container mx-auto p-4 overflow-y-auto">
                <h1 class="text-2xl font-bold mb-4">Remover Item do Estoque</h1>
                <form id="remover-form" class="mb-6 bg-white p-4 shadow-md rounded">
                    <div class="mb-4">
                        <label class="block text-gray-700">Código de Barras:</label>
                        <input type="text" id="codigo" class="w-full p-2 border rounded" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-gray-700">Quantidade:</label>
                        <input type="number" id="quantidade" class="w-full p-2 border rounded" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-gray-700">Razão da Remoção:</label>
                        <input type="text" id="razao" class="w-full p-2 border rounded" required>
                    </div>
                    <button type="submit" class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Confirmar Remoção</button>
                </form>

                <h2 class="text-xl font-bold mt-6 mb-2">Histórico de Remoções</h2>
                <table class="table-auto w-full border-collapse overflow-hidden rounded-lg shadow-md">
                    <thead class="bg-gray-600 text-white text-left text-sm">
                        <tr>
                            <th class="border border-gray-500 px-4 py-3">Código</th>
                            <th class="border border-gray-500 px-4 py-3">Quantidade</th>
                            <th class="border border-gray-500 px-4 py-3">Razão</th>
                        </tr>
                    </thead>
                    <tbody id="remocoes-body" class="bg-white divide-y divide-gray-200">
                        ${remocoes.map(remocao => `
                            <tr>
                                <td class="border px-4 py-3">${remocao.codigo}</td>
                                <td class="border px-4 py-3">${remocao.quantidade}</td>
                                <td class="border px-4 py-3">${remocao.razao}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

      // Capturando o formulário e adicionando evento de submissão
      const form = document.getElementById('remover-form');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const codigo = document.getElementById('codigo').value;
        const quantidade = document.getElementById('quantidade').value;
        const razao = document.getElementById('razao').value;

        try {
          const response = await ipcRenderer.invoke('remover-item-estoque', codigo, quantidade, razao);
          if (response && response.error) {
            
          } else {
            
            render_remover(); // Atualiza a tela
          }
        } catch (error) {
          console.error('Erro ao remover item:', error);
        }
      });
    }).catch((error) => {
      console.error('Erro ao carregar remoções:', error);
      mainContent.innerHTML = `<p class="text-red-500">Erro ao carregar remoções: ${error.message}</p>`;
    });
  };

  const remover_btn = document.getElementById('remover');
  if (remover_btn) {
    remover_btn.addEventListener('click', render_remover);
  } else {
    console.error('Botão de estoque não encontrado!');
  }

  const caixa = document.getElementById('caixa');
  if (caixa) {
    caixa.addEventListener('click', render_caixa);
  } else {
    console.error('Botão de estoque não encontrado!');
  }

  const renderEntrada_periodo = (entradaData) => {
    const tabelaBody = document.getElementById('entrada-body');
    tabelaBody.innerHTML = '';
    if (tabelaBody) {
      tabelaBody.innerHTML = entradaData
        .map(
          (data) => `
                  <tr class="hover:bg-gray-100 transition duration-150 ease-in-out">
                    <td class="border border-gray-200 px-4 py-3 text-center text-gray-800 font-medium">${data.codigo_de_barras}</td>
                    <td class="border border-gray-200 px-4 py-3 text-gray-800">${data.nome}</td>
                    <td class="border border-gray-200 px-4 py-3 text-center text-gray-800">${data.quantidade_entrada}</td>
                    <td class="border border-gray-200 px-4 py-3 text-center text-gray-800 capitalize">${data.tipo_de_lanche}</td>
                    <td class="border border-gray-200 px-4 py-3 text-center text-gray-800 capitalize">${formatarData(data.data_entrada)}</td>
                    <td class="border border-gray-200 px-4 py-3 text-center font-semibold text-green-600">${data.valor_pago_unidade} R$</td>
                    <td class="border border-gray-200 px-4 py-3 text-center font-semibold text-green-600">${data.preco_unitario_de_venda} R$</td>
                    <td class="border border-gray-200 px-4 py-3 text-center font-semibold text-green-600">${data.valor_total_pago} R$</td>
                </tr>
                `
        )
        .join('');
      const BotaoBaixarEntradas = document.getElementById('download-pdf');
      if (BotaoBaixarEntradas) {
        BotaoBaixarEntradas.addEventListener('click', async () => {
          try {
            const response = await ipcRenderer.invoke('gerar_pdf_entrada', entradaData);
            const feedback = document.getElementById("feedback");
            feedback.textContent = "PDF baixado com sucesso na pasta download!";
            feedback.className = "mt-6 text-center text-sm text-green-600";
            if (response.success) {

            } else {
              console.error('Erro ao baixar PDF:', response.message);
            }
          } catch (error) {
            console.error('Erro ao baixar PDF:', error);
          }
        });
      } else {
        console.error('Botão de download PDF não encontrado!');
      }
    } else {
      console.error('Elemento "entrada-body" não encontrado.');
    }
  };

  const renderEntradas = () => {
    ipcRenderer.invoke('get-entradas-data').then((produtos) => {
      const mainContent = document.getElementById('main-content');
      mainContent.innerHTML = '';

      if (produtos.error) {
        mainContent.innerHTML = `<p class="text-red-500">Erro: ${produtos.message}</p>`;
        return;
      }

      if (produtos.length > 0) {
        fetch('historico_entrada.html')
          .then((response) => response.text())
          .then((html) => {
            mainContent.innerHTML = html;
            const filtroContainer = document.createElement('div');
            filtroContainer.className = 'mb-6';
            filtroContainer.innerHTML = `
              <h1 class="text-4xl font-bold mb-6 text-gray-800">Lista de Produtos - Entradas por Período</h1>
              <h2 class="text-2xl font-semibold mb-4 text-gray-700">Consultar Entradas</h2>
              <form id="filtro-entrada-form" class="space-y-6">
                  <div class="flex flex-wrap space-x-4 items-end">
                      <div class="w-full sm:w-auto mb-4 sm:mb-0">
                          <label for="data-inicio" class="text-xl block font-medium text-gray-700">Data Início</label>
                          <input type="date" id="data-inicio" name="dataInicio"
                              class="mt-2 block p-3 w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm">
                      </div>
                      <div class="w-full sm:w-auto mb-4 sm:mb-0">
                          <label for="data-fim" class="text-xl block font-medium text-gray-700">Data Fim</label>
                          <input type="date" id="data-fim" name="dataFim"
                              class="mt-2 block p-3 w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm">
                      </div>
                      <div class="w-full sm:w-auto">
                          <button id="entrada-periodo-btn" type="submit"
                              class="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition w-full sm:w-auto">
                              Consultar
                          </button>
                      </div>
                  </div>
              </form>
            `;
            mainContent.prepend(filtroContainer);

            const form = document.getElementById('filtro-entrada-form');
            form.addEventListener('submit', async (event) => {
              event.preventDefault();

              const formData = new FormData(form);
              const data = Object.fromEntries(formData.entries());

              try {
                const response = await ipcRenderer.invoke('get-entrada-por-periodo', data);

                renderEntrada_periodo(response);

              } catch (error) {
                console.error('Erro ao buscar saídas por período:', error);
              }
            });

            const searchInput = document.getElementById('search-input');
            const tabelaBody = document.getElementById('entrada-body');
            if (tabelaBody) {
              const renderTabela = (filtro = '') => {
                const produtosFiltrados = produtos.filter((produto) =>
                  produto.nome.toLowerCase().includes(filtro.toLowerCase())
                );


                tabelaBody.innerHTML = produtosFiltrados
                  .map(
                    (produto) => `
                <tr class="hover:bg-gray-100 transition duration-150 ease-in-out">
                  <td class="border border-gray-200 px-4 py-3 text-center text-gray-800 font-medium">${produto.codigo_de_barras}</td>
                  <td class="border border-gray-200 px-4 py-3 text-gray-800">${produto.nome}</td>
                  <td class="border border-gray-200 px-4 py-3 text-center text-gray-800">${produto.quantidade_entrada}</td>
                  <td class="border border-gray-200 px-4 py-3 text-center text-gray-800 capitalize">${produto.tipo_de_lanche}</td>
                  <td class="border border-gray-200 px-4 py-3 text-center text-gray-800 capitalize">${formatarData(produto.data_entrada)}</td>
                  <td class="border border-gray-200 px-4 py-3 text-center font-semibold text-green-600">${produto.valor_pago_unidade} R$</td>
                  <td class="border border-gray-200 px-4 py-3 text-center font-semibold text-green-600">${produto.preco_unitario_de_venda} R$</td>
                  <td class="border border-gray-200 px-4 py-3 text-center font-semibold text-green-600">${produto.valor_total_pago} R$</td>
                </tr>
              `
                  )
                  .join('');
              };


              renderTabela();

              if (searchInput) {
                searchInput.addEventListener('input', (event) => {
                  renderTabela(event.target.value);
                });
              }
              const BotaoBaixarEntradas = document.getElementById('download-pdf');
              if (BotaoBaixarEntradas) {
                BotaoBaixarEntradas.addEventListener('click', async () => {
                  try {
                    const response = await ipcRenderer.invoke('gerar_pdf_entrada', produtos);
                    const feedback = document.getElementById("feedback");
                    feedback.textContent = "PDF baixado com sucesso na pasta download!";
                    feedback.className = "mt-6 text-center text-sm text-green-600";
                    if (response.success) {

                    } else {
                      console.error('Erro ao baixar PDF:', response.message);
                    }
                  } catch (error) {
                    console.error('Erro ao baixar PDF:', error);
                  }
                });
              } else {
                console.error('Botão de download PDF não encontrado!');
              }
            } else {
              console.error('Elemento "entrada-body" não encontrado.');
            }
          })
          .catch((err) => {
            console.error('Erro ao carregar o template do entrada:', err);
            mainContent.innerHTML = `<p class="text-red-500">Erro ao carregar o template: ${err.message}</p>`;
          });
      } else {
        mainContent.innerHTML = '<p>Entrada vazia</p>';
      }
    }).catch((error) => {
      console.error('Erro ao carregar produtos:', error);
      mainContent.innerHTML = `<p class="text-red-500">Erro ao carregar produtos: ${error.message}</p>`;
    });
  };

  const entradaButton = document.getElementById('entrada-btn');
  if (entradaButton) {
    entradaButton.addEventListener('click', renderEntradas);
  } else {
    console.error('Botão de entradas não encontrado!');
  }

  const renderSaida_periodo = (saidaData) => {

    const tabelaBody = document.getElementById('saida-body');
    tabelaBody.innerHTML = '';
    if (tabelaBody) {
      tabelaBody.innerHTML = saidaData
        .map(
          (data) => `
                  <tr class="hover:bg-gray-100 transition duration-150 ease-in-out">
                    <td class="border border-gray-200 px-4 py-3 text-center text-gray-800 font-medium">${data.codigo_de_barras}</td>
                    <td class="border border-gray-200 px-4 py-3 text-gray-800">${data.nome}</td>
                    <td class="border border-gray-200 px-4 py-3 text-center text-gray-800">${data.quantidade_vendida}</td>
                    <td class="border border-gray-200 px-4 py-3 text-center text-gray-800 capitalize">${formatarData(data.data_saida)}</td>
                    <td class="border border-gray-200 px-4 py-3 text-center font-semibold text-green-600">${data.valor_venda} R$</td>
                  </tr>
                `
        )
        .join('');
      const BotaoBaixarSaidas = document.getElementById('download-pdf');
      if (BotaoBaixarSaidas) {
        BotaoBaixarSaidas.addEventListener('click', async () => {
          try {
            const response = await ipcRenderer.invoke('gerar_pdf_saida', saidaData);
            const feedback = document.getElementById("feedback");
            feedback.textContent = "PDF baixado com sucesso na pasta download!";
            feedback.className = "mt-6 text-center text-sm text-green-600";
            if (response.success) {

            } else {
              console.error('Erro ao baixar PDF:', response.message);
            }
          } catch (error) {
            console.error('Erro ao baixar PDF:', error);
          }
        });
      } else {
        console.error('Botão de download PDF não encontrado!');
      }
    } else {
      console.error('Elemento "saida-body" não encontrado.');
    }
  };

  const renderSaidas = () => {
    ipcRenderer.invoke('get-saidas-data').then((produtos) => {
      const mainContent = document.getElementById('main-content');
      mainContent.innerHTML = '';

      if (produtos.error) {
        mainContent.innerHTML = `<p class="text-red-500">Erro: ${produtos.message}</p>`;
        return;
      }

      if (produtos.length > 0) {
        fetch('historico_vendas.html')
          .then((response) => response.text())
          .then((html) => {
            mainContent.innerHTML = html;

            const filtroContainer = document.createElement('div');
            filtroContainer.className = 'mb-6';
            filtroContainer.innerHTML = `
              <h1 class="text-4xl font-bold mb-8">Lista de Produtos - Saídas por Período</h1>
              <h2 class="text-2xl font-semibold mb-5">Consultar Saídas</h2>
        
              <form id="filtro-saidas-form" class="space-y-4">
                  <div class="flex space-x-4 items-end">
                      <div class="w-full sm:w-auto mb-4 sm:mb-0">
                          <label for="data-inicio" class="text-xl block font-medium text-gray-700">Data Início</label>
                          <input type="date" id="data-inicio" name="dataInicio"
                              class="mt-2 block p-3 w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm">
                      </div>
                      <div class="w-full sm:w-auto mb-4 sm:mb-0">
                          <label for="data-fim" class="text-xl block font-medium text-gray-700">Data Fim</label>
                          <input type="date" id="data-fim" name="dataFim"
                              class="mt-2 block p-3 w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm">
                      </div>
                      <div>
                          <button id="saida-periodo-btn" type="submit"
                              class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition">
                              Consultar
                          </button>
                      </div>
                  </div>
              </form>
            `;
            mainContent.prepend(filtroContainer);

            const form = document.getElementById('filtro-saidas-form');
            form.addEventListener('submit', async (event) => {
              event.preventDefault();

              const formData = new FormData(form);
              const data = Object.fromEntries(formData.entries());

              try {
                const response = await ipcRenderer.invoke('get-saida-por-periodo', data);

                renderSaida_periodo(response);

              } catch (error) {
                console.error('Erro ao buscar saídas por período:', error);
              }
            });
            const searchInput = document.getElementById('search-input');
            const tabelaBody = document.getElementById('saida-body');
            if (tabelaBody) {
              const renderTabela = (filtro = '') => {
                const produtosFiltrados = produtos.filter((produto) =>
                  produto.nome.toLowerCase().includes(filtro.toLowerCase())
                );

                tabelaBody.innerHTML = produtosFiltrados
                  .map(
                    (produto) => `
                    <tr class="hover:bg-gray-100 transition duration-150 ease-in-out">
                      <td class="border border-gray-200 px-4 py-3 text-center text-gray-800 font-medium">${produto.codigo_de_barras}</td>
                      <td class="border border-gray-200 px-4 py-3 text-gray-800">${produto.nome}</td>
                      <td class="border border-gray-200 px-4 py-3 text-center text-gray-800">${produto.quantidade_vendida}</td>
                      <td class="border border-gray-200 px-4 py-3 text-center text-gray-800 capitalize">${formatarData(produto.data_saida)}</td>
                      <td class="border border-gray-200 px-4 py-3 text-center font-semibold text-green-600">${produto.valor_venda} R$</td>
                    </tr>
                  `
                  )
                  .join('');
              };
              renderTabela();

              if (searchInput) {
                searchInput.addEventListener('input', (event) => {
                  renderTabela(event.target.value);
                });
              }
              const BotaoBaixarSaidas = document.getElementById('download-pdf');
              if (BotaoBaixarSaidas) {
                BotaoBaixarSaidas.addEventListener('click', async () => {
                  try {
                    const response = await ipcRenderer.invoke('gerar_pdf_saida', produtos);
                    const feedback = document.getElementById("feedback");
                    feedback.textContent = "PDF baixado com sucesso na pasta download!";
                    feedback.className = "mt-6 text-center text-sm text-green-600";
                    if (response.success) {

                    } else {
                      console.error('Erro ao baixar PDF:', response.message);
                    }
                  } catch (error) {
                    console.error('Erro ao baixar PDF:', error);
                  }
                });
              } else {
                console.error('Botão de download PDF não encontrado!');
              }
            } else {
              console.error('Elemento "saida-body" não encontrado.');
            }
          })
          .catch((err) => {
            console.error('Erro ao carregar o template do saida:', err);
            mainContent.innerHTML = `<p class="text-red-500">Erro ao carregar o template: ${err.message}</p>`;
          });
      } else {
        mainContent.innerHTML = '<p>Saída vazia</p>';
      }
    }).catch((error) => {
      console.error('Erro ao carregar produtos:', error);
      mainContent.innerHTML = `<p class="text-red-500">Erro ao carregar produtos: ${error.message}</p>`;
    });
  };

  const saidaButton = document.getElementById('saida-btn');
  if (saidaButton) {
    saidaButton.addEventListener('click', renderSaidas);
  } else {
    console.error('Botão de saidas não encontrado!');
  }

  const cadastroClick = document.getElementById('cadastroButtonClick');
  if (cadastroClick) {
    cadastroClick.addEventListener('click', async () => {
      console.log('Botão de cadastro clicado!');
      try {
        const content = await ipcRenderer.invoke('load-cadastro-content');
        const contentArea = document.getElementById('main-content');
        if (contentArea) {
          contentArea.innerHTML = content;

          const form = document.getElementById('cadastrar-produto-form');
          if (form) {
            form.addEventListener('submit', async (event) => {
              event.preventDefault();
              const formData = new FormData(form);
              const data = Object.fromEntries(formData.entries());

              try {
                sessaoId = await ipcRenderer.invoke('get-sessao-id');
                const response = await ipcRenderer.invoke('cadastrar-produto', data, sessaoId);
                const feedback = document.getElementById("feedback");
                feedback.textContent = "Produto cadastrado com sucesso!";
                feedback.className = "mt-6 text-center text-sm text-green-600";
                if (response.success) {
                  form.reset();
                }
              } catch (error) {
                console.error('Erro ao enviar os dados:', error);
              }
            });
          } else {
            console.error('Formulário "cadastrar-produto-form" não encontrado.');
          }
        } else {
          console.error('Div contentArea não encontrada.');
        }
      } catch (error) {
        console.error(`Erro ao carregar o conteúdo do cadastro: ${error.message}`);
      }
    });
  } else {
    console.error('Botão de cadastro não encontrado');
  }

  let arrayNomes = [];
  let CodigosLidos = [];

  const renderItens = () => {
    const tabelaItensLidos = document.getElementById("itens-lidos-body");
    tabelaItensLidos.innerHTML = "";
    if (arrayNomes.length === 0) {
      tabelaItensLidos.innerHTML = `
                        <tr>
                            <td colspan="3" class="text-center py-4 text-gray-500">Nenhum item lido.</td>
                        </tr>`;
    } else {
      arrayNomes.forEach((produto, index) => {
        tabelaItensLidos.innerHTML += `
                            <tr class="hover:bg-gray-100 transition duration-150 ease-in-out">
                              <td class="border border-gray-300 px-4 py-2">${index + 1}</td>
                              <td class="border border-gray-300 px-4 py-2">
                                ${produto.nome}                             
                              </td>
                              <td class="border border-gray-300 px-4 py-2">R$ ${produto.preco.toFixed(2)}</td>
                              <td class="border border-gray-300 px-4 py-2 text-center">
                                <button class="btn-remover bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition-all">
                                  Remover
                                </button>
                              </td>
                            </tr>`;
      });
      const total = calcularTotalItens();
      console.log(total);
      tabelaItensLidos.innerHTML += `
        <tr class="font-bold bg-gray-200">
          <td colspan="2" class="border border-gray-300 px-4 py-2 text-right">Total:</td>
          <td class="border border-gray-300 px-4 py-2">R$ ${total}</td>
          <td class="border border-gray-300 px-4 py-2"></td>
        </tr>`;

      // Adicionando campo para inserir valor pago
      tabelaItensLidos.innerHTML += `
        <tr class="font-bold bg-gray-200">
          <td colspan="2" class="border border-gray-300 px-4 py-2 text-right">Valor Pago:</td>
          <td class="border border-gray-300 px-4 py-2">
            <input type="number" id="valor-pago" class="w-full px-2 py-1 border rounded" placeholder="Insira o valor pago">
          </td>
          <td class="border border-gray-300 px-4 py-2"></td>
        </tr>`;

      // Adicionando campo para mostrar o troco
      tabelaItensLidos.innerHTML += `
        <tr class="font-bold bg-gray-200">
          <td colspan="2" class="border border-gray-300 px-4 py-2 text-right">Valor de troco:</td>
          <td class="border border-gray-300 px-4 py-2" id="valor-troco">R$ 0.00</td>
          <td class="border border-gray-300 px-4 py-2"></td>
        </tr>`;

      // Atualizar o troco quando o valor pago for inserido
      const valorPagoInput = document.getElementById("valor-pago");
      valorPagoInput.addEventListener("input", () => {
        const valorPago = parseFloat(valorPagoInput.value) || 0;
        const troco = calcular_troco(total, valorPago);
        document.getElementById("valor-troco").textContent = `R$ ${troco}`;
      });
    }
  };

  const calcularTotalItens = () => {
    if (arrayNomes.length === 0) {
      return 0;
    } else {
      const total = arrayNomes.reduce((acc, produto) => acc + produto.preco, 0);
      return total.toFixed(2);
    }
  };

  const calcular_troco = (total, valor_pago) => {
    return (valor_pago - total).toFixed(2);
  };

  const removerItem = (index) => {
    arrayNomes.splice(index, 1);
    CodigosLidos.splice(index, 1);
    renderItens();

    const feedback = document.getElementById("feedback");
    feedback.textContent = "Item removido com sucesso!";
    feedback.className = "mt-6 text-center text-sm text-green-600";
  };

  const adicionarItem = async (codigo) => {
    const feedback = document.getElementById("feedback");
    try {
      const produto = await buscarPrecoProdutoPorCodigoBarras(codigo);
      if (!produto) { // Verifica se o produto é null ou undefined
        throw new Error("Produto não encontrado.");
      }
      arrayNomes.push(produto);
      CodigosLidos.push(codigo);
      renderItens();
      feedback.textContent = "Item adicionado com sucesso!";
      feedback.className = "mt-6 text-center text-sm text-green-600";
    } catch (error) {
      feedback.textContent = "Erro ao buscar o produto. Tente novamente.";
      feedback.className = "mt-6 text-center text-sm text-red-600";
      console.error('Erro ao buscar o produto:', error);
      renderItens();
    }
  };

  const venderClick = document.getElementById('venderButtonClick');
  if (venderClick) {

    venderClick.addEventListener('click', async () => {
      console.log('Botão de vender clicado!');
      CodigosLidos = [];
      arrayNomes = [];
      try {
        const content = await ipcRenderer.invoke('load-vender-content');
        const contentArea = document.getElementById('main-content');
        if (contentArea) {
          sessaoId = await ipcRenderer.invoke('get-sessao-id');
          console.log('Sessão:', sessaoId);
          contentArea.innerHTML = content;
          console.log('Página de vendas carregada.');
          render_alunos_select();

          const formAdd = document.getElementById('formAdd');
          const formSubmit = document.getElementById('submitvenda');
          const inputCodigoBarras = document.getElementById("codigo-barras");
          const inputQuantidade = document.getElementById("quantidade");
          const alunosSelect = document.getElementById('alunos-select');
          document.getElementById("itens-lidos-body").addEventListener("click", (event) => {
            if (event.target.classList.contains("btn-remover")) {
              const row = event.target.closest("tr");
              const index = parseInt(row.getAttribute("data-index"), 10);
              removerItem(index);
            }
          });
          renderItens();

          if (formAdd) {
            formAdd.addEventListener("submit", async (event) => {

              event.preventDefault();
              const codigo = inputCodigoBarras.value.trim();
              const quantidade = inputQuantidade.value || 1;
              console.log(codigo);
              if (codigo) {
                for (const _ of Array.from({ length: quantidade })) {
                  await adicionarItem(codigo);
                }
                ipcRenderer.send('item-adicionado', codigo);
              } else {
                feedback.textContent = "Por favor, insira um código de barras.";
                feedback.className = "mt-6 text-center text-sm text-red-600";
              }
            });
          } else {
            console.error('Formulário "formAdd" não encontrado.');
          }
          if (formSubmit) {
            formSubmit.addEventListener("click", async (event) => {
              event.preventDefault();
              const contabilizado = CodigosLidos.reduce((acc, codigo) => {
                acc[codigo] = (acc[codigo] || 0) + 1;
                return acc;
              }, {});
              const data = Object.entries(contabilizado).map(([codigo, quantidade]) => ({
                codigo,
                quantidade,
              }));

              try {
                sessaoatual = await ipcRenderer.invoke("get-sessao-id");
                const response = await ipcRenderer.invoke('vender-produto', data, sessaoatual);
                const feedback = document.getElementById("feedback");
                feedback.textContent = "Venda realizada com sucesso!";
                feedback.className = "mt-6 text-center text-sm text-green-600";
                if (response.success) {
                  const alunoId = alunosSelect.value;

                  const totalCompra = calcularTotalItens();
                  console.log(`Total da compra: ${totalCompra}`);
                  if (alunoId) {
                    await ipcRenderer.invoke('atualizar-credito-aluno', { alunoId, totalCompra });
                    console.log(`Crédito do aluno ${alunoId} atualizado.`);

                  }
                  else {

                    data_caixa = { valor: totalCompra, entrada: true };
                    await ipcRenderer.invoke('atualizar_caixa', data_caixa);
                  }
                  CodigosLidos = [];
                  arrayNomes = [];
                  renderItens();
                  render_alunos_select();
                  console.log("Venda processada com sucesso!");
                  console.log(`Array nomes2 ${arrayNomes}`);
                } else {
                  console.error("Erro ao processar venda:", response.message);
                }
              } catch (error) {
                console.error("Erro ao enviar os dados:", error);
              }
            });
          } else {
            console.error('Formulário "submitvenda" não encontrado.');
          }
        } else {
          console.error('Div "contentArea" não encontrada.');
        }
      } catch (error) {
        console.error(`Erro ao carregar o conteúdo de vendas: ${error.message}`);
      }
    });
  } else {
    console.error('Botão de vender não encontrado');
  }

  const creditosClick = document.getElementById('creditosButtonClick');
  if (creditosClick) {
    creditosClick.addEventListener('click', async () => {
      console.log('Botão de créditos clicado!');
      try {
        const content = await ipcRenderer.invoke('load-credito-content');
        const contentArea = document.getElementById('main-content');

        if (contentArea) {
          contentArea.innerHTML = content;
          render_alunos_select();
          console.log('Página de créditos carregada com sucesso.');
          const form_adicionar = document.getElementById('creditos-form_adicionar');
          const form_aumentar = document.getElementById('creditos-form_aumentar');
          if (form_adicionar) {
            form_adicionar.addEventListener('submit', async (event) => {
              event.preventDefault();

              const formData = new FormData(form_adicionar);
              const data = Object.fromEntries(formData.entries());

              try {
                const response = await ipcRenderer.invoke('adicionar-credito', data);
                data_caixa = { valor: data.valor, entrada: true };
                await ipcRenderer.invoke('atualizar_caixa', data_caixa);
                if (response.success) {

                  form_adicionar.reset();
                } else {
                  console.error('Erro ao cadastrar produto:', response.message);
                }
              } catch (error) {
                console.error('Erro ao enviar os dados:', error);
              }
            });
          } else {
            console.error('Formulário "creditos-form_adicionar" não encontrado.');
          }
          if (form_aumentar) {
            form_aumentar.addEventListener('submit', async (event) => {
              event.preventDefault();

              const formData = new FormData(form_aumentar);
              const data = Object.fromEntries(formData.entries());

              const alunosSelect = document.getElementById('alunos-select');
              const alunoId = alunosSelect.value;
              const valor = parseFloat(data.valor);

              try {
                const response = await ipcRenderer.invoke('aumentar-credito-aluno', { alunoId, valor });
                data_caixa = { valor: valor, entrada: true };
                await ipcRenderer.invoke('atualizar_caixa', data_caixa);
                if (response.success) {

                  form_aumentar.reset();
                  render_alunos_select();
                } else {
                  console.error('Erro ao cadastrar produto:', response.message);
                }
              } catch (error) {
                console.error('Erro ao enviar os dados:', error);
              }
            });
          } else {
            console.error('Formulário "creditos-form_aumentar" não encontrado.');
          }
        } else {
          console.error('Div "contentArea" não encontrada.');
          return;
        }
      } catch (error) {
        console.error(`Erro ao carregar o conteúdo de créditos: ${error.message}`);
      }
    });
  } else {
    console.error('Botão de créditos não encontrado.');
  }

  render_alunos_select = () => {
    ipcRenderer.invoke('get-creditos-alunos').then((alunos) => {
      const alunosSelect = document.getElementById('alunos-select');
      const searchInput = document.getElementById('search-alunos');

      if (alunos.error) {
        console.error(`Erro: ${alunos.message}`);
        return;
      }

      // Função para renderizar alunos no select
      const renderAlunos = (filter = "") => {
        if (alunosSelect) {
          const filteredAlunos = alunos.filter((aluno) =>
            aluno.nome_aluno.toLowerCase().includes(filter.toLowerCase()) ||
            aluno.matricula_aluno.toLowerCase().includes(filter.toLowerCase()) ||
            aluno.turma_aluno.toLowerCase().includes(filter.toLowerCase()) ||
            aluno.valor_credito.toString().includes(filter)
          );

          if (filteredAlunos.length > 0) {
            filteredAlunos.sort((a, b) => a.nome_aluno.localeCompare(b.nome_aluno));
            alunosSelect.innerHTML = `
                    <option value="">Nenhum aluno selecionado</option>
                    ${filteredAlunos.map(
              (aluno) => `
                      <option value="${aluno.id}">
                        ${aluno.nome_aluno} - ${aluno.matricula_aluno} - ${aluno.turma_aluno} - R$ ${aluno.valor_credito}
                      </option>
                    `).join('')}
                  `;
          } else {
            alunosSelect.innerHTML = `
                        <option value="" disabled>Nenhum aluno encontrado</option>
                    `;
          }
        } else {
          console.error('Elemento "alunos-select" não encontrado.');
        }
      };

      // Renderizar alunos inicialmente
      renderAlunos();

      // Adicionar evento de busca no input
      if (searchInput) {
        searchInput.addEventListener('input', (event) => {
          const filter = event.target.value;
          renderAlunos(filter);
        });
      } else {
        console.error('Elemento "search-alunos" não encontrado.');
      }

      // Evento de alteração no select (seleção do aluno)
      alunosSelect.addEventListener('change', (event) => {
        const selectedAlunoId = event.target.value;
        const options = event.target.options;

        // Remover destaque de todas as opções
        for (let option of options) {
          option.classList.remove('bg-green-100');
        }

        // Adicionar destaque na opção selecionada
        const selectedOption = Array.from(options).find(option => option.value === selectedAlunoId);
        if (selectedOption) {
          selectedOption.classList.add('bg-green-100');
        }

        // Exibir a seleção do aluno
        if (selectedAlunoId) {
          console.log(`Aluno selecionado: ${selectedAlunoId}`);
        } else {
          console.log('Nenhum aluno selecionado');
        }
      });
    }).catch((error) => {
      console.error('Erro ao carregar alunos:', error);
    });
  };

  const render_alunos_tabela = async () => {
    ipcRenderer.invoke('get-creditos-alunos').then((alunos) => {
      const mainContent = document.getElementById('main-content');
      mainContent.innerHTML = '';

      if (alunos.error) {
        mainContent.innerHTML = `<p class="text-red-500">Erro: ${alunos.message}</p>`;
        return;
      }

      if (alunos.length > 0) {
        fetch('alunos_credito.html')
          .then((response) => response.text())
          .then((html) => {
            mainContent.innerHTML = html;

            // Adicionando o campo de pesquisa
            const searchInput = document.getElementById('search-aluno');

            // Função para renderizar a tabela de acordo com o filtro
            const renderTabela = (filtro = '') => {
              const alunosFiltrados = alunos.filter((aluno) =>
                aluno.nome_aluno.toLowerCase().includes(filtro.toLowerCase())
              );

              const tabelaBody = document.getElementById('alunos-body');
              if (tabelaBody) {
                tabelaBody.innerHTML = alunosFiltrados
                  .map(
                    (aluno) => `
                    <tr class="hover:bg-gray-100 transition duration-150 ease-in-out">
                      <td class="border border-gray-200 px-4 py-3 text-gray-800">${aluno.nome_aluno}</td>
                      <td class="border border-gray-200 px-4 py-3 text-center text-gray-800">${aluno.matricula_aluno}</td>
                      <td class="border border-gray-200 px-4 py-3 text-center text-gray-800">${aluno.turma_aluno}</td>
                      <td class="border border-gray-200 px-4 py-3 text-center font-semibold text-green-600">R$ ${aluno.valor_credito}</td>
                      <td class="border border-gray-200 px-4 py-3 text-center font-semibold text-gray-800">${formatarData(aluno.data_credito)}</td>
                    </tr>
                  `
                  )
                  .join('');
              } else {
                console.error('Elemento "alunos-body" não encontrado.');
              }
            };

            // Renderiza a tabela inicial
            renderTabela();

            // Adiciona o evento de busca
            if (searchInput) {
              searchInput.addEventListener('input', (event) => {
                renderTabela(event.target.value);
              });
            }
          })
          .catch((err) => {
            console.error('Erro ao carregar o template do alunos com crédito:', err);
            mainContent.innerHTML = `<p class="text-red-500">Erro ao carregar o template: ${err.message}</p>`;
          });
      } else {
        mainContent.innerHTML = '<p>Alunos vazio</p>';
      }
    }).catch((error) => {
      console.error('Erro ao carregar alunos:', error);
      mainContent.innerHTML = `<p class="text-red-500">Erro ao carregar alunos: ${error.message}</p>`;
    });
  };

  const alunos_credito = document.getElementById('alunoscreditoBTN');
  if (alunos_credito) {
    alunos_credito.addEventListener('click', async () => {
      await render_alunos_tabela();
    });
  } else {
    console.error('Botão de estoque não encontrado!');
  }

});
