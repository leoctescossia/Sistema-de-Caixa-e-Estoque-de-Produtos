const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { listaEstoque,
        ultimasEntradas, 
        ultimasSaidas, 
        saidasPorPeriodo,
        entradaPorPeriodo,
        getCreditosAlunos,
        total_no_caixa,
        saquesPorPeriodo,
        saques,
        listasessao,
        consultarsessao,
        remocoes,
      } = require('./API/gerador_relatorio.js');
const {PDFEstoque,
      BaixarPDFentrada,
      BaixarPDFsaida,
      BaixarPDFsaque,
      } = require('./API/gerador_PDF.js');
const { cadastrarProduto, 
        venderProduto, 
        adicionarCredito, 
        atualizarCreditoAluno,
        atualizarCaixa,
        aumentarCreditoAluno,
        iniciarSessao,
        adicionar_entrada_id,
        adicionar_saque_id,
        adicionar_venda_id,
        encerrarSessao,
        remover_do_estoque
      } = require('./API/escrita.js');
const fs = require('fs');

let mainWindow;

let sessaoId = null;
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'renderer.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: true,
    },
  });
  mainWindow.maximize();
  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, 'src/index.html'));
  //mainWindow.webContents.openDevTools();
  app.on('before-quit', async (event) => {
    if (sessaoId) {
      event.preventDefault(); // Impede o fechamento imediato
  
      try {
        console.log("Encerrando sessão:", sessaoId);
        await encerrarSessao(sessaoId);
      } catch (error) {
        console.error('Erro ao encerrar sessão:', error);
      } finally {
        app.exit(); // Usa app.exit() em vez de app.quit() para evitar loops
      }
    }
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
});

ipcMain.handle('get-produtos-data', async () => {
  try {
    const produtos = await listaEstoque();
    return produtos;
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('load-cadastro-content', async () => {
  try {
    const cadastroFilePath = path.resolve(__dirname, 'src/cadastro.html');
    if (!fs.existsSync(cadastroFilePath)) {
      throw new Error('Arquivo cadastro.html não encontrado!');
    }
    return fs.readFileSync(cadastroFilePath, 'utf-8');
  } catch (error) {
    console.error(`Erro ao ler o conteúdo do cadastro: ${error.message}`);
    throw error;
  }
});

ipcMain.handle('load-credito-content', async () =>{
  try {
    const creditoFilePath = path.resolve(__dirname, 'src/creditos.html');
    if (!fs.existsSync(creditoFilePath)) {
      throw new Error('Arquivo credito.html não encontrado!');
    }
    return fs.readFileSync(creditoFilePath, 'utf-8');
  } catch(error){
    console.error(`Erro ao ler o conteúdo do credito: ${error.message}`);
    throw error;
  }
});

ipcMain.handle('load-vender-content', async ()=>{
  try {
    const venderFilePath = path.resolve(__dirname, 'src/vender.html');
    if (!fs.existsSync(venderFilePath)) {
      throw new Error('Arquivo vender.html não encontrado!');
    }
    return fs.readFileSync(venderFilePath, 'utf-8');
  } catch(error){
    console.error(`Erro ao ler o conteúdo do vender: ${error.message}`);
    throw error;
  }
});

ipcMain.handle('cadastrar-produto', async (event, data, sessaoId) => {
  try {
    const { codigo, nome, quantidade, preco_de_venda, tipo, preco_de_compra } = data;

    if (!codigo || !nome || !tipo) {
      throw new Error('Os campos "código", "nome" e "tipo" são obrigatórios.');
    }

    if (isNaN(quantidade) || parseInt(quantidade) <= 0) {
      throw new Error('A quantidade deve ser um número positivo.');
    }

    if (isNaN(preco_de_venda) || parseFloat(preco_de_venda) <= 0) {
      throw new Error('O preço de venda deve ser um número positivo.');
    }

    if (isNaN(preco_de_compra) || parseFloat(preco_de_compra) <= 0) {
      throw new Error('O preço de compra deve ser um número positivo.');
    }
    console.log("valor na main", sessaoId)
    await cadastrarProduto(
      codigo,
      nome,
      parseInt(quantidade),
      parseFloat(preco_de_venda),
      tipo,
      parseFloat(preco_de_compra),
      sessaoId
    );

    return { success: true };
  } catch (error) {
    console.error('Erro ao cadastrar produto:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('vender-produto', async (event, data, sessaoId) => {
  try {
    
    for (const item of data) {
      const { codigo, quantidade } = item;
      await venderProduto(codigo, quantidade, sessaoId);
    }

    return { success: true, message: 'Venda processada com sucesso!' };
  } catch (error) {
    console.error("Erro ao processar venda:", error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-entradas-data', async () => {
  try {
    const entradas = await ultimasEntradas();
    return entradas;
  } catch (error) {
    console.error('Erro ao buscar entradas:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('get-saidas-data', async () => {
  try {
    const saidas = await ultimasSaidas();
    return saidas;      
  } catch (error) {
    console.error('Erro ao buscar saidas:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('get-saida-por-periodo', async (event, data) => {
  try{
    const saidas = await saidasPorPeriodo(data);
    return saidas;
  } catch (error) {
    console.error('Erro ao buscar saidas por período:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('get-entrada-por-periodo', async (event, data) => {
  try{
    const entradas = await entradaPorPeriodo(data);
    return entradas;
  } catch (error) {
    console.error('Erro ao buscar entradas por período:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('gerar_pdf_estoque', async () => {
  try {
    PDFEstoque();
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('gerar_pdf_entrada', async (event, data) => {
  try {
    BaixarPDFentrada(data);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('gerar_pdf_saida', async (event, data) => {
  try {
    BaixarPDFsaida(data);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('adicionar-credito', async (event, data) => {
  
  try {
    const { nome, turma, valor, matricula } = data;

    if (!nome || !turma) {
      throw new Error('Os campos "nome_aluno" e "turma_aluno" são obrigatórios.');
    }

    if (isNaN(valor) || parseFloat(valor) <= 0) {
      throw new Error('O valor do crédito deve ser um número positivo.');
    }

    await adicionarCredito(
      nome,
      turma,
      parseFloat(valor),
      matricula,
    );

    return { success: true };
  } catch (error) {
    console.error('Erro ao adicionar crédito:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-creditos-alunos', async (event) => {
  try {
    const alunos = await getCreditosAlunos();
    return alunos;
  } catch (error) {
    console.error('Erro ao buscar alunos com crédito:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('atualizar-credito-aluno', async (event, { alunoId, totalCompra }) => {
  try {
    await atualizarCreditoAluno(alunoId, totalCompra);
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar crédito do aluno:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('aumentar-credito-aluno', async (event, { alunoId, valor }) => {
  try {
    await aumentarCreditoAluno(alunoId, valor);
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar crédito do aluno:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('atualizar_caixa', async (event, data, sessaoId) => {
  try {
    const { valor, entrada, descricao } = data;
    await atualizarCaixa(
      valor,
      entrada,
      descricao,
      sessaoId
    );
    
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('total_no_caixa', async () => {
  try{
    const caixa = await total_no_caixa();
    return caixa;
  }catch (error){
    console.error('Erro ao consultar:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-saques-data', async () => {
  try {
    const saques_data = await saques();
    return saques_data;      
  } catch (error) {
    console.error('Erro ao buscar saidas:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('get-saques-periodo', async (event, data) => {
  try {
    const saques = await saquesPorPeriodo(data);
    return saques;      
  } catch (error) {
    console.error('Erro ao buscar saidas:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('gerar_pdf_caixa', async (event, data) => {
  try {
    BaixarPDFsaque(data);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('get-sessao-data', async (event) => {
  try {
    const sessoes = await listasessao();
    return sessoes;      
  } catch (error) {
    console.error('Erro ao buscar sessoes:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('iniciar-sessao', async (event, nome) => {
  try {
    const sessao = await iniciarSessao(nome);
    console.log(sessao);
    return sessao;      
  } catch (error) {
    console.error('Erro ao iniciar:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('encerrar-sessao', async (event, sessao_id,) => {
  try {
    console.log("encerrando sessao de id",sessao_id);
    const sessao = await encerrarSessao(sessao_id);
    return sessao;      
  } catch (error) {
    console.error('Erro ao encerrar:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('adicionar-venda-sessao', async (event, venda_id, sessao_id) => {
  try {
    const sessoes = await adicionar_venda_id(venda_id, sessao_id);
    return sessoes;      
  } catch (error) {
    console.error('Erro ao adicionar venda:', error);
    return { error: true, message: error.message };
  }
});


ipcMain.handle('adicionar-entrada-sessao', async (event, entrada_id, sessao_id) => {
  try {
    const sessoes = await adicionar_entrada_id(entrada_id, sessao_id);
    return sessoes;      
  } catch (error) {
    console.error('Erro ao adicionar entrada:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('adicionar-saque-sessao', async (event, saque_id, sessao_id) => {
  try {
    const sessoes = await adicionar_saque_id(saque_id, sessao_id);
    return sessoes;      
  } catch (error) {
    console.error('Erro ao adicionar saque:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('set-sessao-id', (event, id) => {
    sessaoId = id;
});

ipcMain.handle('get-sessao-id', (event) => {
    return sessaoId;
});

ipcMain.handle('clear-sessao-id', (event) => {
    sessaoId = null;
});

ipcMain.handle('get-sessao-detalhes', async (event, sessaoId) => {
  try {
    const {data_sessao: sessao_data, data_vendas: sessao_vendas, data_entradas: sessao_entradas, data_saque: sessao_saques} = await consultarsessao(sessaoId);
    console.log("passando valores")
    console.log(sessao_data, sessao_vendas, sessao_entradas, sessao_saques)
    return { sessao_data, sessao_vendas, sessao_entradas, sessao_saques };
  } catch (error) {
      console.error('Erro ao buscar detalhes da sessão:', error);
      return { error: true, message: error.message };
  }
});
ipcMain.handle('get-remocoes-data', async () => {
  try {
    const data = await remocoes();
    return data;
  } catch (error) {
    console.error('Erro ao buscar remocoes:', error);
    return { error: true, message: error.message };
  }
});
ipcMain.handle('remover-item-estoque', async (event, codigo, quantidade, razao) => {
  try {
    await remover_do_estoque(codigo, quantidade, razao);
  } catch (error) {
      console.error('Erro ao remover item:', error);
      return { error: true, message: error.message };
  }
});