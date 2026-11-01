const DEFAULTS = {
  jornada: '9',
  intervalo: 500
};

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('configuracao');
  const jornada = document.getElementById('jornada');
  const intervalo = document.getElementById('intervalo');
  const salvar = document.getElementById('salvar');
  const preencher = document.getElementById('preencher');
  const status = document.getElementById('status');
  const periodoTarde = document.getElementById('periodoTarde');

  function mensagem(texto, tipo = '') {
    status.textContent = texto;
    status.className = tipo;
  }

  function lerFormulario() {
    return {
      jornada: jornada.value,
      intervalo: Number(intervalo.value)
    };
  }

  function atualizarHorario() {
    periodoTarde.textContent = jornada.value === '8' ? '13:00 — 17:00' : '13:00 — 18:00';
  }

  try {
    const dados = await chrome.storage.local.get(DEFAULTS);
    jornada.value = dados.jornada;
    intervalo.value = dados.intervalo;
  } catch {
    mensagem('Não foi possível carregar os dados salvos.', 'error');
  }
  atualizarHorario();

  jornada.addEventListener('change', atualizarHorario);

  salvar.addEventListener('click', async () => {
    if (!form.reportValidity()) return;
    try {
      await chrome.storage.local.set(lerFormulario());
      mensagem('Configuração salva neste navegador.', 'success');
    } catch {
      mensagem('Não foi possível salvar a configuração.', 'error');
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const configuracao = lerFormulario();
    if (!form.reportValidity()) return;

    preencher.disabled = true;
    mensagem('Preenchendo os períodos…');
    try {
      await chrome.storage.local.set(configuracao);
      const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!aba?.id) throw new Error('Aba ativa indisponível.');

      const execucoes = await chrome.scripting.executeScript({
        target: { tabId: aba.id, allFrames: true },
        world: 'MAIN',
        func: preencherOrdemServico,
        args: [configuracao]
      });
      const execucao = execucoes.find(item => item.result?.ok) ||
        execucoes.find(item => item.result?.encontrouTela);
      const resultado = execucao?.result;
      if (!resultado) throw new Error('Tela de períodos não encontrada nesta página.');
      mensagem(resultado.mensagem, resultado.ok ? 'success' : 'error');
    } catch (erro) {
      mensagem(erro.message || 'Não foi possível executar nesta página.', 'error');
    } finally {
      preencher.disabled = false;
    }
  });
});

async function preencherOrdemServico(configuracao) {
  const pausa = ms => new Promise(resolve => setTimeout(resolve, ms));
  const intervalo = Math.max(50, Math.min(10000, Number(configuracao.intervalo) || 500));

  function setNativeValue(elemento, valor) {
    const proto = elemento.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (!setter) return false;
    setter.call(elemento, valor);
    elemento.dispatchEvent(new Event('input', { bubbles: true }));
    elemento.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function getTriggerByLabel(texto, raiz = document) {
    const label = [...raiz.querySelectorAll('label')]
      .find(item => item.textContent.trim().startsWith(texto));
    return label?.parentElement?.querySelector('button[role="combobox"]') || null;
  }

  function getPeriodCards() {
    return [...document.querySelectorAll('div')]
      .filter(div => String(div.className).includes('rounded-full') && /^\d+$/.test(div.textContent.trim()))
      .map(badge => ({ numero: Number(badge.textContent.trim()), card: badge.closest('.rounded-lg.border') }))
      .filter(periodo => periodo.card);
  }

  async function aguardar(procurar, limite = Math.max(3000, intervalo * 10)) {
    const inicio = Date.now();
    while (Date.now() - inicio < limite) {
      const resultado = procurar();
      if (resultado) return resultado;
      await pausa(Math.min(intervalo, 250));
    }
    return null;
  }

  if (location.hostname !== 'portalconsultor.dgbtecnologia.com.br' ||
      location.pathname.replace(/\/$/, '') !== '/work-orders') {
    return { ok: false, encontrouTela: false, mensagem: 'Abra o cadastro de OS no Portal Consultor.' };
  }
  if (!getPeriodCards().length) {
    return { ok: false, encontrouTela: false, mensagem: 'Tela de períodos não encontrada nesta página.' };
  }

  let periodos = getPeriodCards();
  if (periodos.length < 2) {
    const adicionar = [...document.querySelectorAll('button')]
      .find(botao => botao.textContent.trim() === 'Adicionar Período');
    if (!adicionar) {
      return { ok: false, encontrouTela: true, mensagem: 'Botão Adicionar Período não encontrado.' };
    }
    adicionar.click();
    periodos = await aguardar(() => {
      const atuais = getPeriodCards();
      return atuais.length >= 2 ? atuais : null;
    });
  }

  if (!periodos || periodos.length < 2) {
    return { ok: false, encontrouTela: true, mensagem: 'O segundo período não carregou a tempo.' };
  }

  const fim = configuracao.jornada === '8' ? '17:00' : '18:00';
  const horarios = { 1: ['08:00', '12:00'], 2: ['13:00', fim] };
  const chave = '__osVelozPeriodos';
  window[chave]?.();
  const projetos = new Map();
  let timer;

  function preencherHorarios(forcar = false) {
    if (getPeriodCards().length === 1) {
      [...document.querySelectorAll('button')]
        .find(botao => botao.textContent.trim() === 'Adicionar Período')?.click();
    }
    for (const { numero, card } of getPeriodCards().filter(item => horarios[item.numero])) {
      const projeto = getTriggerByLabel('Projeto', card)?.textContent || '';
      const anterior = projetos.get(numero);
      const alterouProjeto = !anterior || anterior.card !== card || anterior.projeto !== projeto;
      projetos.set(numero, { card, projeto });
      for (let indice = 0; indice < 2; indice++) {
        // Reconsulta os campos porque o React pode renderizar o periodo novamente.
        const input = card.querySelectorAll('input[type="time"]')[indice];
        if (input && (forcar || alterouProjeto || !input.value) && input.value !== horarios[numero][indice]) {
          setNativeValue(input, horarios[numero][indice]);
        }
      }
    }
  }

  function agendar() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      preencherHorarios();
    }, intervalo);
  }

  const observer = new MutationObserver(agendar);
  observer.observe(document.body, {
    subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ['value']
  });
  window[chave] = () => { observer.disconnect(); clearTimeout(timer); };
  preencherHorarios(true);
  await pausa(intervalo);
  const completos = getPeriodCards().filter(item => horarios[item.numero]).length === 2 &&
    getPeriodCards().filter(item => horarios[item.numero]).every(({ numero, card }) =>
      card.querySelectorAll('input[type="time"]').length === 2 &&
      [...card.querySelectorAll('input[type="time"]')].every((input, indice) => input.value === horarios[numero][indice]));
  return { ok: completos, encontrouTela: true, mensagem: completos
    ? `Dois períodos preenchidos. Os horários serão reaplicados ao trocar o projeto. Nenhuma OS foi salva.`
    : 'Confira os horários dos dois períodos. Nenhuma OS foi salva.' };
}
