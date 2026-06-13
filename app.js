// ==========================================================================
// CONFIGURAÇÕES DE CONEXÃO (SUBSTITUA APENAS A SUA CHAVE)
// ==========================================================================
const SUPABASE_URL = "https://rdmgaaxxwturbmldzukx.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_ID8o4CD7cC6CE8cvRCu9Og_avFuc15O";

// Inicializa o cliente do Supabase
const conexaoSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variável global para guardar os dados exibidos na tela (usada depois para gerar o Excel)
let dadosAtuais = [];

// ==========================================================================
// EVENTO DE INICIALIZAÇÃO (Roda assim que a página carrega)
// ==========================================================================
window.onload = function() {
    // 🔒 TRAVA DE SEGURANÇA MÁXIMA
    // Se NÃO estiver marcado como 'sim' no navegador, chuta pro login imediatamente
    if (localStorage.getItem('usuarioLogado') !== 'sim') {
        window.location.href = "index.html";
        return; // Para a execução do código aqui mesmo!
    }

    // Se passar pela trava, carrega as configurações da página normalmente:
    const hoje = new Date();
    
    // 1. Coloca a data de hoje automaticamente no campo de lançamento
    document.getElementById('dataDonativo').value = hoje.toISOString().split('T')[0];
    
    // 2. Define os filtros de Mês e Ano automáticos para o mês atual
    const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
    const anoAtual = hoje.getFullYear();
    document.getElementById('filtroMes').value = mesAtual;
    document.getElementById('filtroAno').value = anoAtual;

    // 3. Busca os dados do mês atual no banco de dados
    buscarDonativos();
};

// ==========================================================================
// FUNÇÃO: SALVAR DONATIVO (Permite salvar com R$ 0,00 e valida data)
// ==========================================================================
async function salvarDonativo() {
    const dataInput = document.getElementById('dataDonativo').value;
    const mundialInput = parseFloat(document.getElementById('valorMundial').value) || 0;
    const congregacaoInput = parseFloat(document.getElementById('valorCongregacao').value) || 0;

    // 1. Validação básica: campo de data vazio
    if (!dataInput) {
        Swal.fire({
            icon: 'warning',
            title: 'Campo Obrigatório',
            text: 'Por favor, selecione uma data válida!',
            confirmButtonColor: '#27ae60'
        });
        return;
    }

    // 2. Validação de data esquisita (Proteção de Limites)
    const dataDigitada = new Date(dataInput);
    const anoDigitado = dataDigitada.getFullYear();

    if (anoDigitado < 2024 || anoDigitado > 2027) {
        Swal.fire({
            icon: 'error',
            title: 'Data Inválida ou Esquisita!',
            text: `O ano digitado foi ${anoDigitado}. O sistema só aceita lançamentos entre os anos de 2024 e 2027 para evitar erros de digitação.`,
            confirmButtonColor: '#e74c3c'
        });
        return; 
    }

    // Insere os dados na tabela do Supabase (Aceita zeros normalmente)
    const { data, error } = await conexaoSupabase
        .from('donativos')
        .insert([
            { 
                data_donativo: dataInput, 
                obra_mundial: mundialInput, 
                despesas_cong: congregacaoInput 
            }
        ]);

    if (error) {
        console.error("Erro ao salvar:", error);
        Swal.fire({
            icon: 'error',
            title: 'Erro no Banco',
            text: 'Favor Verificar Informações Digitadas ',
            confirmButtonColor: '#e74c3c'
        });
    } else {
        // Pop-up moderno de Sucesso
        Swal.fire({
            icon: 'success',
            title: 'Sucesso!',
            text: 'Donativo lançado com sucesso!',
            showConfirmButton: false,
            timer: 2000
        });
        
        // Limpa apenas os campos de valores para o próximo lançamento
        document.getElementById('valorMundial').value = '';
        document.getElementById('valorCongregacao').value = '';
        
        // Atualiza a tabela na tela para incluir o novo registro
        buscarDonativos();
    }
}

// ==========================================================================
// FUNÇÃO: BUSCAR DONATIVOS (Com correção de limite seguro de meses)
// ==========================================================================
async function buscarDonativos() {
    const mes = document.getElementById('filtroMes').value;
    const ano = document.getElementById('filtroAno').value;

    const dataInicio = `${ano}-${mes}-01`;
    
    let proximoMes = parseInt(mes) + 1;
    let proximoAno = parseInt(ano);
    
    if (proximoMes > 12) {
        proximoMes = 1;
        proximoAno += 1;
    }
    
    const proximoMesFormatado = String(proximoMes).padStart(2, '0');
    const dataFim = `${proximoAno}-${proximoMesFormatado}-01`;

    const { data, error } = await conexaoSupabase
        .from('donativos')
        .select('*')
        .gte('data_donativo', dataInicio)
        .lt('data_donativo', dataFim)
        .order('data_donativo', { ascending: true });

    if (error) {
        console.error("Erro ao buscar dados:", error);
        Swal.fire({
            icon: 'error',
            title: 'Erro de Carregamento',
            text: 'Erro ao carregar dados do banco: ' + error.message,
            confirmButtonColor: '#e74c3c'
        });
        return;
    }

    dadosAtuais = data; 
    renderizarTabela(data);
}

// ==========================================================================
// FUNÇÃO: RENDERIZAR TABELA (Calculando as Somas Gerais na Linha e no Rodapé)
// ==========================================================================
function renderizarTabela(dados) {
    const corpo = document.getElementById('tabelaCorpo');
    corpo.innerHTML = ''; 

    let totalMundial = 0;
    let totalCongregacao = 0;
    let totalGeralAcumulado = 0; 

    if (dados.length === 0) {
        corpo.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8;">Nenhum lançamento encontrado para este mês.</td></tr>`;
        document.getElementById('totalMundial').innerText = 'R$ 0,00';
        document.getElementById('totalCongregacao').innerText = 'R$ 0,00';
        document.getElementById('totalGeralGeral').innerText = 'R$ 0,00';
        return;
    }

    dados.forEach(item => {
        totalMundial += item.obra_mundial;
        totalCongregacao += item.despesas_cong;
        
        // Calcula a soma da linha atual
        const totalLinha = item.obra_mundial + item.despesas_cong;
        totalGeralAcumulado += totalLinha;

        const dataFormatada = item.data_donativo.split('-').reverse().join('/');

        const linha = document.createElement('tr');
        linha.innerHTML = `
            <td>${dataFormatada}</td>
            <td>R$ ${item.obra_mundial.toFixed(2).replace('.', ',')}</td>
            <td>R$ ${item.despesas_cong.toFixed(2).replace('.', ',')}</td>
            <td style="font-weight: 600;">R$ ${totalLinha.toFixed(2).replace('.', ',')}</td>
            <td><button class="btn-deletar" onclick="deletarDonativo(${item.id})">Apagar</button></td>
        `;
        corpo.appendChild(linha);
    });

    // Atualiza os totais acumulados no rodapé da tabela HTML
    document.getElementById('totalMundial').innerText = `R$ ${totalMundial.toFixed(2).replace('.', ',')}`;
    document.getElementById('totalCongregacao').innerText = `R$ ${totalCongregacao.toFixed(2).replace('.', ',')}`;
    document.getElementById('totalGeralGeral').innerText = `R$ ${totalGeralAcumulado.toFixed(2).replace('.', ',')}`;
}

// ==========================================================================
// FUNÇÃO: APAGAR DONATIVO (Com confirmação estilizada e variável certa)
// ==========================================================================
async function deletarDonativo(id) {
    Swal.fire({
        title: 'Tem certeza?',
        text: "Você deseja mesmo apagar este lançamento de donativo?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        cancelButtonColor: '#7f8c8d',
        confirmButtonText: 'Sim, apagar!',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            // Usando 'conexaoSupabase' corretamente para não dar erro de definição
            const { error } = await conexaoSupabase
                .from('donativos')
                .delete()
                .eq('id', id);

            if (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro ao deletar',
                    text: error.message,
                    confirmButtonColor: '#e74c3c'
                });
            } else {
                Swal.fire({
                    icon: 'success',
                    title: 'Apagado!',
                    text: 'O lançamento foi removido com sucesso.',
                    showConfirmButton: false,
                    timer: 1500
                });
                buscarDonativos(); // Atualiza os dados em tela
            }
        }
    });
}

// ==========================================================================
// FUNÇÃO: GERAR EXCEL (Com colunas de total por lançamento e soma geral)
// ==========================================================================
function gerarExcel() {
    if (dadosAtuais.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Não há dados',
            text: 'Não há dados no mês selecionado para exportar para o Excel!',
            confirmButtonColor: '#34495e',
            confirmButtonText: 'Entendido'
        });
        return;
    }

    const filtroMesElement = document.getElementById('filtroMes');
    const mesTexto = filtroMesElement.options[filtroMesElement.selectedIndex].text;
    const anoTexto = document.getElementById('filtroAno').value;

    let matrizExcel = [];
    let somaMundial = 0;
    let somaCongregacao = 0;
    let somaTotalGeral = 0;

    // Cabeçalho com a coluna de total do lançamento inclusa
    matrizExcel.push(["Data", "Obra Mundial (R$)", "Despesas Congregação (R$)", "Total do Lançamento (R$)"]);

    // Linhas de dados calculando os totais
    dadosAtuais.forEach(item => {
        somaMundial += item.obra_mundial;
        somaCongregacao += item.despesas_cong;
        
        const totalLinha = item.obra_mundial + item.despesas_cong;
        somaTotalGeral += totalLinha;
        
        const dataFormatada = item.data_donativo.split('-').reverse().join('/');
        matrizExcel.push([dataFormatada, item.obra_mundial, item.despesas_cong, totalLinha]);
    });

    matrizExcel.push(["", "", "", ""]);
    matrizExcel.push(["TOTAL DO MÊS:", somaMundial, somaCongregacao, somaTotalGeral]);

    // Executa a exportação do arquivo binário pelo SheetJS
    const libroNovo = XLSX.utils.book_new();
    const abaNova = XLSX.utils.aoa_to_sheet(matrizExcel);

    XLSX.utils.book_append_sheet(libroNovo, abaNova, "Resumo Mensal");
    XLSX.writeFile(libroNovo, `Donativos_Vila_Rio_Negro_${mesTexto}_${anoTexto}.xlsx`);
}

// ==========================================================================
// FUNÇÃO: DESLOGAR (Limpa a sessão de segurança e manda para o login)
// ==========================================================================
function deslogar() {
    Swal.fire({
        title: 'Deseja sair?',
        text: "Você precisará digitar a senha novamente para entrar no sistema.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        cancelButtonColor: '#7f8c8d',
        confirmButtonText: 'Sim, sair',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            // Remove a marcação que burlava a trava
            localStorage.removeItem('usuarioLogado');
            // Chuta de volta para o login
            window.location.href = "index.html";
        }
    });
}